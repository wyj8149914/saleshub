import { DataSource, DataSourceOptions } from 'typeorm';
import { appConfig } from './env.config';
import * as path from 'path';
import { getLogger } from '../utils/logger.util';

const logger = getLogger('SALESHUB');
const { db } = appConfig;
export const databaseConfig: DataSourceOptions = {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    synchronize: false,
    logging: false,
    entities: [path.join(__dirname, '../entity/*.{js,ts}')],
    // migrations: [path.join(__dirname, '..', 'migration', '**', '*.ts')],
    // subscribers: [path.join(__dirname, '..', 'subscriber', '**', '*.ts')],
    // 连接池配置
    poolSize: 10,
    connectTimeoutMS: 10000,
    extra: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    },
};

// 创建数据源实例
export const AppDataSource = new DataSource(databaseConfig);

// 初始化数据库连接
export async function initializeDatabase(): Promise<void> {
    try {
        await AppDataSource.initialize();
        logger.info('✅ 数据库连接成功');
    } catch (error) {
        logger.error('❌ 数据库连接失败:', error);
        throw error;
    }
}
