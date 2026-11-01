import dayjs from 'dayjs';
import { EntityManager } from 'typeorm';
import { v7 } from 'uuid';
import { AppDataSource } from '../../config/database.config';
import { SalesOrder } from '../../entity/finance.entity';
import { MinioFile } from '../../entity/file.entity';
import {
    CreateOrderDto,
    ListOrderDto,
    OrderIdDto,
    ReceiveOrderDto,
    UpdateOrderDto,
    UpdateOrderStatusDto,
} from '../../dto/salesOrder.dto';
import { getLogger } from '../../utils/logger.util';
import { generateFileUrl } from '../../config/minio.config';
import { BusinessError } from '../../utils/error.util';

/** 正常状态 */
const STATUS_NORMAL = 1;
/** 停用状态(软删除) */
const STATUS_DISABLED = 2;
/** 订单状态:4-已取消(终态) */
const ORDER_STATUS_CANCELLED = 4;
/** 收款状态:1-未收款 */
const PAY_STATUS_UNPAID = 1;
/** 收款状态:2-部分收款 */
const PAY_STATUS_PARTIAL = 2;
/** 收款状态:3-已收款 */
const PAY_STATUS_PAID = 3;

/** 新建响应 */
interface OrderCreateResult {
    result: number;
    msg: string;
    datas?: { order_id: string; order_no: string };
}

/** 修改/删除/收款/状态变更响应 */
interface OrderOpResult {
    result: number;
    msg: string;
    datas?: { received_amount: string; pay_status: number };
}

/** 列表条目 */
interface OrderListItem {
    order_id: string;
    order_no: string;
    order_title: string | null;
    user_id: string;
    customer_name: string;
    customer_phone: string;
    address: string | null;
    amount: string;
    received_amount: string;
    pay_status: number;
    delivery_date: string;
    order_status: number;
    remark: string | null;
    contract_file_id: string | null;
    status: number;
    create_time: string;
}

/** 列表响应 */
interface OrderListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: OrderListItem[] };
}

/** 详情数据(含合同文件预览地址) */
interface OrderDetailData extends Omit<OrderListItem, 'create_time'> {
    create_time: string;
    update_time: string;
    /** 合同文件预览地址(文件缺失时无此字段) */
    contract_url?: string;
    /** 内部联查字段(object_name 仅用于生成预览地址) */
    file_object_name?: string | null;
}

/** 详情响应 */
interface OrderDetailResult {
    result: number;
    msg: string;
    datas?: OrderDetailData;
}

export class SalesOrderService {
    private orderRepository = AppDataSource.getRepository(SalesOrder);
    private logger = getLogger('SALES_ORDER_SERV');

