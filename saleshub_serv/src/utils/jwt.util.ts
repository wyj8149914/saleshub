import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.config';

const { secret, expires, refreshTokenExpires } = appConfig.jwt;
export interface JwtPayload {
    sub: string; // user id
    openid?: string;
    iat?: number;
    exp?: number;
}

export class JwtUtil {
    /**
     * 生成JWT Token
     */
    static sign(payload: JwtPayload, expiresIn: number = expires): string {
        return jwt.sign(payload, secret, {
            expiresIn,
        });
    }

    /**
     * 验证JWT Token
     */
    static verify(token: string): JwtPayload {
        const decoded = jwt.verify(token, secret) as JwtPayload;
        return decoded;
    }

    /**
     * 生成刷新Token
     */
    static signRefreshToken(payload: JwtPayload): string {
        return jwt.sign(payload, secret, {
            expiresIn: refreshTokenExpires,
        });
    }

    /**
     * 解码Token（不验证）
     */
    static decode(token: string): JwtPayload | null {
        try {
            const decoded = jwt.decode(token) as JwtPayload;
            return decoded;
        } catch (error) {
            console.error('JWT解码失败:', error);
            return null;
        }
    }
}
