import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import {
    BindInvoiceDto,
    CreateExpenseDto,
    ExpenseIdDto,
    ListExpenseDto,
    UpdateExpenseDto,
} from '../dto/expense.dto';
import { expenseService } from '../service/expense';

const router = Router();

/**
 * POST /create
 * 新建支出费用单:
 * - 类型1-有发票采购:先调已有 /invoice/upload 上传识别发票入库,回填其 invoice_id,
 *   并传采购来源渠道 channel 与采购明细 items(1~100行)
 * - 类型2-无发票支出:仅传金额/分类/收款方/付款方式
 * Body: expense_type-费用类型(必填), user_id-创建人(必填), amount-支出金额(必填),
 *       expense_date-支出日期YYYY-MM-DD(必填), invoice_id/channel/category/payee/
 *       payment_method/remark/items-按类型见DTO说明
 */
router.post(
    '/create',
    validationMiddleware(CreateExpenseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // validationMiddleware 已将校验通过的 DTO 回写到 req.body
        const dto = req.body as CreateExpenseDto;
        const result = await expenseService.create(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /update
 * 修改支出费用单:仅正常状态费用单可修改,费用类型与编号不可改,仅更新传入字段;
 * 类型1传 items 时整批替换采购明细,传 invoice_id 时换绑发票
 * Body: expense_id-费用单ID(必填), 其余字段见 DTO(均可选)
 */
router.post(
    '/update',
    validationMiddleware(UpdateExpenseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as UpdateExpenseDto;
        const result = await expenseService.update(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /list
 * 分页查询支出费用单列表:只查正常状态,左联发票带出号码与价税合计
 * Query: pageIndex/pageSize-分页(必填), expense_type-费用类型, channel-采购渠道,
 *       category-支出分类, payment_method-付款方式, start_date/end_date-支出日期区间(含当天),
 *       keyword-关键字(费用单编号/收款方模糊)
 */
router.get(
    '/list',
    validationMiddleware(ListExpenseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListExpenseDto, req.query);
        const result = await expenseService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /detail
 * 支出费用单详情:返回业务字段、采购明细行及关联发票摘要(含发票文件预览地址)
 * Query: expense_id-费用单ID(必填)
 */
router.get(
    '/detail',
    validationMiddleware(ExpenseIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ExpenseIdDto, req.query);
        const result = await expenseService.detail(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /bindInvoice
 * 支出费用单关联发票:上传发票复用已有 /invoice/upload 识别入库,
 * 拿到 invoice_id 后调本接口回填;发票与费用单 1:1,重复关联幂等
 * Body: expense_id-费用单ID(必填), invoice_id-发票ID(必填)
 */
router.post(
    '/bindInvoice',
    validationMiddleware(BindInvoiceDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as BindInvoiceDto;
        const result = await expenseService.bindInvoice(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
