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

const router = Router();

// 用户登录
router.post(
    '/login',
    validationMiddleware(LoginDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(LoginDto, req.body);
        const result = await userService.login(dtoObj);
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
