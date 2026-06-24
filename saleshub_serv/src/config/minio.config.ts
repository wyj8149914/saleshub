import * as Minio from 'minio';
import { appConfig } from './env.config';
const { minio } = appConfig;

// MinIO客户端配置
export const minioClient = new Minio.Client({
    endPoint: minio.endpoint!,
    port: minio.port,
    useSSL: false,
    accessKey: minio.accessKey,
    secretKey: minio.secretKey,
});

// Bucket配置
export const minioConfig = {
    bucket: minio.publicBucket!,
    privateBucket: minio.privateBucket!,
    publicUrl: minio.url!,
};

// 初始化MinIO Bucket
export async function initializeMinIO(): Promise<void> {
    try {
        // 检查bucket是否存在
        const bucketExists = await minioClient.bucketExists(minioConfig.bucket);

        if (!bucketExists) {
            // 创建bucket
            await minioClient.makeBucket(minioConfig.bucket);
            console.log(`✅ MinIO Bucket创建成功: ${minioConfig.bucket}`);
        } else {
            console.log(`✅ MinIO Bucket已存在: ${minioConfig.bucket}`);
        }
    } catch (error) {
        console.error('❌ MinIO初始化失败:', error);
        throw error;
    }
}

// 生成文件URL
export function generateFileUrl(objectName: string): string {
    return `${minioConfig.publicUrl}/${minioConfig.bucket}/${objectName}`;
}

// 上传文件
export async function uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    metaData?: Record<string, string>
): Promise<string> {
    try {
        await minioClient.putObject(bucket, objectName, buffer, buffer.length, metaData);
        return generateFileUrl(objectName);
    } catch (error) {
        console.error('文件上传失败:', error);
        throw error;
    }
}

// 删除文件
export async function deleteFile(bucket: string, objectName: string): Promise<void> {
    try {
        await minioClient.removeObject(bucket, objectName);
    } catch (error) {
        console.error('文件删除失败:', error);
        throw error;
    }
}
