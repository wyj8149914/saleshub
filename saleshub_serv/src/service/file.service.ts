import * as crypto from 'crypto';
import path from 'path';
import { QueryFailedError } from 'typeorm';
import { v7 } from 'uuid';
import { AppDataSource } from '../config/database.config';
import { minioConfig, uploadFile, deleteFile, generateFileUrl } from '../config/minio.config';
import { MinioFile } from '../entity/file.entity';
import { getLogger } from '../utils/logger.util';
import dayjs from 'dayjs';

interface UploadFileInput {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

interface UploadResult {
    result: number;
    msg: string;
    datas?: {
        relation_id: string;
        url: string;
        hash: string;
        is_duplicate: boolean;
    };
}

interface DeleteResult {
    result: number;
    msg: string;
}

class FileService {
    private fileRepository = AppDataSource.getRepository(MinioFile);
    private logger = getLogger('SALESHUB_SERV');

    /**
     * 上传文件到 MinIO 并登记到 file 表
     * - hash 全局唯一,命中已有记录直接返回(软删则激活)
     * - 未命中:上传 MinIO + 插表;并发 UNIQUE 冲突时回查 + 清理对象补偿
     */
    async upload(file: UploadFileInput): Promise<UploadResult> {
        try {
            const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
            const existing = await this.fileRepository.findOne({ where: { hash } });
            if (existing) {
                if (existing.status === 2) {
                    existing.status = 1;
                    existing.update_time = new Date();
                    await this.fileRepository.save(existing);
                }
                this.logger.info(`文件上传命中已有记录，hash=${hash}`);
                return {
                    result: 0,
                    msg: '上传成功',
                    datas: {
                        relation_id: existing.relation_id,
                        url: generateFileUrl(existing.object_name),
                        hash,
                        is_duplicate: true,
                    },
                };
            }

            const ext = path.extname(file.originalname).slice(1);
            const dateString = dayjs().format('YYYYMM');
            const objectName = `${dateString}/${hash}${ext ? '.' + ext : ''}`;
            const bucket = minioConfig.bucket;

            await uploadFile(bucket, objectName, file.buffer, { 'Content-Type': file.mimetype });

            const relationId = v7().replace(/-/g, '');
            const now = new Date();
            const entity = new MinioFile();
            entity.relation_id = relationId;
            entity.hash = hash;
            entity.object_name = objectName;
            entity.original_name = file.originalname;
            entity.mime_type = file.mimetype;
            entity.size = file.size;
            entity.bucket = bucket;
            entity.status = 1;
            entity.create_time = now;
            entity.update_time = now;

            try {
                await this.fileRepository.save(entity);
            } catch (error) {
                if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
                    const winner = await this.fileRepository.findOne({ where: { hash } });
                    if (winner) {
                        if (winner.status === 2) {
                            winner.status = 1;
                            winner.update_time = new Date();
                            await this.fileRepository.save(winner);
                        }
                        try {
                            await deleteFile(bucket, objectName);
                        } catch (cleanupError) {
                            this.logger.warn('清理重复上传对象失败:', cleanupError);
                        }
                        return {
                            result: 0,
                            msg: '上传成功',
                            datas: {
                                relation_id: winner.relation_id,
                                url: generateFileUrl(winner.object_name),
                                hash,
                                is_duplicate: true,
                            },
                        };
                    }
                }
                throw error;
            }

            this.logger.info('上传文件成功:', { relation_id: relationId, hash });

            return {
                result: 0,
                msg: '上传成功',
                datas: {
                    relation_id: relationId,
                    url: generateFileUrl(objectName),
                    hash,
                    is_duplicate: false,
                },
            };
        } catch (error) {
            this.logger.error('上传文件失败:', error);
            return { result: 1, msg: '上传失败' };
        }
    }

    /**
     * 软删文件(status=2),不动 MinIO 对象
     */
    async deleteByRelationId(relationId: string): Promise<DeleteResult> {
        try {
            const file = await this.fileRepository.findOne({ where: { relation_id: relationId } });
            if (!file || file.status === 2) {
                return { result: 1, msg: '文件不存在' };
            }
            file.status = 2;
            file.update_time = new Date();
            await this.fileRepository.save(file);
            this.logger.info('删除文件成功:', { relation_id: relationId });
            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除文件失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    private isUniqueViolation(error: QueryFailedError): boolean {
        const driverErr = error as unknown as { code?: string };
        return driverErr.code === '23505';
    }
}

export const fileService = new FileService();
