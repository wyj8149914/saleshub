/*
 * @Descripttion: 中间件
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2021-11-01 13:54:42
 */

import { Request, Response, NextFunction } from 'express';

import { getLogger } from '../utils/logger.util';
import { decrypt } from '../utils/util';
import { appConfig } from '../config/env.config';
import { v7 } from 'uuid';
import { runWithRequestContext } from '../context/requestContext';

const MAXLOGLENGTH = 50000;

function resolveRequestId(req: Request): string {
    const fromHeader = req.get('x-request-id')?.trim() ?? req.get('x-trace-id')?.trim();
    if (fromHeader) {
        return fromHeader;
    }
    return v7().replace(/-/g, '');
}

/**
 * @description: 路由前中间件,主要用来参数解密,记录请求日志,上报监控
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @return {*}
 */
export async function requestLogger(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = resolveRequestId(req);

    runWithRequestContext({ requestId }, () => {
        const logger = getLogger('CARD_SERV');
        // 参数加解密处理
        const aesKey = res.locals.aesKey;
        const dntEncrypt = res.locals.dntEncrypt;
        let encryptError = false;

        if (req.query.employeeId) {
            res.locals.employeeId = req.query.employeeId;
        }

        // 如果dntEncrypt为true,则不需要解密
        if (dntEncrypt) {
            if (req.method === 'POST') {
                try {
                    req.body = req.body.datas ? req.body.datas : req.body;
                    req.body.companyId = res.locals.companyId;
                    req.body.employeeId = res.locals.employeeId;
                    logger.info(`开发环境请求头中dev_key正确,Post请求不需要解密`);
                } catch (error: any) {
                    logger.error(`开发环境请求头中dev_key正确,Post请求不需要解密: aesKey: ${aesKey}, error: ${error.message}`);
                    encryptError = true;
                }
            }
            if (req.method === 'GET') {
                req.query.companyId = res.locals.companyId;
                req.query.employeeId = res.locals.employeeId;
                logger.info(`开发环境请求头中dev_key正确,Get请求不需要解密`);
            }
        } else {
            if (req.method === 'POST' && req.body.alg) {
                // Post请求需要解密
                logger.info(`Post请求需要解密: ${JSON.stringify(req.body.datas)}`);
                try {
                    const decryptData = decrypt(req.body.datas, aesKey);
                    req.body = JSON.parse(decryptData);
                    // 加密数据时从res.locals取出companyId和employeeId
                    req.body.companyId = res.locals.companyId;
                    req.body.employeeId = res.locals.employeeId;
                } catch (error: any) {
                    logger.error(`参数解密失败: aesKey: ${aesKey}, error: ${error.message}`);
                    encryptError = true;
                }
            } else if (req.method === 'POST' && !req.body.alg) {
                // Post请求不需要解密
                req.body = req.body.datas ? req.body.datas : req.body;
                req.body.companyId = res.locals.companyId;
                req.body.employeeId = res.locals.employeeId;
                logger.info(`Post请求不需要解密: ${req.body.datas}`);
            } else {
                req.query.companyId = res.locals.companyId;
                req.query.employeeId = res.locals.employeeId;
                // Get请求根据参数名称判断是否需要解密
                const { encryptParams } = appConfig.requestEncrypt;
                for (let params in req.query) {
                    if (encryptParams.includes(params) && req.query[params]) {
                        logger.info(`参数需要解密: ${params} - 值: ${req.query[params]}`);
                        try {
                            const decryptData = decrypt(req.query[params] as string, aesKey);
                            req.query[params] = decryptData;
                            logger.info(`参数解密成功: ${params} - 解密后:${decryptData}`);
                        } catch (error) {
                            logger.error(`参数解密失败: ${params} - 值: ${req.query[params]}, aesKey: ${aesKey}`);
                            encryptError = true;
                        }
                    }
                }
            }
        }

        // 请求日志记录
        const start = Date.now();
        const reqData = JSON.stringify(req.body) === '{}' ? JSON.stringify(req.query) : JSON.stringify(req.body);
        const logData = filterBase64Data(reqData);
        logger.info(`Request Started: ${req.method} ${req.originalUrl} - RequestData: ${logData}`);

        // 响应完成记录日志
        res.on('finish', () => {
            const duration = Date.now() - start;
            const result = res.locals.datas;
            const dntLog = res.locals.dntLog;

            if (!dntLog) {
                const logData = filterBase64Data(result);
                logger.info(`Request Completed: ${req.method} ${req.originalUrl}  - Status: ${res.statusCode} - Duration: ${duration} ms - \nResponseData: ${JSON.stringify(logData)}`);
            } else {
                logger.info(`Request Completed: ${req.method} ${req.originalUrl}  - Status: ${res.statusCode} - Duration: ${duration} ms`);
            }
        });

        // 如果参数解密失败,返回52
        if (encryptError) {
            res.json({ result: 52, msg: '参数包含需要加密字段,解密失败' });
        } else {
            next();
        }
    });
}

/**
 * 过滤日志数据中的超过MAXLOGLENGTH的数据,请求中会有base64图片
 * @param data 需要记录的数据
 * @returns 过滤后的数据
 */
function filterBase64Data(data: any): any {
    if (typeof data === 'string') {
        // 如果是base64字符串，替换为提示信息
        if (data.length > MAXLOGLENGTH) {
            return '[BASE64_IMAGE]';
        }
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => filterBase64Data(item));
    }

    if (typeof data === 'object' && data !== null) {
        const filtered: any = {};
        for (const key in data) {
            // 如果值是字符串且长度大于MAXLOGLENGTH，则替换
            if (typeof data[key] === 'string' && data[key].length > MAXLOGLENGTH) {
                filtered[key] = '[BASE64_IMAGE]';
            } else if (Array.isArray(data[key])) {
                // 如果是数组，检查每个元素
                filtered[key] = data[key].map((item: any) =>
                    typeof item === 'string' && item.length > MAXLOGLENGTH ? '[BASE64_IMAGE]' : item
                );
            } else {
                filtered[key] = filterBase64Data(data[key]);
            }

        }
        return filtered;
    }

    return data;
}
