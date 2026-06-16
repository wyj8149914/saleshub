import log4js from 'log4js';
import { appConfig } from './env.config';

const categoryLevel = appConfig.logLevel?.trim() || 'INFO';

const consoleLayout = {
    type: 'pattern',
    pattern: '%[[%d{ISO8601}] [%p] %c -%] %m',
};

const dateFileCommon = {
    type: 'dateFile',
    maxLogSize: '100M',
    numBackups: 1000,
    encoding: 'utf-8',
    keepFileExt: true,
    pattern: 'yyyy-MM-dd',
    alwaysIncludePattern: true,
    // layout: fileLayout,
};

/**
 * 同一 category 下多路输出：
 * - console：按 categoryLevel 输出所有级别
 * - infoFiltered：仅 trace～warn 写入 info 日志（含 info / warn，不含 error）
 * - errorFiltered：仅 error～fatal 写入 error 日志
 */
export const loggerConfig = {
    appenders: {
        console: {
            type: 'console',
            layout: consoleLayout,
        },
        infoFile: {
            ...dateFileCommon,
            filename: './logs/info.log',
        },
        errorFile: {
            ...dateFileCommon,
            filename: './logs/error.log',
        },
        infoFiltered: {
            type: 'logLevelFilter',
            appender: 'infoFile',
            level: 'trace',
            maxLevel: 'warn',
        },
        errorFiltered: {
            type: 'logLevelFilter',
            appender: 'errorFile',
            level: 'error',
            maxLevel: 'fatal',
        },
    },
    categories: {
        default: {
            appenders: ['console', 'infoFiltered', 'errorFiltered'],
            level: categoryLevel,
        },
    },
};
