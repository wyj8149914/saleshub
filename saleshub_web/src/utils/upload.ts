import { message } from 'ant-design-vue'
import { fileApi } from '@/api/inventory'

export interface UploadImageOptions {
  maxSize?: number      // MB，默认 10
  acceptTypes?: string[] // 默认 ['image/*']
}

export interface UploadImageResult {
  relationId: string
  url: string
}

const DEFAULT_MAX_SIZE = 10 // MB
const DEFAULT_ACCEPT_TYPES = ['image/*']

/**
 * 上传图片文件
 * @param file 文件对象
 * @param options 上传选项
 * @returns Promise<{relationId: string, url: string}>
 */
export async function uploadImage(
  file: File,
  options?: UploadImageOptions
): Promise<UploadImageResult> {
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE
  const acceptTypes = options?.acceptTypes ?? DEFAULT_ACCEPT_TYPES

  // 校验文件类型
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    throw new Error('只能上传图片文件')
  }

  // 校验文件大小
  const isLtMaxSize = file.size / 1024 / 1024 < maxSize
  if (!isLtMaxSize) {
    message.error(`图片大小不能超过 ${maxSize}MB`)
    throw new Error(`图片大小不能超过 ${maxSize}MB`)
  }

  try {
    const response = await fileApi.uploadFile(file)

    if (response) {
      return {
        relationId: response.relation_id,
        url: response.url
      }
    } else {
      message.error('上传失败')
      throw new Error('上传失败')
    }
  } catch (error) {
    // 业务错误由 request 拦截器统一处理
    throw error
  }
}
