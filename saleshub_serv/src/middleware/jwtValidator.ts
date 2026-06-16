/*
 * @Descripttion: 中间件
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2021-11-01 13:54:42
 */

import { Request, Response, NextFunction } from 'express';

import { JwtUtil } from '../utils/jwt.util';

export async function jwtValidator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const jwt = req.headers.authorization;
        if (jwt) {
            const verifyData = JwtUtil.verify(jwt);
            // console.log('jwt数据:', verifyData);

        }
        next();
    } catch (error) {
        next(error);
    }
}

