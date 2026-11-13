import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import {
    ListLoginLogDto,
    QueryOperationLogListDto,
    QueryOperationLogDetailDto,
} from '../dto/log.dto';
import { logService, operationLogService } from '../service/log';

const router = Router();

/**
 * GET /listLogin
 * 分页查询登录日志:按登录时间降序
 * Query: pageIndex/pageSize-分页(必填), username-用户名(模糊), result-登录结果(1-成功/2-失败),
 *       ip-登录IP(模糊), start_time/end_time-登录时间区间(含当天,YYYY-MM-DD)
 */
router.get(
    '/listLogin',
    validationMiddleware(ListLoginLogDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListLoginLogDto, req.query);
        const result = await logService.listLogin(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /list
 * 分页查询操作日志(仅管理员):按操作时间降序
 * Query: user_id-请求者用户ID(权限校验,必填), pageIndex/pageSize-分页(必填),
 *       operation_type-操作大类, operation_code-操作代码, operator_name-操作人姓名,
 *       target_name-对象名称, operation_result-操作结果(1-成功/2-失败),
 *       keyword-关键字(操作说明/对象名称模糊), time_start/time_end-操作时间区间(含当天,YYYY-MM-DD)
 */
router.get(
    '/list',
    validationMiddleware(QueryOperationLogListDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(QueryOperationLogListDto, req.query);
        const result = await operationLogService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /detail
 * 操作日志详情(仅管理员):含变更前后值与附加数据等全部字段
 * Query: user_id-请求者用户ID(权限校验,必填), log_id-日志ID(必填)
 */
router.get(
    '/detail',
    validationMiddleware(QueryOperationLogDetailDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(QueryOperationLogDetailDto, req.query);
        const result = await operationLogService.detail(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
