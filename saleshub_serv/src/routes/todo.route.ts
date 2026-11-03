import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import {
    CompleteTodoDto,
    CreateTodoDto,
    CreateTodoTypeDto,
    ListTodoDto,
    ListTodoTypeDto,
    PostponeTodoDto,
    TodoIdDto,
    TodoTypeIdDto,
    UpdateTodoDto,
} from '../dto/todo.dto';
import { todoService, todoTypeService } from '../service/todo';

const router = Router();

// ==================== 待办事项 ====================

/**
 * POST /create
 * 新建待办事项:执行人多选,初始为未完成状态,
 * 剩余天数由截止日期查询时计算,不落库
 * Body: title-名称(必填), priority-重要程度1~4(必填), deadline-截止日期YYYY-MM-DD(必填),
 *       executor_ids-执行人ID列表(必填,至少1个), type_id/attachments/remark-可选, user_id-创建人(必填)
 */
router.post(
    '/create',
    validationMiddleware(CreateTodoDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // validationMiddleware 已将校验通过的 DTO 回写到 req.body
        const dto = req.body as CreateTodoDto;
        const result = await todoService.create(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /update
 * 修改待办事项:仅正常状态待办可修改,创建人不可改;
 * 全部业务字段可选,仅更新传入字段;executor_ids 传入时整体替换执行人;
 * 直接修改截止日期不产生延期记录,延期请走 /postpone
 * Body: todo_id-待办ID(必填), 其余字段见 DTO(均可选)
 */
router.post(
    '/update',
    validationMiddleware(UpdateTodoDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as UpdateTodoDto;
        const result = await todoService.update(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /list
 * 分页查询待办事项列表:只查正常状态待办,剩余天数=截止日期-当前日期(负数表示已过期)
 * Query: pageIndex/pageSize-分页(必填), executor_id-执行人("我的待办"), type_id-类型,
 *       priority-重要程度, is_completed-是否完成, start_date/end_date-截止日期区间(含当天),
 *       keyword-关键字(名称模糊)
 */
router.get(
    '/list',
    validationMiddleware(ListTodoDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListTodoDto, req.query);
        const result = await todoService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /detail
 * 待办事项详情:返回全部业务字段、执行人列表、延期记录列表、剩余天数
 * Query: todo_id-待办ID(必填)
 */
router.get(
    '/detail',
    validationMiddleware(TodoIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(TodoIdDto, req.query);
        const result = await todoService.detail(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /complete
 * 待办完成状态变更:整条待办的总体状态,任意执行人或管理员操作;
 * 标记完成写入完成时间,取消完成清空完成时间
 * Body: todo_id-待办ID(必填), is_completed-1-否/2-是(必填)
 */
router.post(
    '/complete',
    validationMiddleware(CompleteTodoDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as CompleteTodoDto;
        const result = await todoService.complete(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /postpone
 * 待办延期:处理人和管理员可操作,需填写延期日期和原因;
 * 新截止日期必须晚于当前截止日期;事务内更新截止日期并插入延期记录
 * Body: todo_id-待办ID(必填), new_deadline-延期后截止日期YYYY-MM-DD(必填),
 *       reason-延期原因(必填), operator_id-操作人ID(必填)
 */
router.post(
    '/postpone',
    validationMiddleware(PostponeTodoDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as PostponeTodoDto;
        const result = await todoService.postpone(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /delete
 * 删除待办事项(软删除):主表 status 置为2,不再出现在列表/详情中
 * Body: todo_id-待办ID(必填)
 */
router.post(
    '/delete',
    validationMiddleware(TodoIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as TodoIdDto;
        const result = await todoService.delete(dto);
        res.locals.datas = result;
        next();
    })
);

// ==================== 待办类型 ====================

/**
 * POST /type/create
 * 新建待办类型:类型名全局唯一,重名返回错误
 * Body: type_name-类型名称(必填), user_id-创建人(必填)
 */
router.post(
    '/type/create',
    validationMiddleware(CreateTodoTypeDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as CreateTodoTypeDto;
        const result = await todoTypeService.create(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /type/list
 * 查询待办类型列表:只查正常状态,不分页(类型数量少)
 * Query: user_id-创建人(可选), keyword-类型名称模糊(可选)
 */
router.get(
    '/type/list',
    validationMiddleware(ListTodoTypeDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListTodoTypeDto, req.query);
        const result = await todoTypeService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /type/delete
 * 删除待办类型(软删除):type status 置为2,不再出现在列表中
 * Body: type_id-类型ID(必填)
 */
router.post(
    '/type/delete',
    validationMiddleware(TodoTypeIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as TodoTypeIdDto;
        const result = await todoTypeService.delete(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
