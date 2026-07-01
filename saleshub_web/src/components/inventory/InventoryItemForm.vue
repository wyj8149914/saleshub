<template>
  <!-- 零件新建/编辑弹窗 -->
  <a-modal :open="visible" :title="isEditMode ? '编辑零件' : '新建零件'" :confirm-loading="loading" :width="680"
    :mask-closable="false" wrap-class-name="item-form-modal" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" :rules="rules" layout="horizontal" class="item-form" :label-col="{ span: 4 }"
      :wrapper-col="{ span: 20 }">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="一级类型" name="parent_type_id" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
            <a-select v-model:value="form.parent_type_id" placeholder="请选择一级类型" allow-clear :loading="typesLoading"
              @change="handleParentTypeChange">
              <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
                {{ t.type_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="二级类型" name="child_type_id" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
            <a-select v-model:value="form.child_type_id" placeholder="请选择二级类型" allow-clear :loading="typesLoading"
              :disabled="!form.parent_type_id" @change="handleChildTypeChange">
              <a-select-option v-for="t in childTypes" :key="t.type_id" :value="t.type_id">
                {{ t.type_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="名称" name="name">
        <a-input v-model:value="form.name" placeholder="请输入零件名称" :maxlength="100" show-count />
      </a-form-item>

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
        <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="2" :maxlength="500" show-count />
      </a-form-item>

      <!-- 单图上传 -->
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
  import { ref, reactive, computed, watch } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import { uploadImage } from '@/utils/upload'
  import type { InventoryItem, ItemTypeNode, ItemCreatePayload, ItemUpdatePayload, SpecPayload } from '@/types/inventory'
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
  const uploading = ref(false)
  const imageUrl = ref<string>('')
  const typesLoading = ref(false)
  const allTypes = ref<ItemTypeNode[]>([])

  // 一级类型列表
  const parentTypes = computed(() => allTypes.value)

  // 根据选中的一级类型，过滤出二级类型
  const childTypes = computed(() => {
    if (!form.parent_type_id) return []
    const parent = allTypes.value.find(t => t.type_id === form.parent_type_id)
    return parent?.children || []
  })

  // 加载类型列表
  const loadTypes = async () => {
    typesLoading.value = true
    try {
      const res = await inventoryApi.listItemTypes()
      allTypes.value = (res.datas || res) as ItemTypeNode[]
    } catch {
      // 错误由拦截器处理
    } finally {
      typesLoading.value = false
    }
  }

  interface FormData {
    parent_type_id: string | undefined
    child_type_id: string | undefined
    name: string
    code: string
    specs: SpecPayload[]
    warnStock: number | undefined
    image_id?: string
    remark?: string
    is_custom: 1 | 2
  }

  const form = reactive<FormData>({
    parent_type_id: undefined,
    child_type_id: undefined,
    name: '',
    code: '',
    specs: [],
    warnStock: undefined,
    image_id: undefined,
    remark: undefined,
    is_custom: 1
  })

  const rules = {
    parent_type_id: [{ required: true, message: '请选择一级类型', trigger: 'change' }],
    name: [
      { required: true, message: '请输入名称', trigger: 'blur' },
      { max: 100, message: '名称最多 100 个字符', trigger: 'blur' }
    ],
    warnStock: [
      { type: 'number', min: 0, message: '预警阈值最小为 0', trigger: 'blur' }
    ]
  }

  const isEditMode = computed(() => !!props.item)

  function resetForm() {
    form.parent_type_id = undefined
    form.child_type_id = undefined
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

  function populateForm() {
    if (props.item) {
      form.name = props.item.name
      form.code = props.item.code
      form.specs = (props.item.specs || [])
        .filter(s => s.spec !== '')
        .map(s => ({ spec: s.spec, price: s.price ?? undefined }))
      form.warnStock = props.item.warn_stock
      form.image_id = props.item.image_id || undefined
      form.remark = props.item.remark || undefined
      form.is_custom = props.item.is_custom || 1
      if (props.item.image_url) {
        imageUrl.value = props.item.image_url || ''
      }
      // 根据 item.type_id 判断是一级还是二级类型，回填选择器
      if (allTypes.value.length > 0) {
        const itemTypeId = props.item.type_id
        for (const parent of allTypes.value) {
          if (parent.type_id === itemTypeId) {
            // type_id 是一级类型
            form.parent_type_id = parent.type_id
            form.child_type_id = undefined
            break
          }
          if (parent.children?.length) {
            const child = parent.children.find(c => c.type_id === itemTypeId)
            if (child) {
              // type_id 是二级类型
              form.parent_type_id = parent.type_id
              form.child_type_id = child.type_id
              break
            }
          }
        }
      }
    }
  }

  // 一级类型变更时，清空二级类型
  const handleParentTypeChange = () => {
    form.child_type_id = undefined
  }

  // 二级类型变更（预留）
  const handleChildTypeChange = () => {
    // noop
  }

  // 实际提交的 type_id：有二级选二级，否则用一级
  const submitTypeId = computed(() => form.child_type_id || form.parent_type_id || '')

  watch(
    () => props.visible,
    async (visible) => {
      if (visible) {
        await loadTypes()
        if (props.item) populateForm()
        else resetForm()
      } else {
        resetForm()
      }
    }
  )

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

  const handleRemoveImage = () => {
    form.image_id = undefined
    imageUrl.value = ''
  }

  async function handleSubmit() {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }

    loading.value = true
    try {
      const validSpecs = form.specs
        .map(s => ({ spec: s.spec.trim(), price: s.price }))
        .filter(s => s.spec !== '')

      let specsPayload: SpecPayload[] | undefined
      specsPayload = isEditMode.value ? validSpecs : validSpecs.length > 0 ? validSpecs : undefined

      if (isEditMode.value) {
        const payload: ItemUpdatePayload = {
          item_id: props.item!.item_id,
          type_id: submitTypeId.value,
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
          type_id: submitTypeId.value,
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
  .item-form :deep(.ant-input-number),
  .item-form :deep(.ant-select-selector) {
    border-radius: 8px;
  }

  .item-form :deep(.ant-input-affix-wrapper-focused),
  .item-form :deep(.ant-input:focus),
  .item-form :deep(.ant-input-number-focused),
  .item-form :deep(.ant-select-focused .ant-select-selector) {
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
