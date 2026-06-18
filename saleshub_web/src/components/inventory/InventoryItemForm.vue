<template>
  <a-modal
    :open="visible"
    :title="isEditMode ? '编辑零件' : '新建零件'"
    :confirm-loading="loading"
    :width="520"
    :mask-closable="false"
    wrap-class-name="item-form-modal"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="item-form">
      <a-form-item label="类型" name="type">
        <a-radio-group v-model:value="form.type" button-style="solid" class="type-radio">
          <a-radio-button value="device">设备件</a-radio-button>
          <a-radio-button value="common">常用件</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="名称" name="name">
        <a-input
          v-model:value="form.name"
          placeholder="请输入零件名称"
          :maxlength="100"
          show-count
        />
      </a-form-item>

      <!-- 常用件支持规格；设备件规格字段无意义 -->
      <a-form-item v-if="form.type === 'common'" label="规格选项" name="specs">
        <spec-editor v-model:value="form.specs" />
      </a-form-item>

      <a-form-item label="预警阈值" name="warnStock" help="库存低于此值会标记为预警状态">
        <a-input-number
          v-model:value="form.warnStock"
          placeholder="默认 10"
          :min="1"
          :precision="0"
          style="width: 100%"
        />
      </a-form-item>

      <div v-if="isEditMode" class="form-hint">
        零件编码（{{ form.code || '-' }}）由系统自动生成，不可修改
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { inventoryApi } from '@/api/inventory'
import type { InventoryItem, ItemType, ItemCreatePayload, ItemUpdatePayload } from '@/api/inventory'
import SpecEditor from './SpecEditor.vue'

interface Props {
  visible: boolean
  item?: InventoryItem | null
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
  type: ItemType
  name: string
  code: string
  specs: string[]
  warnStock: number | undefined
}

const form = reactive<FormData>({
  type: 'device',
  name: '',
  code: '',
  specs: [],
  warnStock: undefined
})

const rules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { max: 100, message: '名称最多 100 个字符', trigger: 'blur' }
  ],
  warnStock: [
    { type: 'number', min: 1, message: '预警阈值最小为 1', trigger: 'blur' }
  ]
}

const isEditMode = computed(() => !!props.item)

function resetForm() {
  form.type = 'device'
  form.name = ''
  form.code = ''
  form.specs = []
  form.warnStock = undefined
  formRef.value?.clearValidate()
}

function populateForm() {
  if (props.item) {
    form.type = props.item.type
    form.name = props.item.name
    form.code = props.item.code
    form.specs = [...(props.item.specs || [])]
    form.warnStock = props.item.warn_stock
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.item) populateForm()
      else resetForm()
    } else {
      resetForm()
    }
  }
)

// 切换类型时清空规格（设备件规格无意义）
watch(
  () => form.type,
  (newType) => {
    if (newType === 'device') {
      form.specs = []
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
    // 仅当常用件且规格数组非空时才传 specs
    const specs = form.type === 'common' && form.specs.length > 0 ? form.specs.filter((s) => s.trim() !== '') : undefined
    const trimmedSpecs = specs && specs.length > 0 ? specs : undefined

    if (isEditMode.value) {
      const payload: ItemUpdatePayload = {
        item_id: props.item!.item_id,
        type: form.type,
        name: form.name,
        specs: trimmedSpecs,
        warnStock: form.warnStock
      }
      await inventoryApi.updateItem(payload)
      message.success('零件更新成功')
    } else {
      const payload: ItemCreatePayload = {
        type: form.type,
        name: form.name,
        specs: trimmedSpecs,
        warnStock: form.warnStock
      }
      await inventoryApi.createItem(payload)
      message.success('零件创建成功')
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
.item-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  font-weight: 500;
}

.item-form :deep(.ant-input),
.item-form :deep(.ant-input-affix-wrapper),
.item-form :deep(textarea.ant-input),
.item-form :deep(.ant-input-number) {
  border-radius: 8px;
}

.item-form :deep(.ant-input-affix-wrapper-focused),
.item-form :deep(.ant-input:focus),
.item-form :deep(.ant-input-number-focused) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.type-radio {
  width: 100%;
  display: flex;
}

.type-radio :deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
  border-radius: 8px;
}

.type-radio :deep(.ant-radio-button-wrapper:first-child) {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.type-radio :deep(.ant-radio-button-wrapper:last-child) {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
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
