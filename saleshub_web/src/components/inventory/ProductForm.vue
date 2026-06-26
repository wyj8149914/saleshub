<template>
  <!-- 产品新建/编辑弹窗：编码由后端生成，编辑时只读展示 -->
  <a-modal :open="visible" :title="isEditMode ? '编辑产品' : '新建产品'" :confirm-loading="loading" :width="520"
    :mask-closable="false" wrap-class-name="product-form-modal" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="product-form">
      <a-form-item label="产品名称" name="name">
        <a-input v-model:value="form.name" placeholder="请输入产品名称" :maxlength="100" show-count />
      </a-form-item>

      <a-form-item label="产品描述" name="description">
        <a-textarea v-model:value="form.description" placeholder="请输入产品描述（可选）" :rows="4" :maxlength="500" show-count />
      </a-form-item>

      <!-- 单图上传：校验类型与大小后走自定义上传，image_id 提交给后端 -->
      <a-form-item label="产品图片" name="image_id">
        <a-upload :before-upload="beforeUpload" :custom-request="handleUpload" :max-count="1" list-type="picture-card"
          :disabled="uploading" :file-list="imageUrl ? [{ url: imageUrl, uid: '1' }] : []" @remove="handleRemoveImage">
          <div v-if="!imageUrl && !uploading">
            <plus-outlined />
            <div style="margin-top: 8px">上传图片</div>
          </div>
        </a-upload>
      </a-form-item>

      <div v-if="isEditMode" class="form-hint">
        产品编码（{{ form.code || '-' }}）由系统自动生成，不可修改
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
  /**
   * ProductForm — 产品新建/编辑弹窗
   *
   * 职责：维护产品名称、描述、图片等基础信息。
   * 产品编码由后端自动生成，编辑模式下仅展示不可改。
   */
  import { ref, reactive, computed, watch } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import { uploadImage } from '@/utils/upload'
  import type { Product, ProductCreatePayload, ProductUpdatePayload } from '@/types/inventory'

  interface Props {
    /** 弹窗显隐，由父组件 v-model:visible 控制 */
    visible: boolean
    /** 传入则为编辑模式；不传或为 null 则为新建 */
    product?: Product | null
  }

  const props = defineProps<Props>()

  interface Emits {
    (e: 'update:visible', value: boolean): void
    /** 创建或更新成功后通知父组件刷新列表 */
    (e: 'success'): void
  }

  const emit = defineEmits<Emits>()

  /** Ant Design Form 实例，用于校验与清除错误状态 */
  const formRef = ref()
  /** 提交保存时的 loading，会禁用弹窗确认按钮 */
  const loading = ref(false)
  /** 图片上传进行中的 loading，禁用上传控件 */
  const uploading = ref(false)
  /** 图片预览 URL（上传成功后或编辑回填），与 form.image_id 对应 */
  const imageUrl = ref<string>('')

  /** 表单数据模型 */
  interface FormData {
    name: string
    code: string
    description: string
    /** 关联文件 ID，提交给后端存储 */
    image_id?: string
  }

  const form = reactive<FormData>({
    name: '',
    code: '',
    description: '',
    image_id: undefined
  })

  /** 表单校验规则 */
  const rules = {
    name: [
      { required: true, message: '请输入产品名称', trigger: 'blur' },
      { max: 100, message: '产品名称最多 100 个字符', trigger: 'blur' }
    ],
    description: [{ max: 500, message: '产品描述最多 500 个字符', trigger: 'blur' }]
  }

  /** 是否编辑模式：由是否传入 product 决定 */
  const isEditMode = computed(() => !!props.product)

  /**
   * 上传前校验
   * 仅允许图片类型，且单文件不超过 5MB
   */
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      message.error('只能上传图片文件')
      return false
    }
    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error('图片大小不能超过5MB')
      return false
    }
    return true
  }

  /**
   * 自定义图片上传
   * 调用 uploadImage 获取 relationId 与预览 URL，写入 form.image_id
   */
  const handleUpload = async (options: any) => {
    const { file } = options
    uploading.value = true
    try {
      const result = await uploadImage(file)
      form.image_id = result.relationId
      imageUrl.value = result.url
      message.success('图片上传成功')
    } catch {
      // 错误由 uploadImage 处理
    } finally {
      uploading.value = false
    }
  }

  /** 移除已选图片，清空 image_id 与预览 URL */
  const handleRemoveImage = () => {
    form.image_id = undefined
    imageUrl.value = ''
  }

  /** 重置表单为新建默认值，并清除校验状态 */
  function resetForm() {
    form.name = ''
    form.code = ''
    form.description = ''
    form.image_id = undefined
    imageUrl.value = ''
    formRef.value?.clearValidate()
  }

  /** 编辑模式下，用 props.product 回填表单与图片预览 */
  function populateForm() {
    if (props.product) {
      form.name = props.product.name || ''
      form.code = props.product.code || ''
      form.description = props.product.description || ''
      form.image_id = props.product.image_id || undefined
      // 如果有 image_id，设置图片预览 URL
      if (props.product.image_id) {
        imageUrl.value = props.product.image_url || ''
      }
    }
  }

  /**
   * 监听弹窗显隐，负责表单初始化与清理
   * - 打开：编辑则回填，新建则重置
   * - 关闭：始终重置，避免下次打开残留数据
   */
  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        if (props.product) populateForm()
        else resetForm()
      } else {
        resetForm()
      }
    }
  )

  /**
   * 提交表单
   * 先校验，再按模式调用 createProduct / updateProduct，成功后通知父组件并关闭弹窗
   */
  async function handleSubmit() {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }

    loading.value = true
    try {
      if (isEditMode.value) {
        const payload: ProductUpdatePayload = {
          product_id: props.product!.product_id,
          name: form.name,
          description: form.description || undefined,
          image_id: form.image_id
        }
        await inventoryApi.updateProduct(payload)
        message.success('产品更新成功')
      } else {
        const payload: ProductCreatePayload = {
          name: form.name,
          description: form.description || undefined,
          image_id: form.image_id
        }
        await inventoryApi.createProduct(payload)
        message.success('产品创建成功')
      }
      emit('success')
      emit('update:visible', false)
    } catch {
      // 业务错误由 request 拦截器统一弹窗
    } finally {
      loading.value = false
    }
  }

  /** 取消编辑，关闭弹窗（不保存） */
  function handleCancel() {
    emit('update:visible', false)
  }
</script>

<style scoped>
  .product-form :deep(.ant-form-item-label > label) {
    font-size: 13px;
    font-weight: 500;
  }

  .product-form :deep(.ant-input),
  .product-form :deep(.ant-input-affix-wrapper),
  .product-form :deep(textarea.ant-input) {
    border-radius: 8px;
  }

  .product-form :deep(.ant-input-affix-wrapper-focused),
  .product-form :deep(.ant-input:focus) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  .form-hint {
    margin-top: -8px;
    padding: 10px 12px;
    font-size: 12px;
    color: #71717a;
    background: #f4f4f5;
    border-radius: 6px;
    line-height: 1.5;
  }
</style>
