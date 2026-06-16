import log4js from 'log4js';
import { loggerConfig } from '../config/logger.config';
import { getRequestId } from '../context/requestContext';

log4js.configure(loggerConfig);
const loggerInstances = new Map<string, Logger>();

/**
 * 带分类名的封装日志器：与 log4js 的 category 对齐，便于检索；
 * 在请求上下文中自动合并 request_id。
 */
class Logger {
    private readonly log: ReturnType<typeof log4js.getLogger>;

    constructor(context: string) {
        const name = (context ?? '').trim() || 'app';
        this.log = log4js.getLogger(name);
    }

    info(message: string, ...args: unknown[]): void {
        const rid = getRequestId();
        if (rid) {
            this.log.info(`[${rid}]`, message, ...args);
        } else {
            this.log.info(message, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        const rid = getRequestId();
        if (rid) {
            this.log.warn(`[${rid}]`, message, ...args);
        } else {
            this.log.warn(message, ...args);
        }
    }

    debug(message: string, ...args: unknown[]): void {
        const rid = getRequestId();
        if (rid) {
            this.log.debug(`[${rid}]`, message, ...args);
        } else {
            this.log.debug(message, ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        const rid = getRequestId();
        if (rid) {
            this.log.error(`[${rid}]`, message, ...args);
        } else {
            this.log.error(message, ...args);
        }
    }
}

/**
 * 按 context 复用同一封装实例，避免重复创建；context 会 trim，空则回退为 `app`。
 */
export function getLogger(context: string): Logger {
    const key = (context ?? '').trim() || 'app';
    let inst = loggerInstances.get(key);
    if (!inst) {
        inst = new Logger(key);
        loggerInstances.set(key, inst);
    }
    return inst;
}