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
 * express.json / urlencoded 不解析 multipart,req.body 要等路由上的 multer 执行后才有文本字段
 */
function isMultipartFormData(req: Request): boolean {
    const contentType = req.get('content-type') ?? '';
    return contentType.toLowerCase().includes('multipart/form-data');
}

/**
 * @description: 路由前中间件,主要用来参数解密,记录请求日志,上报监控
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @return {*}
 */
export async function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const requestId = resolveRequestId(req);

    runWithRequestContext({ requestId }, () => {
        const logger = getLogger('SALESHUB_SERV');
        // 参数加解密处理
        const aesKey = res.locals.aesKey;
        const dntEncrypt = res.locals.dntEncrypt;
        let encryptError = false;

        if (req.query.employeeId) {
            res.locals.employeeId = req.query.employeeId;
        }

        // multipart 由路由 multer 解析,此处 req.body 尚未生成,且 multer 会重建 req.body
        const multipart = isMultipartFormData(req);

        // 如果dntEncrypt为true,则不需要解密
        if (multipart) {
            logger.info('Post请求为 multipart/form-data,表单字段由路由 multer 解析后再记录');
        } else if (dntEncrypt) {
            if (req.method === 'POST') {
                try {
                    req.body = req.body.datas ? req.body.datas : req.body;
                    req.body.companyId = res.locals.companyId;
                    req.body.employeeId = res.locals.employeeId;
                    logger.info(`开发环境请求头中dev_key正确,Post请求不需要解密`);
                } catch (error) {
                    logger.error(
                        `开发环境请求头中dev_key正确,Post请求不需要解密: aesKey: ${aesKey}, error: ${(error as Error).message}`
                    );
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
                } catch (error) {
                    logger.error(
                        `参数解密失败: aesKey: ${aesKey}, error: ${(error as Error).message}`
                    );
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
                for (const params in req.query) {
                    if (encryptParams.includes(params) && req.query[params]) {
                        logger.info(`参数需要解密: ${params} - 值: ${req.query[params]}`);
                        try {
                            const decryptData = decrypt(req.query[params] as string, aesKey);
                            req.query[params] = decryptData;
                            logger.info(`参数解密成功: ${params} - 解密后:${decryptData}`);
                        } catch {
                            logger.error(
                                `参数解密失败: ${params} - 值: ${req.query[params]}, aesKey: ${aesKey}`
                            );
                            encryptError = true;
                        }
                    }
                }
            }
        }

        // 请求日志记录
        const start = Date.now();
        if (multipart) {
            // 此时流还未被 multer 消费,body 为空;字段在响应结束时再记
            logger.info(
                `Request Started: ${req.method} ${req.originalUrl} - RequestData: multipart/form-data`
            );
        } else {
            const reqData =
                JSON.stringify(req.body) === '{}'
                    ? JSON.stringify(req.query)
                    : JSON.stringify(req.body);
            const logData = filterBase64Data(reqData);
            logger.info(
                `Request Started: ${req.method} ${req.originalUrl} - RequestData: ${logData}`
            );
        }

        // 响应完成记录日志
        res.on('finish', () => {
            const duration = Date.now() - start;
            if (multipart) {
                const requestData = JSON.stringify(req.body);
                logger.info(
                    `Request Params: ${req.method} ${req.originalUrl} - RequestData: ${requestData}`
                );
            }
            const result = res.locals.datas;
            const dntLog = res.locals.dntLog;

            if (!dntLog) {
                const logData = filterBase64Data(result);
                logger.info(
                    `Request Completed: ${req.method} ${req.originalUrl}  - Status: ${res.statusCode} - Duration: ${duration} ms - \nResponseData: ${JSON.stringify(logData)}`
                );
            } else {
                logger.info(
                    `Request Completed: ${req.method} ${req.originalUrl}  - Status: ${res.statusCode} - Duration: ${duration} ms`
                );
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
function filterBase64Data(data: unknown): unknown {
    if (typeof data === 'string') {
        // 如果是base64字符串，替换为提示信息
        if (data.length > MAXLOGLENGTH) {
            return '[BASE64_IMAGE]';
        }
        return data;
    }

    if (Array.isArray(data)) {
        return data.map((item) => filterBase64Data(item));
    }

    if (typeof data === 'object' && data !== null) {
        const source = data as Record<string, unknown>;
        const filtered: Record<string, unknown> = {};
        for (const key in source) {
            const value = source[key];
            // 如果值是字符串且长度大于MAXLOGLENGTH，则替换
            if (typeof value === 'string' && value.length > MAXLOGLENGTH) {
                filtered[key] = '[BASE64_IMAGE]';
            } else if (Array.isArray(value)) {
                // 如果是数组，检查每个元素
                filtered[key] = value.map((item) =>
                    typeof item === 'string' && item.length > MAXLOGLENGTH ? '[BASE64_IMAGE]' : item
                );
            } else {
                filtered[key] = filterBase64Data(value);
            }
        }
        return filtered;
    }

    return data;
}
