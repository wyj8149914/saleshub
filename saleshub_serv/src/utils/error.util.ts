/**
 * 自定义错误基类
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly ret_code: number;
  public readonly ret_msg: string;

  constructor(statusCode: number, ret_code: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.ret_code = ret_code;
    this.ret_msg = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - 参数错误
 */
export class BadRequestError extends AppError {
  constructor(message: string = '参数错误') {
    super(400, 9001, message);
  }
}

/**
 * 401 - 未授权
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = '未授权') {
    super(401, 2001, message);
  }
}

/**
 * 403 - 禁止访问
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '禁止访问') {
    super(403, 2002, message);
  }
}

/**
 * 404 - 资源不存在
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(404, 4004, message);
  }
}

/**
 * 409 - 资源冲突
 */
export class ConflictError extends AppError {
  constructor(message: string = '资源冲突') {
    super(409, 4009, message);
  }
}

/**
 * 422 - 验证错误
 */
export class ValidationError extends AppError {
  public readonly errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(422, 9002, message);
    this.errors = errors;
  }
}

/**
 * 500 - 服务器错误
 */
export class InternalServerError extends AppError {
  constructor(message: string = '服务器内部错误') {
    super(500, 5000, message);
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessError extends AppError {
  constructor(ret_code: number, message: string) {
    super(400, ret_code, message);
  }
}

// 错误码常量
export const ERROR_CODES = {
  // 认证相关 (2001-2999)
  UNAUTHORIZED: 2001,
  FORBIDDEN: 2002,
  TOKEN_EXPIRED: 2003,
  TOKEN_INVALID: 2004,

  // 用户相关 (3001-3999)
  USER_NOT_FOUND: 3001,
  USER_DISABLED: 3002,
  USER_ALREADY_EXISTS: 3003,

  // 名片相关 (4001-4999)
  CARD_NOT_FOUND: 4001,
  CARD_LIMIT_EXCEEDED: 4002,
  CARD_ALREADY_EXISTS: 4003,

  // 会员相关 (5001-5999)
  MEMBERSHIP_EXPIRED: 5001,
  MEMBERSHIP_NOT_FOUND: 5002,
  PLAN_NOT_FOUND: 5003,

  // 订单相关 (6001-6999)
  ORDER_NOT_FOUND: 6001,
  ORDER_ALREADY_PAID: 6002,
  PAYMENT_FAILED: 6003,

  // 文件上传相关 (8001-8999)
  FILE_TOO_LARGE: 8001,
  FILE_TYPE_NOT_ALLOWED: 8002,
  UPLOAD_FAILED: 8003,

  // 参数验证相关 (9001-9999)
  BAD_REQUEST: 9001,
  VALIDATION_ERROR: 9002,
  INTERNAL_SERVER_ERROR: 5000,
};
