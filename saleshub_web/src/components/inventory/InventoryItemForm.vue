<template>
  <!-- 零件新建/编辑弹窗：常用件支持多规格，设备件无规格 -->
  <a-modal :open="visible" :title="isEditMode ? '编辑零件' : '新建零件'" :confirm-loading="loading" :width="520"
    :mask-closable="false" wrap-class-name="item-form-modal" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="item-form">
      <a-form-item label="类型" name="type">
        <a-radio-group v-model:value="form.type" button-style="solid" class="type-radio">
          <a-radio-button value="device">设备件</a-radio-button>
          <a-radio-button value="common">常用件</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="名称" name="name">
        <a-input v-model:value="form.name" placeholder="请输入零件名称" :maxlength="100" show-count />
      </a-form-item>

      <!-- 常用件支持规格；设备件规格字段无意义 -->
      <a-form-item label="规格选项" name="specs">
        <spec-editor v-model:value="form.specs" />
      </a-form-item>

      <a-form-item label="预警阈值" name="warnStock" help="库存低于此值会标记为预警状态">
        <a-input-number v-model:value="form.warnStock" placeholder="默认 1" :min="0" :precision="0" style="width: 100%" />
      </a-form-item>

      <a-form-item label="是否定制" name="is_custom">
        <a-radio-group v-model:value="form.is_custom">
          <a-radio :value="1">否</a-radio>
          <a-radio :value="2">是</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="3" :maxlength="500" show-count />
      </a-form-item>

      <!-- 单图上传：校验类型与大小后走自定义上传，image_id 提交给后端 -->
      <a-form-item label="零件图片" name="image_id">
        <a-upload :before-upload="beforeUpload" :custom-request="handleUpload" :max-count="1" list-type="picture-card"
          :disabled="uploading" :file-list="imageUrl ? [{ url: imageUrl, uid: '1' }] : []" @remove="handleRemoveImage">
          <div v-if="!imageUrl && !uploading">
            <plus-outlined />
            <div style="margin-top: 8px">上传图片</div>
          </div>
        </a-upload>
      </a-form-item>

      <div v-if="isEditMode" class="form-hint">
        零件编码（{{ form.code || '-' }}）由系统自动生成，不可修改
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * InventoryItemForm — 库存零件新建/编辑弹窗
 *
 * 职责：维护零件类型、名称、规格（仅常用件）、预警阈值与图片。
 * 零件编码由后端生成；创建/编辑时 specs 均提交为规格名称 string[]。
 */
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import { uploadImage } from '@/utils/upload'
import type { InventoryItem, ItemType, ItemCreatePayload, ItemUpdatePayload, SpecPayload } from '@/types/inventory'
import SpecEditor from './SpecEditor.vue'

interface Props {
  /** 弹窗显隐，由父组件 v-model:visible 控制 */
  visible: boolean
  /** 传入则为编辑模式；不传或为 null 则为新建 */
  item?: InventoryItem | null
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
/** 图片预览 URL，与 form.image_id 对应 */
const imageUrl = ref<string>('')

/** 表单数据模型 */
interface FormData {
  type: ItemType
  name: string
  code: string
  /** 常用件规格列表；设备件始终为空数组 */
  specs: SpecPayload[]
  warnStock: number | undefined
  image_id?: string
  remark?: string
  is_custom: 1 | 2
}

const form = reactive<FormData>({
  type: 'device',
  name: '',
  code: '',
  specs: [],
  warnStock: undefined,
  image_id: undefined,
  remark: undefined,
  is_custom: 1
})

/** 表单校验规则 */
const rules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { max: 100, message: '名称最多 100 个字符', trigger: 'blur' }
  ],
  warnStock: [
    { type: 'number', min: 0, message: '预警阈值最小为 0', trigger: 'blur' }
  ]
}

/** 是否编辑模式：由是否传入 item 决定 */
const isEditMode = computed(() => !!props.item)

/** 重置表单为新建默认值，并清除校验状态 */
function resetForm() {
  form.type = 'device'
  form.name = ''
  form.code = ''
  form.specs = []
  form.warnStock = undefined
  form.image_id = undefined
  form.remark = undefined
  form.is_custom = 1
  imageUrl.value = ''
  formRef.value?.clearValidate()
}

/** 编辑模式下，用 props.item 回填表单、规格与图片预览 */
function populateForm() {
  if (props.item) {
    form.type = props.item.type
    form.name = props.item.name
    form.code = props.item.code
    // 将 ItemSpec[] 转换为 SpecPayload[]，过滤掉默认规格（空串）
    form.specs = (props.item.specs || [])
      .filter(s => s.spec !== '')
      .map(s => ({ spec: s.spec, price: s.price ?? undefined }))
    form.warnStock = props.item.warn_stock
    form.image_id = props.item.image_id || undefined
    form.remark = props.item.remark || undefined
    form.is_custom = props.item.is_custom || 1
    // 设置图片预览URL
    if (props.item.image_url) {
      imageUrl.value = props.item.image_url || ''
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
      if (props.item) populateForm()
      else resetForm()
    } else {
      resetForm()
    }
  }
)

/**
 * 监听零件类型切换
 * 设备件不使用规格，切换为 device 时清空 specs 避免提交无效数据
 */
watch(
  () => form.type,
  (newType) => {
    if (newType === 'device') {
      form.specs = []
    }
  }
)

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

/**
 * 提交表单
 * 常用件 specs 为规格对象数组 SpecPayload[]；设备件不传 specs。
 * 编辑时传空数组表示改为默认 SKU（后端 normalizeSpecs 处理）。
 */
async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    // 过滤空规格，并确保 spec 字段非空
    const validSpecs = form.specs
      .map(s => ({ spec: s.spec.trim(), price: s.price }))
      .filter(s => s.spec !== '')

    let specsPayload: SpecPayload[] | undefined

    if (form.type === 'common') {
      specsPayload = isEditMode.value
        ? validSpecs
        : validSpecs.length > 0 ? validSpecs : undefined
    }

    if (isEditMode.value) {
      const payload: ItemUpdatePayload = {
        item_id: props.item!.item_id,
        type: form.type,
        name: form.name,
        specs: specsPayload,
        warnStock: form.warnStock,
        image_id: form.image_id,
        remark: form.remark,
        is_custom: form.is_custom
      }
      await inventoryApi.updateItem(payload)
      message.success('零件更新成功')
    } else {
      const payload: ItemCreatePayload = {
        type: form.type,
        name: form.name,
        specs: specsPayload,
        warnStock: form.warnStock,
        image_id: form.image_id,
        remark: form.remark,
        is_custom: form.is_custom
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

/** 取消编辑，关闭弹窗（不保存） */
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
