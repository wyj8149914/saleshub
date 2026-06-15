import { Request, Response, NextFunction } from 'express';

/**
 * 异步处理器包装函数
 * 用于捕获异步路由中的错误并传递给错误处理中间件
 * @paramfn 异步函数
 * @returns 包装后的函数
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
