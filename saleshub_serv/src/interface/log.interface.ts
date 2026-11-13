/**
 * 操作日志写入参数(业务操作点调用 recordOperation 时传入)
 *
 * 请求相关信息(IP/HTTP方法/路径/User-Agent)不传时自动取请求上下文
 */
export interface LogData {
    /** 操作大类,如 PRODUCT/USER/ITEM/INVOICE/SYSTEM 等 */
    operationType: string;
    /** 操作代码,与业务枚举一致,如 create_product/update_product/delete_product */
    operationCode: string;
    /** 操作说明 */
    operationDesc: string;
    /** 操作人用户ID(不传时取请求上下文中的登录用户) */
    operatorId?: string;
    /** 操作对象类型,如 product/stock/warehouse */
    targetType?: string | null;
    /** 操作对象ID(批量操作无单一对象时传null) */
    targetId?: string | null;
    /** 操作对象名称 */
    targetName?: string | null;
    /** 变更前值(JSON字符串) */
    oldValue?: string | null;
    /** 变更后值(JSON字符串) */
    newValue?: string | null;
    /** 附加数据 */
    attachData?: Record<string, unknown> | null;
    /** 操作结果:1-成功,2-失败(默认1) */
    operationResult?: number;
    /** 失败信息 */
    errorMsg?: string | null;
    /** 操作IP */
    ipAddress?: string | null;
    /** HTTP方法 */
    requestMethod?: string | null;
    /** 请求路径 */
    requestPath?: string | null;
    /** User-Agent */
    userAgent?: string | null;
}
