import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import {
    CreateOrderDto,
    ListOrderDto,
    OrderIdDto,
    ReceiveOrderDto,
    UpdateOrderDto,
    UpdateOrderStatusDto,
} from '../dto/salesOrder.dto';
import { salesOrderService } from '../service/finace';

const router = Router();

/**
 * POST /create
 * 新建销售订单:订单编号 XS+6位递增数字 由服务端生成,
 * pay_status 初始为 1-未收款,order_status 初始为 1-待交货
 * Body: user_id-创建人(必填), order_title-订单名称(可选), customer_name-客户名称(必填),
 *       customer_phone-联系方式(必填), amount-订单金额(必填), delivery_date-交货日期YYYY-MM-DD(必填),
 *       address/remark/contract_file_id-可选
 */
router.post(
    '/create',
    validationMiddleware(CreateOrderDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // validationMiddleware 已将校验通过的 DTO 回写到 req.body
        const dto = req.body as CreateOrderDto;
        const result = await salesOrderService.create(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /update
 * 修改销售订单:仅正常状态订单可修改,仅可改基本信息(编号/创建人不可改),
 * 交货状态与已收金额走单独接口;修改金额时按已收金额重算收款状态
 * Body: order_id-订单ID(必填), 其余字段见 DTO(均可选)
 */
router.post(
    '/update',
    validationMiddleware(UpdateOrderDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as UpdateOrderDto;
        const result = await salesOrderService.update(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /list
 * 分页查询销售订单列表:只查正常状态订单
 * Query: pageIndex/pageSize-分页(必填), order_status-订单状态, pay_status-收款状态,
 *       start_date/end_date-交货日期区间(含当天), keyword-关键字(订单编号/客户名称模糊)
 */
router.get(
    '/list',
    validationMiddleware(ListOrderDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListOrderDto, req.query);
        const result = await salesOrderService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /detail
 * 销售订单详情:返回订单全部字段及合同文件预览地址 contract_url
 * Query: order_id-订单ID(必填)
 */
router.get(
    '/detail',
    validationMiddleware(OrderIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(OrderIdDto, req.query);
        const result = await salesOrderService.detail(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /receive
 * 销售订单收款:传本次收款金额累加到已收金额,不得超过订单金额,
 * pay_status 由已收/订单金额自动推导
 * Body: order_id-订单ID(必填), received_amount-本次收款金额(必填,>0)
 */
router.post(
    '/receive',
    validationMiddleware(ReceiveOrderDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as ReceiveOrderDto;
        const result = await salesOrderService.receive(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /updateStatus
 * 销售订单状态变更:已取消(4)为终态不可再变更,其余状态可自由设置
 * Body: order_id-订单ID(必填), order_status-目标状态1~4(必填)
 */
router.post(
    '/updateStatus',
    validationMiddleware(UpdateOrderStatusDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as UpdateOrderStatusDto;
        const result = await salesOrderService.updateStatus(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /delete
 * 删除销售订单(软删除):订单 status 置为2(停用),不再出现在列表/详情中
 * Body: order_id-订单ID(必填)
 */
router.post(
    '/delete',
    validationMiddleware(OrderIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as OrderIdDto;
        const result = await salesOrderService.delete(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
