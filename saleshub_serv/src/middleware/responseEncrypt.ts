/*
 * @Descripttion: 中间件
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2021-11-01 13:54:42
 */

import { Request, Response, NextFunction } from 'express';

import { getLogger } from '../utils/logger.util';
import { encryption } from '../utils/util';

/**
 * @description: 路由后中间件,主要用来响应加密
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @return {*}
 */
export async function responseEncrypt(req: Request, res: Response, next: NextFunction): Promise<void> {
    const result = res.locals.datas;
    if (result === undefined || result === null) {
        return next();
    }

    const logger = getLogger('SALESHUB_SERV');
    const dntEncrypt = res.locals.dntEncrypt;
    if (result.alg && !dntEncrypt) {
        const aesKey = res.locals.aesKey;
        if (!aesKey) {
            logger.error('未获取到密钥');
            res.locals.datas = { result: -1, msg: '未获取到密钥' };
        } else {
            logger.info(`响应数据需要加密,aes密钥:${aesKey}, 加密前数据:`, JSON.stringify(result));
            const datas = result.datas;
            if (datas) {
                const encryptDatas = encryption(JSON.stringify(datas), aesKey);
                result.datas = encryptDatas;
                res.locals.dntLog = true;
            }
        }
    }

    res.json(res.locals.datas);
}
