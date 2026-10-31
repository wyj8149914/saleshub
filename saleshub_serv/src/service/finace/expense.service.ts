import dayjs from 'dayjs';
import { EntityManager } from 'typeorm';
import { v7 } from 'uuid';
import { AppDataSource } from '../../config/database.config';
import { Expense, ExpenseItem, Invoice } from '../../entity/finance.entity';
import { MinioFile } from '../../entity/file.entity';
import {
    BindInvoiceDto,
    CreateExpenseDto,
    ExpenseIdDto,
    ListExpenseDto,
    UpdateExpenseDto,
} from '../../dto/expense.dto';
import { getLogger } from '../../utils/logger.util';
import { generateFileUrl } from '../../config/minio.config';
import { InventoryItem, InventoryItemSpec } from '../../entity/product.entity';
import { BusinessError } from '../../utils/error.util';

/** 费用类型:1-有发票采购 */
const EXPENSE_TYPE_WITH_INVOICE = 1;
/** 正常状态 */
const STATUS_NORMAL = 1;
/** 停用状态(采购明细行整批替换时旧行置为此值) */
const STATUS_DISABLED = 2;
/** 费用单编号生成失败时的最大重试次数(并发下 uk_expense_no 唯一冲突重试) */
const MAX_EXPENSE_NO_RETRY = 3;

/** 新建响应 */
interface ExpenseCreateResult {
    result: number;
    msg: string;
    datas?: { expense_id: string; expense_no: string };
}

/** 修改/关联发票响应 */
interface ExpenseOpResult {
    result: number;
    msg: string;
}

/** 列表条目(含关联发票号码与价税合计,不含采购明细) */
interface ExpenseListItem {
    expense_id: string;
    expense_no: string;
    expense_type: number;
    user_id: string;
    invoice_id: string | null;
    invoice_number: string | null;
    invoice_total_amount: string | null;
    channel: number | null;
    order_no: string | null;
    amount: string;
    expense_date: string;
    category: number | null;
    payee: string | null;
    payment_method: number | null;
    remark: string | null;
    status: number;
    create_time: string;
}

/** 列表响应 */
interface ExpenseListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: ExpenseListItem[] };
}

/** 关联发票摘要(详情内嵌) */
interface ExpenseInvoiceInfo {
    invoice_number: string;
    sub_type_desc: string | null;
    invoice_date: Date | null;
    total_amount: string | null;
    /** 原始发票文件(图片/PDF)预览地址 */
    file_url: string;
}

/** 详情数据(含采购明细行与关联发票摘要) */
interface ExpenseDetailData {
    expense_id: string;
    expense_no: string;
    expense_title: string | null;
    expense_type: number;
    user_id: string;
    invoice_id: string | null;
    channel: number | null;
    order_no: string | null;
    amount: string;
    expense_date: string;
    category: number | null;
    payee: string | null;
    payment_method: number | null;
    remark: string | null;
    status: number;
    create_time: string;
    update_time: string;
    /** 采购明细行(仅正常状态,类型1专有;类型2为空数组) */
    items: {
        relation_id: string;
        item_id: string;
        spec_id: string;
        quantity: number;
        price: string;
        remark: string | null;
    }[];
    invoice_number: string | null;
    sub_type_desc: string | null;
    invoice_date: string | null;
    file_object_name: string | null;
    invoice_url: string | null;
}

/** 详情响应 */
interface ExpenseDetailResult {
    result: number;
    msg: string;
    datas?: ExpenseDetailData;
}

export class ExpenseService {
    private expenseRepository = AppDataSource.getRepository(Expense);
    private expenseItemRepository = AppDataSource.getRepository(ExpenseItem);
    private logger = getLogger('EXPENSE_SERV');

