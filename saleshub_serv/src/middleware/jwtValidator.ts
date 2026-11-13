/*
 * @Descripttion: 中间件
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2021-11-01 13:54:42
 */

import { Request, Response, NextFunction } from 'express';

import { JwtUtil } from '../utils/jwt.util';
import { appConfig } from '../config/env.config';
import { setRequestHttpMeta, setUserId } from '../context/requestContext';

export async function jwtValidator(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = getClientIP(req);
    res.locals.ipAddress = ip;
    setRequestHttpMeta({
        ipAddress: ip,
        requestMethod: req.method,
        requestPath: req.originalUrl,
        userAgent: req.get('user-agent') ?? undefined,
    });
    try {
        const publicPath = appConfig.publicPath;
        const path = req.path;
        if (publicPath.includes(path)) {
            next();
            return;
        }
        const bearerToken = req.headers.authorization;
        const jwt = bearerToken?.split(' ')[1];
        if (jwt) {
            // 校验token合法性,失败时抛错进入catch
            const decoded = JwtUtil.verify(jwt) as { sub: string } | undefined;
            if (decoded) {
                setUserId(decoded.sub);
            }
        }
        next();
    } catch (error) {
        next(error);
    }
}

function getClientIP(req: Request) {
    // 优先级顺序
    let ip = // 1. 标准 Express 属性
        req.ip ||
        // 2. 代理链 IP 列表的第一个 IP
        (req.ips?.length > 0 && req.ips[0]) ||
        // 3. X-Forwarded-For 的第一个 IP
        req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
        // 4. 直接连接 IP
        req.socket?.remoteAddress ||
        // 5. 旧版 connection 对象
        req.connection?.remoteAddress ||
        'unknown';

    if (ip.startsWith('::ffff:')) {
        ip = ip.slice(7);
    }
    return ip;
}
