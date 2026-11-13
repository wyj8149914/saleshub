import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import {
    LoginDto,
    CreateUserDto,
    ListUserDto,
    UpdateUserDto,
    UpdateUserStatusDto,
    UpdateUserPasswordDto,
} from '../dto/user.dto';
import { userService } from '../service/auth';
import { logService } from '../service/log';
import { getClientIp } from '../utils/util';

const router = Router();

// 用户登录
router.post(
    '/login',
    validationMiddleware(LoginDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(LoginDto, req.body);
        const result = await userService.login(dtoObj);
        // 登录日志:成功与失败均记录,recordLogin 内部捕获异常,不影响登录响应
        const loginDatas = result.result === 0 && 'datas' in result ? result.datas : undefined;
        void logService.recordLogin({
            username: dtoObj.username,
            user_id: loginDatas?.user_id ?? null,
            result: result.result === 0 ? 1 : 2,
            fail_msg: result.result === 0 ? null : result.msg,
            ip: getClientIp(req),
            user_agent: (req.get('user-agent') ?? '').slice(0, 255) || null,
        });
        res.locals.datas = result;
        next();
    })
);

// 查询用户列表
router.get(
    '/listUsers',
    validationMiddleware(ListUserDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListUserDto, req.query);
        const result = await userService.list(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 创建用户
router.post(
    '/createUser',
    validationMiddleware(CreateUserDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(CreateUserDto, req.body);
        const result = await userService.create(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 更新用户信息
router.post(
    '/updateUser',
    validationMiddleware(UpdateUserDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateUserDto, req.body);
        const result = await userService.update(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 设置用户状态
router.post(
    '/updateUserStatus',
    validationMiddleware(UpdateUserStatusDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateUserStatusDto, req.body);
        const result = await userService.updateStatus(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 修改用户密码
router.post(
    '/updateUserPassword',
    validationMiddleware(UpdateUserPasswordDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateUserPasswordDto, req.body);
        const result = await userService.updatePassword(dtoObj);
        res.locals.datas = result;
        next();
    })
);

export default router;
