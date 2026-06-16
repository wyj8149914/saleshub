/*
 * @Descripttion: redis操作
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2021-03-30 11:29:17
 */
'use strict';

import { RedisClientType, createClient } from 'redis';
import { appConfig } from '../config/env.config';
import { getLogger } from '../utils/logger.util';

const logger = getLogger('CARD_SERV');
const { redis } = appConfig;

export class RedisManager {
    private static instance: RedisManager | null = null;
    private client: RedisClientType | null = null;
    private connecting: Promise<RedisClientType> | null = null; // 连接锁

    // 私有构造函数，防止外部直接实例化
    private constructor() { }

    /**
     * @description: 获取RedisManager单例实例
     * @return {RedisManager} RedisManager实例
     */
    public static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
            logger.info('Created new RedisManager instance');
        }
        return RedisManager.instance;
    }

    /**
     * @description: 获取Redis客户端,已存在直接返回
     * @return {Promise<RedisClientType>} Redis客户端
     */
    private async getClient(): Promise<RedisClientType> {
        // 如果客户端已存在且连接正常，直接返回
        if (this.client && this.client.isOpen) {
            return this.client;
        }

        // 如果正在连接中，等待连接完成
        if (this.connecting) {
            return await this.connecting;
        }

        // 开始新的连接过程
        this.connecting = this.createConnection();

        try {
            const client = await this.connecting;
            this.connecting = null; // 连接完成，清除连接锁
            return client;
        } catch (error) {
            this.connecting = null; // 连接失败，清除连接锁
            this.client = null; // 重置客户端状态
            throw error;
        }
    }

    /**
     * @description: 创建新的Redis连接
     * @return {Promise<RedisClientType>} Redis客户端
     */
    private async createConnection(): Promise<RedisClientType> {
        try {
            logger.info('Creating new Redis connection');

            const { host, port, password, database } = redis;
            this.client = createClient({
                socket: { host: host, port: port },
                password: password,
                database: database
            });

            // 设置错误处理
            this.client.on('error', (err) => {
                logger.error('Redis Client Error', err);
                this.client = null; // 在出错时重置客户端
            });

            // 设置断线重连处理
            this.client.on('end', () => {
                logger.info('Redis connection ended');
                this.client = null;
            });

            this.client.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
            });

            await this.client.connect();
            logger.info('Redis connection established successfully');

            return this.client;
        } catch (error) {
            logger.error('Failed to create Redis connection:', error);
            this.client = null;
            throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * @description: 关闭Redis连接
     * @return {Promise<void>}
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client && this.client.isOpen) {
                await this.client.disconnect();
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis connection:', error);
        } finally {
            this.client = null;
            this.connecting = null;
        }
    }

    /**
     * @description: 设置redis key-value
     * @param {string} key: redis key
     * @param {string} value: redis value
     * @param {number} expire: 设置过期时间,单位为秒
     * @return {Promise<string>} redis value
     */
    async set(key: string, value: string, expire: number = 0) {
        const client = await this.getClient();
        const result = expire === 0 ? await client.set(key, value) : await client.set(key, value, { EX: expire });
        return result;
    }

    /**
     * @description: 获取指定key的value
     * @param {string} key: redis key
     * @return {Promise<string | null>} 返回与key关联的value，如果key不存在则返回null
     */
    async get(key: string) {
        const client = await this.getClient();
        return await client.get(key);
    }

    async ttl(key: string) {
        const client = await this.getClient();
        return await client.ttl(key);
    }
}

// 导出单例实例，方便其他模块直接使用
export const redisManager = RedisManager.getInstance();