    /**
     * 新建支出费用单(POST /expense/create)
     * - 类型1-有发票采购:必须关联发票(已通过 /invoice/upload 识别入库后回填ID)、
     *   采购来源渠道与采购明细(1~100行),发票与其他费用单 1:1,已关联则拒绝
     * - 类型2-无发票支出:不关联发票与明细(传了即拒绝),仅记金额/分类/收款方/付款方式
     * - 费用单编号 ZC+6位递增数字 在事务内生成,并发唯一冲突时重试
     * - 费用单与采购明细行在同一事务内写入
     *
     * @param dto 新建参数
     */
    async create(dto: CreateExpenseDto): Promise<ExpenseCreateResult> {
        const isWithInvoice = dto.expense_type === EXPENSE_TYPE_WITH_INVOICE;

        // 1. 按费用类型校验互斥字段
        if (isWithInvoice) {
            if (!dto.channel) {
                return { result: 1, msg: '有发票采购必须选择采购来源渠道' };
            }
        } else {
            if (dto.invoice_id) {
                return { result: 1, msg: '无发票支出不能关联发票' };
            }
        }

        // 2. 类型1:校验发票存在且未被其他费用单关联
        if (isWithInvoice && dto.invoice_id) {
            const invoiceExists = await this.invoiceExists(dto.invoice_id!);
            if (!invoiceExists) {
                return { result: 1, msg: '发票不存在或已作废' };
            }
            const bound = await this.findExpenseByInvoice(dto.invoice_id!);
            if (bound) {
                return {
                    result: 1,
                    msg: '该发票已被支出费用单关联,费用单编号:' + bound.expense_no,
                };
            }
        }

        // 3. 事务写入费用单与采购明细;编号唯一冲突时重试
        try {
            const saved = await AppDataSource.transaction(async (manager) => {
                const expenseNo = await this.generateExpenseNo(manager);
                const now = new Date();
                const expense = manager.create(Expense, {
                    expense_id: v7().replace(/-/g, ''),
                    expense_no: expenseNo,
                    expense_title: dto.expense_title ?? null,
                    expense_type: dto.expense_type,
                    user_id: dto.user_id,
                    invoice_id: isWithInvoice ? dto.invoice_id! : null,
                    channel: dto.channel ? dto.channel : null,
                    order_no: dto.order_no ?? null,
                    amount: dto.amount.toFixed(2),
                    expense_date: new Date(dto.expense_date),
                    category: dto.category ?? null,
                    payee: dto.payee ?? null,
                    payment_method: dto.payment_method ?? null,
                    remark: dto.remark ?? null,
                    status: STATUS_NORMAL,
                    create_time: now,
                    update_time: now,
                });
                await manager.save(expense);

                // 采购明细行与费用单同事务写入
                if (dto.items) {
                    const itemIds = [...new Set(dto.items.map((it) => it.item_id))];
                    const items = await manager
                        .createQueryBuilder(InventoryItem, 'item')
                        .where('item.item_id IN (:...ids) AND item.status = :status', {
                            ids: itemIds,
                            status: 1,
                        })
                        .getMany();
                    if (items.length !== itemIds.length) {
                        const found = new Set(items.map((i: InventoryItem) => i.item_id));
                        const missing = itemIds.filter((id) => !found.has(id));
                        throw new BusinessError(9000, `采购明细中零件不存在或已停用: ${missing.join(',')}`);
                    }

                    const specIds = dto.items.map((it) => it.spec_id);
                    const specRows = await manager
                        .createQueryBuilder(InventoryItemSpec, 's')
                        .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
                        .getMany();
                    const specMap = new Map(specRows.map((s) => [s.spec_id, s]));
                    for (const it of dto.items) {
                        const specRow = specMap.get(it.spec_id);
                        if (!specRow) {
                            throw new BusinessError(9000, `规格不存在或已停用: ${it.spec_id}`);
                        }
                        if (specRow.item_id !== it.item_id) {
                            throw new BusinessError(9000, `规格与零件不匹配: ${it.spec_id}`);
                        }
                    }

                    const itemRows = dto.items.map((item) =>
                        manager.create(ExpenseItem, {
                            relation_id: v7().replace(/-/g, ''),
                            expense_id: expense.expense_id,
                            item_id: item.item_id,
                            spec_id: item.spec_id,
                            quantity: item.quantity,
                            price: item.price.toFixed(2),
                            remark: item.remark ?? null,
                            status: STATUS_NORMAL,
                            create_time: now,
                            update_time: now,
                        })
                    );
                    await manager.save(itemRows);
                }

                this.logger.info('支出费用单新建完成:', {
                    expense_id: expense.expense_id,
                    expense_no: expense.expense_no,
                    expense_type: dto.expense_type,
                });
                return expense;
            });
            return { result: 0, msg: '创建成功', datas: { expense_id: saved.expense_id, expense_no: saved.expense_no } };
        } catch (error) {
            this.logger.error('支出费用单新建失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '新建失败' };
        }
    }

    /**
     * 修改支出费用单(POST /expense/update)
     * - 仅正常状态(status=1)费用单可修改;费用类型与费用单编号不允许修改
     * - 全部业务字段可选,仅更新传入字段
     * - 类型1可换绑发票(校验新发票存在且未被其他费用单关联)、更新采购来源渠道;
     *   类型2不允许传发票/渠道/明细
     * - 类型1传入 items 时整批替换采购明细:旧行置为停用(status=2),新行同事务写入
     *
     * @param dto 修改参数(expense_id 必填,其余可选)
     */
    async update(dto: UpdateExpenseDto): Promise<ExpenseOpResult> {
        try {
            // 1. 校验费用单存在
            const expense = await this.expenseRepository.findOne({
                where: { expense_id: dto.expense_id, status: STATUS_NORMAL },
            });
            if (!expense) {
                return { result: 1, msg: '支出费用单不存在或已作废' };
            }
            const isWithInvoice = expense.expense_type === EXPENSE_TYPE_WITH_INVOICE;

            // 2. 按费用类型校验传入字段
            if (!isWithInvoice) {
                if (dto.invoice_id) {
                    return { result: 1, msg: '无发票支出不能关联发票' };
                }
            }

            // 3. 换绑发票校验:新发票存在,且未被其他费用单关联(与当前相同则视为已绑定,直接放行)
            if (isWithInvoice && dto.invoice_id && dto.invoice_id !== expense.invoice_id) {
                const invoiceExists = await this.invoiceExists(dto.invoice_id);
                if (!invoiceExists) {
                    return { result: 1, msg: '发票不存在或已作废' };
                }
                const bound = await this.findExpenseByInvoice(dto.invoice_id);
                if (bound && bound.expense_id !== dto.expense_id) {
                    return {
                        result: 1,
                        msg: '该发票已被支出费用单关联,费用单编号:' + bound.expense_no,
                    };
                }
            }

            // 4. 事务更新费用单字段并整批替换采购明细
            await AppDataSource.transaction(async (manager) => {
                const now = new Date();
                await manager.update(
                    Expense,
                    { expense_id: dto.expense_id },
                    {
                        amount: dto.amount !== undefined ? dto.amount.toFixed(2) : expense.amount,
                        expense_title: dto.expense_title ?? expense.expense_title,
                        expense_date: dto.expense_date
                            ? new Date(`${dto.expense_date}T00:00:00`)
                            : expense.expense_date,
                        invoice_id:
                            isWithInvoice && dto.invoice_id ? dto.invoice_id : expense.invoice_id,
                        channel: isWithInvoice && dto.channel ? dto.channel : expense.channel,
                        order_no: dto.order_no ?? expense.order_no,
                        category: dto.category ?? expense.category,
                        payee: dto.payee ?? expense.payee,
                        payment_method: dto.payment_method ?? expense.payment_method,
                        remark: dto.remark ?? expense.remark,
                        update_time: now,
                    }
                );

                // 整批替换采购明细:旧行置为停用,新行重新写入(仅类型1支持)
                if (dto.items) {
                    const itemIds = [...new Set(dto.items.map((it) => it.item_id))];
                    const items = await manager
                        .createQueryBuilder(InventoryItem, 'item')
                        .where('item.item_id IN (:...ids) AND item.status = :status', {
                            ids: itemIds,
                            status: 1,
                        })
                        .getMany();
                    if (items.length !== itemIds.length) {
                        const found = new Set(items.map((i: InventoryItem) => i.item_id));
                        const missing = itemIds.filter((id) => !found.has(id));
                        throw new BusinessError(9000, `采购明细中零件不存在或已停用: ${missing.join(',')}`);
                    }

                    const specIds = dto.items.map((it) => it.spec_id);
                    const specRows = await manager
                        .createQueryBuilder(InventoryItemSpec, 's')
                        .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
                        .getMany();
                    const specMap = new Map(specRows.map((s) => [s.spec_id, s]));
                    for (const it of dto.items) {
                        const specRow = specMap.get(it.spec_id);
                        if (!specRow) {
                            throw new BusinessError(9000, `规格不存在或已停用: ${it.spec_id}`);
                        }
                        if (specRow.item_id !== it.item_id) {
                            throw new BusinessError(9000, `规格与零件不匹配: ${it.spec_id}`);
                        }
                    }

                    await manager.update(
                        ExpenseItem,
                        { expense_id: dto.expense_id, status: STATUS_NORMAL },
                        { status: STATUS_DISABLED, update_time: now }
                    );
                    const itemRows = dto.items.map((item) =>
                        manager.create(ExpenseItem, {
                            relation_id: v7().replace(/-/g, ''),
                            expense_id: dto.expense_id,
                            item_id: item.item_id,
                            spec_id: item.spec_id,
                            quantity: item.quantity,
                            price: item.price.toFixed(2),
                            remark: item.remark ?? null,
                            status: STATUS_NORMAL,
                            create_time: now,
                            update_time: now,
                        })
                    );
                    await manager.save(itemRows);
                }
            });
            this.logger.info('支出费用单修改完成:', { expense_id: dto.expense_id });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('支出费用单修改失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '修改失败' };
        }
    }

    /**
     * 分页查询支出费用单列表(GET /expense/list)
     * - 只查正常状态(status=1),作废费用单不展示
     * - 支持筛选:费用类型、采购来源渠道、支出分类、付款方式、支出日期区间(含起止当天)、
     *   关键字(费用单编号/收款方模糊匹配)
     * - 左联发票表带出发票号码与价税合计(类型1关联发票时展示,其余为 null)
     * - 按创建时间降序
     *
     * @param dto 分页与筛选参数
     */
    async list(dto: ListExpenseDto): Promise<ExpenseListResult> {
        try {
            const queryBuilder = this.expenseRepository
                .createQueryBuilder('expense')
                .leftJoin(
                    Invoice,
                    'invoice',
                    'invoice.invoice_id = expense.invoice_id AND invoice.status = :invoiceStatus',
                    { invoiceStatus: STATUS_NORMAL }
                )
                .select([
                    'expense.expense_id AS expense_id',
                    'expense.expense_no AS expense_no',
                    'expense.expense_title AS expense_title',
                    'expense.expense_type AS expense_type',
                    'expense.user_id AS user_id',
                    'expense.invoice_id AS invoice_id',
                    'invoice.invoice_number AS invoice_number',
                    'invoice.total_amount AS invoice_total_amount',
                    'expense.channel AS channel',
                    'expense.order_no AS order_no',
                    'expense.amount AS amount',
                    "to_char(expense.expense_date, 'YYYY-MM-DD HH24:MI:SS') AS expense_date",
                    'expense.category AS category',
                    'expense.payee AS payee',
                    'expense.payment_method AS payment_method',
                    'expense.remark AS remark',
                    'expense.status AS status',
                    "to_char(expense.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('expense.status = :status', { status: STATUS_NORMAL });

            if (dto.expense_type) {
                queryBuilder.andWhere('expense.expense_type = :expenseType', {
                    expenseType: dto.expense_type,
                });
            }
            if (dto.channel) {
                queryBuilder.andWhere('expense.channel = :channel', { channel: dto.channel });
            }
            if (dto.category) {
                queryBuilder.andWhere('expense.category = :category', { category: dto.category });
            }
            if (dto.payment_method) {
                queryBuilder.andWhere('expense.payment_method = :paymentMethod', {
                    paymentMethod: dto.payment_method,
                });
            }
            if (dto.start_date) {
                queryBuilder.andWhere('expense.expense_date >= :startDate', {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                // 结束日期含当天:与「止日期次日零点」比较
                queryBuilder.andWhere('expense.expense_date < :endDate', {
                    endDate: dayjs(dto.end_date).add(1, 'day').format('YYYY-MM-DD'),
                });
            }
            if (dto.keyword) {
                queryBuilder.andWhere(
                    '(expense.expense_no LIKE :keyword OR expense.payee LIKE :keyword)',
                    {
                        keyword: `%${dto.keyword}%`,
                    }
                );
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('expense.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<ExpenseListItem>();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询支出费用单列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询支出费用单详情(GET /expense/detail)
     * - 只查正常状态(status=1),不存在或已作废返回「支出费用单不存在」
     * - 返回费用单全部业务字段、正常状态采购明细行,
     *   以及关联发票摘要(号码/类型描述/开票日期/价税合计/原始文件预览地址)
     *
     * @param dto 费用单ID
     */
    async detail(dto: ExpenseIdDto): Promise<ExpenseDetailResult> {
        try {
            const row = await this.expenseRepository
                .createQueryBuilder('expense')
                .leftJoin(
                    Invoice,
                    'invoice',
                    'invoice.invoice_id = expense.invoice_id AND invoice.status = :invoiceStatus',
                    { invoiceStatus: STATUS_NORMAL }
                )
                .leftJoin(MinioFile, 'file', 'file.relation_id = invoice.file_id')
                .select([
                    'expense.expense_id AS expense_id',
                    'expense.expense_no AS expense_no',
                    'expense.expense_title AS expense_title',
                    'expense.expense_type AS expense_type',
                    'expense.user_id AS user_id',
                    'expense.invoice_id AS invoice_id',
                    'expense.channel AS channel',
                    'expense.order_no AS order_no',
                    'expense.amount AS amount',
                    "to_char(expense.expense_date, 'YYYY-MM-DD HH24:MI:SS') AS expense_date",
                    'expense.category AS category',
                    'expense.payee AS payee',
                    'expense.payment_method AS payment_method',
                    'expense.remark AS remark',
                    'expense.status AS status',
                    "to_char(expense.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                    "to_char(expense.update_time, 'YYYY-MM-DD HH24:MI:SS') AS update_time",
                    'invoice.invoice_number AS invoice_number',
                    'invoice.sub_type_desc AS sub_type_desc',
                    'to_char(invoice.invoice_date, \'YYYY-MM-DD\') AS invoice_date',
                    'file.object_name AS file_object_name',
                ])
                .where('expense.expense_id = :expenseId AND expense.status = :status', {
                    expenseId: dto.expense_id,
                    status: STATUS_NORMAL,
                })
                .getRawOne();

            if (!row) {
                return { result: 1, msg: '支出费用单不存在' };
            }

            // 采购明细行(仅正常状态,按创建时间升序)
            const itemRows = await this.expenseItemRepository.createQueryBuilder('ei')
                .leftJoin(InventoryItem, 'item', 'item.item_id = ei.item_id')
                .leftJoin(InventoryItemSpec, 'spec', 'spec.spec_id = ei.spec_id')
                .select([
                    'ei.item_id AS item_id',
                    'ei.spec_id AS spec_id',
                    'ei.quantity AS quantity',
                    'ei.price AS price',
                    'item.name AS item_name',
                    'spec.spec AS spec_name',
                ])
                .where('ei.expense_id = :expenseId AND ei.status = :status', {
                    expenseId: dto.expense_id,
                    status: STATUS_NORMAL,
                })
                .orderBy('ei.create_time', 'ASC')
                .getRawMany();

            // 发票联查字段(object_name 仅用于生成预览地址)组装为 invoice
            const datas = { ...row, items: itemRows, };
            if (datas.file_object_name) {
                datas.invoice_url = generateFileUrl(datas.file_object_name);
            }

            return { result: 0, msg: 'success', datas };
        } catch (error) {
            this.logger.error('查询支出费用单详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 支出费用单关联发票(POST /expense/bindInvoice)
     * - 供前端上传发票后回填:先调已有 /invoice/upload 识别入库,再调本接口绑定发票ID
     * - 仅类型1-有发票采购费用单可关联;发票必须存在且正常状态
     * - 发票与费用单 1:1:已被其他费用单关联时拒绝;重复关联同一发票幂等返回成功
     * - 已关联旧发票的费用单可直接换绑,旧发票自动释放
     *
     * @param dto 费用单ID与发票ID
     */
    async bindInvoice(dto: BindInvoiceDto): Promise<ExpenseOpResult> {
        try {
            // 1. 校验费用单存在且为有发票采购类型
            const expense = await this.expenseRepository.findOne({
                where: { expense_id: dto.expense_id, status: STATUS_NORMAL },
            });
            if (!expense) {
                return { result: 1, msg: '支出费用单不存在或已作废' };
            }
            if (expense.expense_type !== EXPENSE_TYPE_WITH_INVOICE) {
                return { result: 1, msg: '仅类型1-有发票采购费用单可关联发票' };
            }

            // 2. 重复关联同一发票:幂等成功
            if (expense.invoice_id === dto.invoice_id) {
                return { result: 0, msg: 'success' };
            }

            // 3. 校验发票存在
            const invoiceExists = await this.invoiceExists(dto.invoice_id);
            if (!invoiceExists) {
                return { result: 1, msg: '发票不存在或已作废' };
            }

            // 4. 校验发票未被其他费用单关联
            const bound = await this.findExpenseByInvoice(dto.invoice_id);
            if (bound && bound.expense_id !== dto.expense_id) {
                return {
                    result: 1,
                    msg: '该发票已被支出费用单关联,费用单编号:' + bound.expense_no,
                };
            }

            // 5. 回填发票ID(唯一约束兜底并发)
            await this.expenseRepository.update(
                { expense_id: dto.expense_id },
                { invoice_id: dto.invoice_id, update_time: new Date() }
            );
            this.logger.info('支出费用单关联发票完成:', {
                expense_id: dto.expense_id,
                invoice_id: dto.invoice_id,
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('支出费用单关联发票失败:', error);
            return { result: 1, msg: '操作失败' };
        }
    }

    /**
     * 生成费用单编号:ZC+6位递增数字(如ZC000001)
     * - 取当前最大编号递增;表为空时从 ZC000001 开始
     * - 须在事务内调用,并发唯一冲突由调用方重试
     */
    private async generateExpenseNo(manager: EntityManager): Promise<string> {
        const result = await await manager
            .createQueryBuilder(Expense, 'item')
            .select('MAX(SUBSTRING(item.expense_no, 3)::INTEGER)', 'maxNum')
            .where('item.expense_no ~ :pattern', { pattern: '^ZC[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new BusinessError(9000, '费用支出编码已达上限');
        }
        return `ZC${String(nextNum).padStart(6, '0')}`;
    }

    /** 校验发票存在且为正常状态 */
    private async invoiceExists(invoiceId: string): Promise<boolean> {
        const count = await AppDataSource.getRepository(Invoice).count({
            where: { invoice_id: invoiceId, status: STATUS_NORMAL },
        });
        return count > 0;
    }

    /** 查询关联了指定发票的正常状态费用单(用于 1:1 占用校验) */
    private async findExpenseByInvoice(invoiceId: string): Promise<Expense | null> {
        return this.expenseRepository.findOne({
            where: { invoice_id: invoiceId, status: STATUS_NORMAL },
        });
    }
}
