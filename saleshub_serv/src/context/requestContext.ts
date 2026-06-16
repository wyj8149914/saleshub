import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
    requestId: string;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();

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
