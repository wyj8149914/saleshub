<template>
  <a-modal
    :open="visible"
    :title="isEditMode ? '编辑产品' : '新建产品'"
    :confirm-loading="loading"
    :width="520"
    :mask-closable="false"
    wrap-class-name="product-form-modal"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="product-form">
      <a-form-item label="产品名称" name="name">
        <a-input
          v-model:value="form.name"
          placeholder="请输入产品名称"
          :maxlength="100"
          show-count
        />
      </a-form-item>

      <a-form-item label="产品描述" name="description">
        <a-textarea
          v-model:value="form.description"
          placeholder="请输入产品描述（可选）"
          :rows="4"
          :maxlength="500"
          show-count
        />
      </a-form-item>

      <div v-if="isEditMode" class="form-hint">
        产品编码（{{ form.code || '-' }}）由系统自动生成，不可修改
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { inventoryApi } from '@/api/inventory'
import type { Product, ProductCreatePayload, ProductUpdatePayload } from '@/api/inventory'

interface Props {
  visible: boolean
  product?: Product | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const emit = defineEmits<Emits>()

const formRef = ref()
const loading = ref(false)

interface FormData {
  name: string
  code: string
  description: string
}

const form = reactive<FormData>({
  name: '',
  code: '',
  description: ''
})

const rules = {
  name: [
    { required: true, message: '请输入产品名称', trigger: 'blur' },
    { max: 100, message: '产品名称最多 100 个字符', trigger: 'blur' }
  ],
  description: [{ max: 500, message: '产品描述最多 500 个字符', trigger: 'blur' }]
}

const isEditMode = computed(() => !!props.product)

function resetForm() {
  form.name = ''
  form.code = ''
  form.description = ''
  formRef.value?.clearValidate()
}

function populateForm() {
  if (props.product) {
    form.name = props.product.name || ''
    form.code = props.product.code || ''
    form.description = props.product.description || ''
  }
}

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
        description: form.description
      }
      await inventoryApi.updateProduct(payload)
      message.success('产品更新成功')
    } else {
      const payload: ProductCreatePayload = {
        name: form.name,
        description: form.description
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
