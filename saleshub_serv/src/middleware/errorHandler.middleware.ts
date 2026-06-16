import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.util';
import { getLogger } from '../utils/logger.util';

const logger = getLogger('CARD_SERV');

/**
 * 全局错误处理中间件
 */
export function errorHandlerMiddleware(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // 记录错误
    logger.error('错误发生', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
    });

    // 处理自定义错误
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            result: error.ret_code,
            msg: error.ret_msg,
            alg: '',
            datas: {},
        });
        return;
    }

    // 处理TypeORM错误
    if (error.name === 'QueryFailedError') {
        res.json({
            result: 5000,
            msg: '数据库操作失败',
            alg: '',
            datas: {},
        });
        return;
    }

    // 处理JWT错误
    if (error.name === 'JsonWebTokenError') {
        res.json({
            result: 2001,
            msg: '无效的Token',
            alg: '',
            datas: {},
        });
        return;
    }

    if (error.name === 'TokenExpiredError') {
        res.json({
            result: 2001,
            msg: 'Token已过期',
            alg: '',
            datas: {},
        });
        return;
    }

    // 处理其他未捕获错误
    logger.error('未处理的错误', error);
    res.json({
        result: 5000,
        msg: '服务器内部错误',
        alg: '',
        datas: {},
    });
}

/**
 * 404处理中间件
 */
export function notFoundMiddleware(req: Request, res: Response): void {
    res.status(404).json({
        result: 404,
        msg: `路径 ${req.originalUrl} 不存在`,
        alg: '',
        datas: {},
    });
}

/**
 * 异步错误包装器
 */
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