    /**
     * 新建销售订单(POST /order/create)
     * - 订单编号 XS+6位递增数字 在事务内生成
     * - 初始状态:pay_status=1-未收款,received_amount=0,order_status=1-待交货
     *
     * @param dto 新建参数
     */
    async create(dto: CreateOrderDto): Promise<OrderCreateResult> {
        try {
            const saved = await AppDataSource.transaction(async (manager) => {
                const orderNo = await this.generateOrderNo(manager);
                const now = new Date();
                const order = manager.create(SalesOrder, {
                    order_id: v7().replace(/-/g, ''),
                    order_no: orderNo,
                    order_title: dto.order_title,
                    user_id: dto.user_id,
                    customer_name: dto.customer_name,
                    customer_phone: dto.customer_phone,
                    address: dto.address ?? null,
                    amount: dto.amount.toFixed(2),
                    received_amount: '0.00',
                    pay_status: PAY_STATUS_UNPAID,
                    delivery_date: new Date(`${dto.delivery_date}T00:00:00`),
                    order_status: 1,
                    remark: dto.remark ?? null,
                    contract_file_id: dto.contract_file_id ?? null,
                    status: STATUS_NORMAL,
                    create_time: now,
                    update_time: now,
                });
                await manager.save(order);

                this.logger.info('销售订单新建完成:', {
                    order_id: order.order_id,
                    order_no: order.order_no,
                });
                return order;
            });
            return {
                result: 0,
                msg: '创建成功',
                datas: { order_id: saved.order_id, order_no: saved.order_no },
            };
        } catch (error) {
            this.logger.error('销售订单新建失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '新建失败' };
        }
    }

    /**
     * 修改销售订单(POST /order/update)
     * - 仅正常状态(status=1)订单可修改;订单编号与创建人不可改
     * - 仅可修改基本信息,全部字段可选,仅更新传入字段
     * - 修改订单金额时,按已收金额与新金额重新推导收款状态落库
     *
     * @param dto 修改参数(order_id 必填,其余可选)
     */
    async update(dto: UpdateOrderDto): Promise<OrderOpResult> {
        try {
            // 1. 校验订单存在
            const order = await this.orderRepository.findOne({
                where: { order_id: dto.order_id, status: STATUS_NORMAL },
            });
            if (!order) {
                return { result: 1, msg: '销售订单不存在或已停用' };
            }

            // 2. 更新基本信息;金额变更时重算收款状态(以分为单位比较,避免浮点误差)
            const newAmount = dto.amount !== undefined ? dto.amount.toFixed(2) : order.amount;
            const payStatus = this.derivePayStatus(order.received_amount, newAmount);

            await this.orderRepository.update(
                { order_id: dto.order_id },
                {
                    order_title: dto.order_title ?? order.order_title,
                    customer_name: dto.customer_name ?? order.customer_name,
                    customer_phone: dto.customer_phone ?? order.customer_phone,
                    address: dto.address ?? order.address,
                    amount: newAmount,
                    pay_status: payStatus,
                    delivery_date: dto.delivery_date
                        ? new Date(`${dto.delivery_date}T00:00:00`)
                        : order.delivery_date,
                    remark: dto.remark ?? order.remark,
                    contract_file_id: dto.contract_file_id ?? order.contract_file_id,
                    update_time: new Date(),
                }
            );
            this.logger.info('销售订单修改完成:', { order_id: dto.order_id });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('销售订单修改失败:', error);
            return { result: 1, msg: '修改失败' };
        }
    }

    /**
     * 分页查询销售订单列表(GET /order/list)
     * - 只查正常状态(status=1),已停用订单不展示
     * - 支持筛选:订单状态、收款状态、交货日期区间(含起止当天)、
     *   关键字(订单编号/客户名称模糊匹配)
     * - 按创建时间降序
     *
     * @param dto 分页与筛选参数
     */
    async list(dto: ListOrderDto): Promise<OrderListResult> {
        try {
            const queryBuilder = this.orderRepository
                .createQueryBuilder('order')
                .select([
                    'order.order_id AS order_id',
                    'order.order_no AS order_no',
                    'order.order_title AS order_title',
                    'order.customer_name AS customer_name',
                    'order.customer_phone AS customer_phone',
                    'order.address AS address',
                    'order.amount AS amount',
                    'order.received_amount AS received_amount',
                    'order.pay_status AS pay_status',
                    "to_char(order.delivery_date, 'YYYY-MM-DD') AS delivery_date",
                    'order.order_status AS order_status',
                    'order.remark AS remark',
                    "to_char(order.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('order.status = :status', { status: STATUS_NORMAL });

            if (dto.order_status) {
                queryBuilder.andWhere('order.order_status = :orderStatus', {
                    orderStatus: dto.order_status,
                });
            }
            if (dto.pay_status) {
                queryBuilder.andWhere('order.pay_status = :payStatus', {
                    payStatus: dto.pay_status,
                });
            }
            if (dto.start_date) {
                queryBuilder.andWhere('order.delivery_date >= :startDate', {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                // 结束日期含当天:与「止日期次日零点」比较
                queryBuilder.andWhere('order.delivery_date < :endDate', {
                    endDate: dayjs(dto.end_date).add(1, 'day').format('YYYY-MM-DD'),
                });
            }
            if (dto.keyword) {
                queryBuilder.andWhere(
                    '(order.order_no LIKE :keyword OR order.customer_name LIKE :keyword)',
                    {
                        keyword: `%${dto.keyword}%`,
                    }
                );
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('order.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<OrderListItem>();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询销售订单列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询销售订单详情(GET /order/detail)
     * - 只查正常状态(status=1),不存在或已停用返回「销售订单不存在」
     * - 返回订单全部业务字段及合同文件预览地址 contract_url
     *   (通过 contract_file_id 关联 minio_file 生成,文件缺失时无此字段)
     *
     * @param dto 订单ID
     */
    async detail(dto: OrderIdDto): Promise<OrderDetailResult> {
        try {
            const row = await this.orderRepository
                .createQueryBuilder('order')
                .leftJoin(MinioFile, 'file', 'file.relation_id = order.contract_file_id')
                .select([
                    'order.order_id AS order_id',
                    'order.order_no AS order_no',
                    'order.order_title AS order_title',
                    'order.user_id AS user_id',
                    'order.customer_name AS customer_name',
                    'order.customer_phone AS customer_phone',
                    'order.address AS address',
                    'order.amount AS amount',
                    'order.received_amount AS received_amount',
                    'order.pay_status AS pay_status',
                    "to_char(order.delivery_date, 'YYYY-MM-DD HH24:MI:SS') AS delivery_date",
                    'order.order_status AS order_status',
                    'order.remark AS remark',
                    'order.contract_file_id AS contract_file_id',
                    'order.status AS status',
                    "to_char(order.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                    "to_char(order.update_time, 'YYYY-MM-DD HH24:MI:SS') AS update_time",
                    'file.object_name AS file_object_name',
                ])
                .where('order.order_id = :orderId AND order.status = :status', {
                    orderId: dto.order_id,
                    status: STATUS_NORMAL,
                })
                .getRawOne<OrderDetailData>();

            if (!row) {
                return { result: 1, msg: '销售订单不存在' };
            }

            // 合同文件联查字段(object_name 仅用于生成预览地址)
            const datas = { ...row };
            if (datas.file_object_name) {
                datas.contract_url = generateFileUrl(datas.file_object_name);
            }
            delete datas.file_object_name;

            return { result: 0, msg: 'success', datas };
        } catch (error) {
            this.logger.error('查询销售订单详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 删除销售订单(POST /order/delete)
     * - 软删除:订单 status 置为2(停用),已停用订单不再出现在列表/详情中
     *
     * @param dto 订单ID
     */
    async delete(dto: OrderIdDto): Promise<OrderOpResult> {
        try {
            const order = await this.orderRepository.findOne({
                where: { order_id: dto.order_id, status: STATUS_NORMAL },
            });
            if (!order) {
                return { result: 1, msg: '销售订单不存在或已停用' };
            }

            await this.orderRepository.update(
                { order_id: dto.order_id },
                { status: STATUS_DISABLED, update_time: new Date() }
            );
            this.logger.info('销售订单删除完成:', {
                order_id: dto.order_id,
                order_no: order.order_no,
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('销售订单删除失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 销售订单收款(POST /order/receive)
     * - 传本次收款金额,累加到已收金额;累加后不得超过订单金额
     * - 仅正常状态且未取消的订单可收款
     * - pay_status 由已收/订单金额自动推导落库
     *
     * @param dto 订单ID与本次收款金额
     */
    async receive(dto: ReceiveOrderDto): Promise<OrderOpResult> {
        try {
            // 1. 校验订单存在且未取消
            const order = await this.orderRepository.findOne({
                where: { order_id: dto.order_id, status: STATUS_NORMAL },
            });
            if (!order) {
                return { result: 1, msg: '销售订单不存在或已停用' };
            }
            if (order.order_status === ORDER_STATUS_CANCELLED) {
                return { result: 1, msg: '已取消订单不可收款' };
            }

            // 2. 校验累加后不超过订单金额(以分为单位比较,避免浮点误差)
            const newReceived =
                Math.round(Number(order.received_amount) * 100) +
                Math.round(dto.received_amount * 100);
            const amountCent = Math.round(Number(order.amount) * 100);
            if (newReceived > amountCent) {
                return { result: 1, msg: '收款金额超过订单未收金额' };
            }

            // 3. 累加已收金额并推导收款状态
            const newReceivedStr = (newReceived / 100).toFixed(2);
            const payStatus = this.derivePayStatus(newReceivedStr, order.amount);
            await this.orderRepository.update(
                { order_id: dto.order_id },
                { received_amount: newReceivedStr, pay_status: payStatus, update_time: new Date() }
            );
            this.logger.info('销售订单收款完成:', {
                order_id: dto.order_id,
                received_amount: newReceivedStr,
                pay_status: payStatus,
            });
            return {
                result: 0,
                msg: 'success',
                datas: { received_amount: newReceivedStr, pay_status: payStatus },
            };
        } catch (error) {
            this.logger.error('销售订单收款失败:', error);
            return { result: 1, msg: '操作失败' };
        }
    }

    /**
     * 销售订单状态变更(POST /order/updateStatus)
     * - 已取消(4)为终态,不可再变更;其余状态可自由设置
     * - 传入与当前相同的状态视为幂等操作,直接返回成功
     *
     * @param dto 订单ID与目标状态
     */
    async updateStatus(dto: UpdateOrderStatusDto): Promise<OrderOpResult> {
        try {
            const order = await this.orderRepository.findOne({
                where: { order_id: dto.order_id, status: STATUS_NORMAL },
            });
            if (!order) {
                return { result: 1, msg: '销售订单不存在或已停用' };
            }
            if (order.order_status === ORDER_STATUS_CANCELLED) {
                return { result: 1, msg: '已取消订单为终态,不可变更状态' };
            }
            if (order.order_status === dto.order_status) {
                return { result: 0, msg: 'success' };
            }

            await this.orderRepository.update(
                { order_id: dto.order_id },
                { order_status: dto.order_status, update_time: new Date() }
            );
            this.logger.info('销售订单状态变更完成:', {
                order_id: dto.order_id,
                order_status: dto.order_status,
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('销售订单状态变更失败:', error);
            return { result: 1, msg: '操作失败' };
        }
    }

    /**
     * 生成订单编号:XS+6位递增数字(如XS000001)
     * - 取当前最大编号递增;表为空时从 XS000001 开始
     * - 须在事务内调用,并发唯一冲突由数据库唯一约束兜底
     */
    private async generateOrderNo(manager: EntityManager): Promise<string> {
        const result = await manager
            .createQueryBuilder(SalesOrder, 'order')
            .select('MAX(SUBSTRING(order.order_no, 3)::INTEGER)', 'maxNum')
            .where('order.order_no ~ :pattern', { pattern: '^XS[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new BusinessError(9000, '销售订单编号已达上限');
        }
        return `XS${String(nextNum).padStart(6, '0')}`;
    }

    /**
     * 推导收款状态:由已收金额与订单金额比较得出
     * - 0-未收 → 1-未收款;部分 → 2-部分收款;足额 → 3-已收款
     * - 以分为单位比较,避免浮点误差
     *
     * @param receivedAmountStr 已收金额(数字字符串)
     * @param amountStr 订单金额(数字字符串)
     */
    private derivePayStatus(receivedAmountStr: string, amountStr: string): number {
        const receivedCent = Math.round(Number(receivedAmountStr) * 100);
        const amountCent = Math.round(Number(amountStr) * 100);
        if (receivedCent <= 0) {
            return PAY_STATUS_UNPAID;
        }
        if (receivedCent >= amountCent) {
            return PAY_STATUS_PAID;
        }
        return PAY_STATUS_PARTIAL;
    }
}
