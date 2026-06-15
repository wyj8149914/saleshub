import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../utils/logger';

/**
 * 文件服务 - MinIO对象存储服务
 */
export class FileService {
  private minioClient: Minio.Client;
  private bucketName = 'inventory-photos';
  private logger = getLogger('FILE_SERV');

  constructor() {
    // 初始化MinIO客户端
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    // 确保bucket存在
    this.ensureBucketExists();
  }

  /**
   * 确保bucket存在，不存在则创建
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);

      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.info(`创建bucket成功: ${this.bucketName}`);
      } else {
        this.logger.info(`bucket已存在: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error('检查或创建bucket失败:', error);
      throw error;
    }
  }

  /**
   * 上传照片到MinIO
   * @param file 文件对象，包含buffer和originalname
   * @returns {result: 0, msg: 'success', alg: '', datas: {photoUrl}}
   */
  async uploadPhoto(file: { buffer: Buffer; originalname: string }): Promise<{
    result: number;
    msg: string;
    alg: string;
    datas: { photoUrl: string } | null;
  }> {
    try {
      // 生成UUID文件名
      const fileName = `${uuidv4()}-${file.originalname}`;

      // 获取MinIO配置信息用于构建URL
      const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
      const port = parseInt(process.env.MINIO_PORT || '9000');
      const useSSL = process.env.MINIO_USE_SSL === 'true';
      const protocol = useSSL ? 'https' : 'http';

      // 上传文件到MinIO
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.buffer.length,
        { 'Content-Type': 'image/jpeg' }
      );

      // 构建照片URL
      const photoUrl = `${protocol}://${endPoint}:${port}/${this.bucketName}/${fileName}`;

      this.logger.info('上传照片成功:', { fileName, photoUrl });

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: { photoUrl },
      };
    } catch (error) {
      this.logger.error('上传照片失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 从MinIO删除照片
   * @param photoUrl 照片URL
   * @returns {result: 0, msg: 'success', alg: '', datas: null}
   */
  async deletePhoto(photoUrl: string): Promise<{
    result: number;
    msg: string;
    alg: string;
    datas: null;
  }> {
    try {
      // 从URL中提取文件名
      // URL格式: protocol//host:port/bucket/filename
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        return {
          result: 1,
          msg: '无效的照片URL',
          alg: '',
          datas: null,
        };
      }

      // 从MinIO删除对象
      await this.minioClient.removeObject(this.bucketName, fileName);

      this.logger.info('删除照片成功:', { fileName });

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: null,
      };
    } catch (error) {
      this.logger.error('删除照片失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 获取MinIO客户端实例（用于其他操作）
   */
  getClient(): Minio.Client {
    return this.minioClient;
  }

  /**
   * 获取bucket名称
   */
  getBucketName(): string {
    return this.bucketName;
  }
}
