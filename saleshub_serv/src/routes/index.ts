import { Application, Router } from 'express';
import inventoryRouter from './inventory.route';
import fileRouter from './file.route';
import userRouter from './user.route';
import { getLogger } from '../utils/logger.util';
import { appConfig } from '../config/env.config';
const logger = getLogger('CARD_SERV');

/**
 * 初始化所有路由
 */
export function initializeRoutes(app: Application): void {
    // API路由前缀
    const apiPrefix = appConfig.apiPrefix;

    // 健康检查路由
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });

    // TODO: 添加各个模块的路由
    app.use(`${apiPrefix}/inventory`, inventoryRouter);
    app.use(`${apiPrefix}/file`, fileRouter);
    app.use(`${apiPrefix}/user`, userRouter);

    logger.info('✅ 路由初始化完成');
}

// 导出路由器（供后续模块使用）
export const router = Router();
