import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * DTO验证中间件工厂函数
 * @paramDtoClass DTO类
 * @returns Express中间件函数
 */
export function validationMiddleware(DtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 将请求体转换为DTO实例
      const dtoObj = plainToInstance(DtoClass, req.body);

      // 验证DTO
      const errors = await validate(dtoObj);

      if (errors.length > 0) {
        // 提取验证错误信息
        const errorMessages = errors.map(error => {
          return Object.values(error.constraints || {}).join(', ');
        }).join('; ');

        return res.status(400).json({
          result: 1,
          msg: `参数验证失败: ${errorMessages}`,
          alg: '',
          datas: null,
        });
      }

      // 将验证后的DTO对象附加到请求体
      req.body = dtoObj;
      next();
    } catch (error) {
      return res.status(400).json({
        result: 1,
        msg: '参数验证异常',
        alg: '',
        datas: null,
      });
    }
  };
}
