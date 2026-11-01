import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';

/** 校验错误信息对象(constraints 的键为校验规则名,值为提示文案) */
type ValidationConstraints = Record<string, string>;

export function validationMiddleware(type: ClassConstructor<object>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const dtoObj = plainToInstance(type, params);
            const errors = await validate(dtoObj);

            if (errors.length > 0) {
                const msg: ValidationConstraints[] = [];
                handleErrorRecursive(errors, msg);
                // const result = { result: 1, msg: msg }
                const allValues = msg.map((obj) => Object.values(obj)).flat();
                res.locals.datas = { result: 1, msg: allValues.join(',') };
                return res.json({ result: 1, msg: allValues.join(',') });
            } else {
                if (req.method === 'POST') {
                    req.body = dtoObj;
                }
                next();
            }
        } catch (error) {
            next(error);
        }
    };
}

export function handleErrorRecursive(errors: ValidationError[], msg: ValidationConstraints[] = []) {
    if (errors.length > 0) {
        errors.forEach((error) => {
            // error.constraints 包含了具体的错误提示
            if (error.constraints) {
                // const errorData = {
                //     field: error.property,
                //     message: Object.values(error.constraints)[0],
                //     value: error.value
                // }
                msg.push(error.constraints);
                // msg.push(errorData)
            }

            // 如果是嵌套对象的错误，可以递归处理 children
            if (error.children && error.children.length > 0) {
                handleErrorRecursive(error.children, msg);
            }
        });
    }

    return msg;
}
