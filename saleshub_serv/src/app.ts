import express, { Application } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.middleware';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.middleware';
import { requestLogger } from './middleware/requestLogger';
import { responseEncrypt } from './middleware/responseEncrypt';
import { jwtValidator } from './middleware/jwtValidator';
import { initializeRoutes } from './routes';

/**
 * 创建Express应用
 */
export function createApp(): Application {
    const app = express();

    // 安全中间件
    app.use(helmet());

    // CORS
    app.use(corsMiddleware);

    // 压缩响应
    app.use(compression());

    // 解析请求体（须在 requestLogger / 路由之前）
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // 请求日志
    app.use(requestLogger);
    app.use(jwtValidator);

    // 健康检查
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });

    // API路由
    initializeRoutes(app);

    // 唯一响应出口：加密 + 输出 JSON
    app.use(responseEncrypt);

    // 404 / 全局错误：只写入 res.locals，不直接 res.json
    app.use(notFoundMiddleware);
    app.use(errorHandlerMiddleware);

    return app;
}
