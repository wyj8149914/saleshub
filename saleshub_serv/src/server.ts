import 'reflect-metadata';
import { createApp } from './app';
import { initializeDatabase } from './config/database.config';
import { appConfig } from './config/env.config';
import { getLogger } from './utils/logger.util';

const logger = getLogger('SALESHUB_SERV');

/**
 * 启动服务器
 */
async function startServer(): Promise<void> {
    try {
        // 初始化数据库
        logger.info('正在连接数据库...');
        await initializeDatabase();

        // 初始化MinIO
        // logger.info('正在初始化MinIO...');
        // await initializeMinIO();

        // 创建Express应用
        const app = createApp();

        // 启动HTTP服务器
        app.listen(appConfig.port, () => {
            logger.info(`🚀 服务器启动成功`);
            logger.info(`📝 环境: ${process.env.NODE_ENV}`);
            logger.info(`🌐 端口: ${appConfig.port}`);
            logger.info(`🏥 健康检查: http://localhost:${appConfig.port}/health`);
            // logger.info(`📚 调试模式: ${process.env.DEBUG ? '开启' : '关闭'}`);
        });

        // 未捕获的异常
        process.on('uncaughtException', (error) => {
            logger.error('未捕获的异常', error);
            process.exit(1);
        });

        // 未处理的Promise拒绝
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未处理的Promise拒绝', { reason, promise });
        });

    } catch (error) {
        logger.error('服务器启动失败', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();
