import { AsyncLocalStorage } from 'async_hooks';
import { getLogger } from '../utils/logger.util';
import { AppError } from '../utils/error.util';

export type RequestHttpMeta = {
    ipAddress?: string;
    requestMethod?: string;
    requestPath?: string;
    userAgent?: string;
};

export type RequestContextStore = {
    requestId: string;
    userId?: string;
    http?: RequestHttpMeta;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();
// 惰性获取:避免与 logger.util(其内部反向导入本模块)形成模块初始化循环依赖
let contextLogger: ReturnType<typeof getLogger> | undefined;
function getLoggerLazy(): ReturnType<typeof getLogger> {
    if (!contextLogger) {
        contextLogger = getLogger('context');
    }
    return contextLogger;
}

/**
 * 在指定请求上下文中执行后续中间件与路由（含其 async/await 链路）。
 */
export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
    return requestContext.run(store, fn);
}

/** 当前异步链路上的 requestId；无上下文（如启动脚本）时返回 undefined */
export function getRequestId(): string | undefined {
    return requestContext.getStore()?.requestId;
}

export function getRequestContext(): RequestContextStore | undefined {
    return requestContext.getStore();
}

/** JWT 中间件调用：注入 employeeId */
export function setUserId(userId?: string): void {
    const store = requestContext.getStore();
    if (!store) throw new AppError(401, 401, 'setUserId called outside of request context');
    store.userId = userId ?? undefined;
}

/**
 * 强制获取 userId（Service 层推荐使用）。
 * 如果当前请求未携带有效 Token 导致没有 userId，直接抛出异常，阻断业务。
 */
export function requireUserId(): string {
    const userId = requestContext.getStore()?.userId;
    if (!userId) {
        throw new AppError(401, 401, '未获取到用户信息,请重新登录');
    }
    getLoggerLazy().info(`requireUserId: ${userId}`);
    return userId;
}

/** JWT / 网关解析后写入，供操作审计自动补全 IP、路径等 */
export function setRequestHttpMeta(meta: RequestHttpMeta): void {
    const store = requestContext.getStore();
    if (!store) {
        return;
    }
    store.http = { ...store.http, ...meta };
}

export function getRequestMeta(): RequestHttpMeta {
    return requestContext.getStore()?.http ?? {};
}
