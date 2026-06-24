# 零件和产品模块重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 适配服务端新接口规范，为零件和产品模块添加图片上传功能，升级规格数据结构，优化产品-零件关联体验

**Architecture:** 自下而上的分层重构：API 层 → 工具层 → 组件层 → 页面层

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue, Pinia, Axios

---

## 文件结构

### 新增文件
- `src/utils/upload.ts` - 文件上传工具函数

### 修改文件
- `src/api/inventory.ts` - API 类型定义和接口
- `src/components/inventory/SpecEditor.vue` - 规格编辑组件
- `src/components/inventory/InventoryItemForm.vue` - 零件表单组件
- `src/components/inventory/ProductForm.vue` - 产品表单组件
- `src/components/inventory/ProductItemsManager.vue` - 产品零件关联组件
- `src/views/inventory/InventoryList.vue` - 零件列表页面
- `src/views/inventory/ProductList.vue` - 产品列表页面

---

## Task 1: 修改 API 类型定义

**Files:**
- Modify: `src/api/inventory.ts`

- [ ] **Step 1: 添加文件上传和规格相关类型**

在文件开头添加新类型定义：

```typescript
// ============ 文件上传 ============
export interface FileUploadResponse {
  relation_id: string
  url: string
  hash: string
  is_duplicate: boolean
}

// ============ 零件规格 ============
export interface ItemSpec {
  spec_id: string
  spec: string
  current_stock: number
}
```

- [ ] **Step 2: 修改 InventoryItem 类型**

找到 `InventoryItem` 接口定义，替换为：

```typescript
export interface InventoryItem {
  item_id: string
  type: ItemType
  name: string
  code: string
  specs: ItemSpec[]           // string[] → ItemSpec[]
  image_id: string | null     // 新增
  warn_stock: number
  isWarning: 1 | 2           // boolean → 1 | 2
}
```

- [ ] **Step 3: 修改 Product 类型**

找到 `Product` 接口定义，添加 `image_id` 字段：

```typescript
export interface Product {
  product_id: string
  name: string
  code: string
  description: string
  image_id: string | null     // 新增
}
```

- [ ] **Step 4: 修改 ItemCreatePayload 类型**

找到 `ItemCreatePayload` 接口定义，添加 `image_id` 字段：

```typescript
export interface ItemCreatePayload {
  type: ItemType
  name: string
  specs?: string[]
  warnStock?: number
  image_id?: string           // 新增
}
```

- [ ] **Step 5: 修改 ItemUpdatePayload 类型**

找到 `ItemUpdatePayload` 接口定义，添加 `image_id` 字段：

```typescript
export interface ItemUpdatePayload {
  item_id: string
  type: ItemType
  name: string
  specs?: string[]
  warnStock?: number
  image_id?: string           // 新增
}
```

- [ ] **Step 6: 修改 ProductCreatePayload 类型**

找到 `ProductCreatePayload` 接口定义，添加 `image_id` 字段：

```typescript
export interface ProductCreatePayload {
  name: string
  description?: string
  image_id?: string           // 新增
}
```

- [ ] **Step 7: 修改 ProductUpdatePayload 类型**

找到 `ProductUpdatePayload` 接口定义，添加 `image_id` 字段：

```typescript
export interface ProductUpdatePayload {
  product_id: string
  name: string
  description?: string
  image_id?: string           // 新增
}
```

- [ ] **Step 8: 修改 ProductItemRelation 类型**

找到 `ProductItemRelation` 接口定义，添加 `spec_id` 和 `spec` 字段：

```typescript
export interface ProductItemRelation {
  relation_id: string
  product_id: string
  item_id: string
  spec_id: string             // 新增
  spec: string                // 新增
  quantity_per_product: number
  remark: string | null
  item_name: string
  item_code: string
  item_type: ItemType
  current_stock: number
  warn_stock: number
}
```

- [ ] **Step 9: 修改 ProductItemPayload 类型**

找到 `ProductItemPayload` 接口定义，添加 `spec_id` 字段：

```typescript
export interface ProductItemPayload {
  item_id: string
  spec_id: string             // 新增（必填）
  quantity_per_product?: number
  remark?: string
}
```

- [ ] **Step 10: 添加文件上传 API**

在 `inventoryApi` 对象之前添加 `fileApi`：

```typescript
// ============ 文件上传 API ============
export const fileApi = {
  uploadFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    return http.post<FileUploadResponse>('/saleshub/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  deleteFile(relation_id: string): Promise<void> {
    return http.post('/saleshub/file/delete', { relation_id })
  }
}
```

- [ ] **Step 11: 验证类型定义**

运行类型检查确保没有错误：

```bash
npm run type-check
```

---

## Task 2: 创建文件上传工具函数

**Files:**
- Create: `src/utils/upload.ts`

- [ ] **Step 1: 创建 upload.ts 文件**

创建新文件 `src/utils/upload.ts`，添加以下内容：

```typescript
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

    if (response.result === 0 && response.datas) {
      return {
        relationId: response.datas.relation_id,
        url: response.datas.url
      }
    } else {
      message.error(response.msg || '上传失败')
      throw new Error(response.msg || '上传失败')
    }
  } catch (error) {
    // 业务错误由 request 拦截器统一处理
    throw error
  }
}
```

- [ ] **Step 2: 验证文件创建成功**

检查文件是否正确创建在 `src/utils/upload.ts`

---

## Task 3: 重构 SpecEditor 组件

**Files:**
- Modify: `src/components/inventory/SpecEditor.vue`

- [ ] **Step 1: 修改组件数据结构**

将 `value` 的类型从 `string[]` 改为包含 `spec_id` 的对象数组。

修改 `<script setup>` 部分：

```typescript
import { ref, watch } from 'vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'

// 规格值接口
interface SpecValue {
  spec_id: string      // 编辑模式有值，创建模式为空或临时 ID
  spec: string         // 规格名称
}

interface Props {
  value: SpecValue[]   // string[] → SpecValue[]
  mode?: 'create' | 'edit'  // 新增：区分创建/编辑模式
}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  mode: 'create'
})

const emit = defineEmits<{
  (e: 'update:value', value: SpecValue[]): void
}>()

const localSpecs = ref<SpecValue[]>([...props.value])

watch(
  () => props.value,
  (newValue) => {
    localSpecs.value = [...newValue]
  },
  { deep: true }
)

watch(
  localSpecs,
  (newValue) => {
    emit('update:value', [...newValue])
  },
  { deep: true }
)

function addSpec() {
  // 创建临时 ID
  const tempId = `temp_${Date.now()}_${localSpecs.value.length}`
  localSpecs.value.push({ spec_id: tempId, spec: '' })
}

function removeSpec(index: number) {
  localSpecs.value.splice(index, 1)
}
```

- [ ] **Step 2: 修改模板部分**

修改模板以支持新数据结构，编辑模式显示 `spec_id`：

```vue
<template>
  <div class="spec-editor">
    <div v-for="(spec, index) in localSpecs" :key="spec.spec_id || index" class="spec-row">
      <!-- 编辑模式：显示 spec_id -->
      <span v-if="props.mode === 'edit' && !spec.spec_id.startsWith('temp_')" class="spec-id">
        {{ spec.spec_id.slice(0, 8) }}
      </span>

      <a-input
        v-model:value="localSpecs[index].spec"
        placeholder="请输入规格（如：不锈钢、M8×20）"
        :maxlength="100"
        allow-clear
      />

      <a-button type="text" danger @click="removeSpec(index)">
        <template #icon>
          <DeleteOutlined />
        </template>
      </a-button>
    </div>

    <a-button type="dashed" block class="spec-add" @click="addSpec">
      <template #icon>
        <PlusOutlined />
      </template>
      添加规格
    </a-button>
  </div>
</template>
```

- [ ] **Step 3: 更新样式**

添加 `spec-id` 样式：

```vue
<style scoped>
.spec-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.spec-id {
  font-size: 11px;
  color: #a1a1aa;
  font-family: 'Courier New', Consolas, monospace;
  min-width: 70px;
}

.spec-row :deep(.ant-input),
.spec-row :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  flex: 1;
}

/* ... 其他样式保持不变 ... */
</style>
```

---

## Task 4: 重构 InventoryItemForm 组件

**Files:**
- Modify: `src/components/inventory/InventoryItemForm.vue`

- [ ] **Step 1: 修改导入和类型定义**

更新导入和添加新的类型：

```typescript
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import { uploadImage } from '@/utils/upload'
import type { InventoryItem, ItemType, ItemCreatePayload, ItemUpdatePayload } from '@/api/inventory'

// 规格值接口
interface SpecValue {
  spec_id: string
  spec: string
}
```

- [ ] **Step 2: 修改表单数据结构**

更新表单数据以包含 `image_id` 和新规格结构：

```typescript
interface FormData {
  type: ItemType
  name: string
  code: string
  specs: SpecValue[]       // string[] → SpecValue[]
  warnStock: number | undefined
  image_id?: string        // 新增
}

const form = reactive<FormData>({
  type: 'device',
  name: '',
  code: '',
  specs: [],
  warnStock: undefined,
  image_id: undefined
})
```

- [ ] **Step 3: 修改 resetForm 和 populateForm**

```typescript
function resetForm() {
  form.type = 'device'
  form.name = ''
  form.code = ''
  form.specs = []
  form.warnStock = undefined
  form.image_id = undefined
  formRef.value?.clearValidate()
}

function populateForm() {
  if (props.item) {
    form.type = props.item.type
    form.name = props.item.name
    form.code = props.item.code
    // 转换 specs 结构
    form.specs = (props.item.specs || []).map(s => ({
      spec_id: s.spec_id,
      spec: s.spec
    }))
    form.warnStock = props.item.warn_stock
    form.image_id = props.item.image_id || undefined
  }
}
```

- [ ] **Step 4: 添加图片上传相关状态**

在 `loading` 定义后添加：

```typescript
const uploading = ref(false)
const imageUrl = ref<string>('')
```

- [ ] **Step 5: 添加图片上传处理函数**

在 `handleSubmit` 之前添加：

```typescript
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
```

- [ ] **Step 6: 修改 handleSubmit 中的 specs 处理**

更新提交逻辑以正确处理规格：

```typescript
async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    // 处理 specs：提取 spec 数组（创建模式）或保持完整结构（编辑模式）
    let specsPayload: string[] | { spec_id: string; spec: string }[] | undefined

    if (form.type === 'common' && form.specs.length > 0) {
      const validSpecs = form.specs.filter(s => s.spec.trim() !== '')
      if (validSpecs.length > 0) {
        if (isEditMode.value) {
          // 编辑模式：发送完整结构
          specsPayload = validSpecs
        } else {
          // 创建模式：只发送 spec 名称数组
          specsPayload = validSpecs.map(s => s.spec)
        }
      }
    }

    if (isEditMode.value) {
      const payload: ItemUpdatePayload = {
        item_id: props.item!.item_id,
        type: form.type,
        name: form.name,
        specs: specsPayload as any,
        warnStock: form.warnStock,
        image_id: form.image_id
      }
      await inventoryApi.updateItem(payload)
      message.success('零件更新成功')
    } else {
      const payload: ItemCreatePayload = {
        type: form.type,
        name: form.name,
        specs: specsPayload as string[],
        warnStock: form.warnStock,
        image_id: form.image_id
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
```

- [ ] **Step 7: 更新模板 - 添加图片上传区域**

在 `<a-form>` 中，预警阈值字段后添加：

```vue
<a-form-item label="零件图片" name="image_id">
  <a-upload
    :before-upload="beforeUpload"
    :custom-request="handleUpload"
    :max-count="1"
    list-type="picture-card"
    :disabled="uploading"
    :file-list="imageUrl ? [{ url: imageUrl, uid: '1' }] : []"
    @remove="handleRemoveImage"
  >
    <div v-if="!imageUrl && !uploading">
      <plus-outlined />
      <div style="margin-top: 8px">上传图片</div>
    </div>
  </a-upload>
</a-form-item>
```

- [ ] **Step 8: 更新模板 - 修改 SpecEditor 调用**

更新 `spec-editor` 组件调用，添加 `mode` 属性：

```vue
<template v-if="form.type === 'common'" label="规格选项" name="specs">
  <spec-editor v-model:value="form.specs" :mode="isEditMode ? 'edit' : 'create'" />
</template>
```

- [ ] **Step 9: 添加图标导入**

在 `<script setup>` 顶部导入 `PlusOutlined` 和 `DeleteOutlined`：

```typescript
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
```

---

## Task 5: 重构 ProductForm 组件

**Files:**
- Modify: `src/components/inventory/ProductForm.vue`

- [ ] **Step 1: 修改导入**

添加图片上传相关导入：

```typescript
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import { uploadImage } from '@/utils/upload'
import type { Product, ProductCreatePayload, ProductUpdatePayload } from '@/api/inventory'
```

- [ ] **Step 2: 修改表单数据结构**

添加 `image_id` 字段：

```typescript
interface FormData {
  name: string
  code: string
  description: string
  image_id?: string        // 新增
}

const form = reactive<FormData>({
  name: '',
  code: '',
  description: '',
  image_id: undefined
})
```

- [ ] **Step 3: 添加图片上传相关状态**

在 `loading` 定义后添加：

```typescript
const uploading = ref(false)
const imageUrl = ref<string>('')
```

- [ ] **Step 4: 添加图片上传处理函数**

在 `handleSubmit` 之前添加：

```typescript
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
```

- [ ] **Step 5: 修改 resetForm 和 populateForm**

```typescript
function resetForm() {
  form.name = ''
  form.code = ''
  form.description = ''
  form.image_id = undefined
  imageUrl.value = ''
  formRef.value?.clearValidate()
}

function populateForm() {
  if (props.product) {
    form.name = props.product.name || ''
    form.code = props.product.code || ''
    form.description = props.product.description || ''
    form.image_id = props.product.image_id || undefined
    // 如果有 image_id，需要加载图片 URL
    if (props.product.image_id) {
      // 假设 URL 格式：MINIO_URL/bucket/object_name
      // 这里需要根据实际 API 返回调整
      imageUrl.value = `/api/file/${props.product.image_id}`
    }
  }
}
```

- [ ] **Step 6: 修改 handleSubmit**

在 payload 中添加 `image_id`：

```typescript
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
```

- [ ] **Step 7: 更新模板 - 添加图片上传区域**

在 `<a-form>` 中，描述字段后添加：

```vue
<a-form-item label="产品图片" name="image_id">
  <a-upload
    :before-upload="beforeUpload"
    :custom-request="handleUpload"
    :max-count="1"
    list-type="picture-card"
    :disabled="uploading"
    :file-list="imageUrl ? [{ url: imageUrl, uid: '1' }] : []"
    @remove="handleRemoveImage"
  >
    <div v-if="!imageUrl && !uploading">
      <plus-outlined />
      <div style="margin-top: 8px">上传图片</div>
    </div>
  </a-upload>
</a-form-item>
```

---

## Task 6: 重构 ProductItemsManager 组件

**Files:**
- Modify: `src/components/inventory/ProductItemsManager.vue`

- [ ] **Step 1: 修改 SelectedItem 接口**

添加 `spec_id` 和 `spec` 字段：

```typescript
interface SelectedItem {
  item_id: string
  spec_id: string              // 新增
  spec: string                 // 新增
  item_name: string
  item_code: string
  item_type: ItemType
  current_stock: number
  warn_stock: number
  quantity_per_product: number
  remark: string
}
```

- [ ] **Step 2: 修改 addForm**

添加 `spec_id` 字段：

```typescript
const addForm = reactive<{
  item_id: string | undefined
  spec_id: string | undefined    // 新增
  quantity_per_product: number
  remark: string
}>({
  item_id: undefined,
  spec_id: undefined,
  quantity_per_product: 1,
  remark: ''
})
```

- [ ] **Step 3: 修改选项数据结构**

修改 `availableOptions` 计算属性以支持规格：

```typescript
interface SelectOption {
  label: string
  value: string      // item_id
  specId: string     // spec_id
  specName: string   // spec
}

const availableOptions = computed<SelectOption[]>(() => {
  const selectedKeys = new Set(
    selectedItems.value.map(i => `${i.item_id}_${i.spec_id}`)
  )
  const options: SelectOption[] = []

  for (const item of availableItems.value) {
    if (!item.specs || item.specs.length === 0) {
      // 无规格：零件本身作为选项（spec_id 为空字符串）
      const key = `${item.item_id}_`
      if (!selectedKeys.has(key)) {
        options.push({
          label: `${item.name}（${item.code}）`,
          value: item.item_id,
          specId: '',
          specName: ''
        })
      }
    } else {
      // 有规格：每个规格作为独立选项
      for (const spec of item.specs) {
        const key = `${item.item_id}_${spec.spec_id}`
        if (!selectedKeys.has(key)) {
          const displaySpec = spec.spec ? ` - ${spec.spec}` : ''
          options.push({
            label: `${item.name}${displaySpec}（${item.code}）`,
            value: item.item_id,
            specId: spec.spec_id,
            specName: spec.spec
          })
        }
      }
    }
  }

  return options
})
```

- [ ] **Step 4: 修改 filterItem 函数**

更新为使用新的选项结构：

```typescript
const filterItem = (input: string, option: SelectOption) => {
  return option.label.toLowerCase().includes(input.toLowerCase())
}
```

- [ ] **Step 5: 修改 addForm 的 item_id 改变处理**

当选择零件时，自动设置 `spec_id`：

```typescript
watch(
  () => addForm.item_id,
  (newItemId) => {
    // 从选项中找到对应零件的默认 spec_id
    const option = availableOptions.value.find(opt => opt.value === newItemId)
    if (option) {
      addForm.spec_id = option.specId
    }
  }
)
```

- [ ] **Step 6: 修改 loadCurrentItems**

更新数据加载逻辑以包含 `spec_id` 和 `spec`：

```typescript
const loadCurrentItems = async () => {
  if (!props.product) return
  loading.value = true
  try {
    const res = await inventoryApi.listProductItems(props.product.product_id)
    selectedItems.value = res.datas.items.map((i) => ({
      item_id: i.item_id,
      spec_id: i.spec_id,              // 新增
      spec: i.spec,                     // 新增
      item_name: i.item_name,
      item_code: i.item_code,
      item_type: i.item_type,
      current_stock: i.current_stock,
      warn_stock: i.warn_stock,
      quantity_per_product: i.quantity_per_product || 1,
      remark: i.remark || ''
    }))
  } catch {
    // 错误由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 7: 修改 handleAdd**

更新添加逻辑以包含 `spec_id`：

```typescript
const handleAdd = () => {
  if (!addForm.item_id || !addForm.spec_id) return

  const option = availableOptions.value.find(
    opt => opt.value === addForm.item_id && opt.specId === addForm.spec_id
  )
  if (!option) return

  const item = availableItems.value.find(i => i.item_id === addForm.item_id)
  if (!item) return

  const spec = item.specs?.find(s => s.spec_id === addForm.spec_id)

  selectedItems.value.push({
    item_id: item.item_id,
    spec_id: addForm.spec_id,
    spec: option.specName,
    item_name: item.name,
    item_code: item.code,
    item_type: item.type,
    current_stock: spec?.current_stock || 0,
    warn_stock: item.warn_stock,
    quantity_per_product: addForm.quantity_per_product,
    remark: addForm.remark
  })

  addForm.item_id = undefined
  addForm.spec_id = undefined
  addForm.quantity_per_product = 1
  addForm.remark = ''
}
```

- [ ] **Step 8: 修改 handleRemove**

更新为使用复合键：

```typescript
const handleRemove = (record: SelectedItem) => {
  const idx = selectedItems.value.findIndex(
    i => i.item_id === record.item_id && i.spec_id === record.spec_id
  )
  if (idx >= 0) {
    selectedItems.value.splice(idx, 1)
  }
}
```

- [ ] **Step 9: 修改 handleSave**

更新提交数据以包含 `spec_id`：

```typescript
const handleSave = async () => {
  if (!props.product) return
  saving.value = true
  try {
    await inventoryApi.setProductItems(
      props.product.product_id,
      selectedItems.value.map((i) => ({
        item_id: i.item_id,
        spec_id: i.spec_id,               // 新增
        quantity_per_product: i.quantity_per_product,
        remark: i.remark || undefined
      }))
    )
    message.success('关联已更新')
    emit('update:visible', false)
  } catch {
    // 错误由 request 拦截器统一处理
  } finally {
    saving.value = false
  }
}
```

- [ ] **Step 10: 更新模板 - 添加规格列**

修改 `columns` 定义，添加规格列：

```typescript
const columns = [
  { title: '类型', key: 'item_type', width: 90, align: 'center' as const },
  { title: '名称', key: 'item_name', ellipsis: true },
  { title: '编码', key: 'item_code', width: 130, align: 'center' as const },
  { title: '规格', key: 'spec', width: 120, align: 'center' as const },        // 新增
  { title: '库存', key: 'stock', width: 120, align: 'right' as const },
  { title: '单台数量', key: 'quantity_per_product', width: 130, align: 'center' as const },
  { title: '备注', key: 'remark', width: 180 },
  { title: '操作', key: 'actions', width: 80, align: 'center' as const }
]
```

- [ ] **Step 11: 更新模板 - 添加规格列显示**

在表格模板中添加规格列：

```vue
<template v-else-if="column.key === 'spec'">
  <span class="cell-spec">{{ record.spec || '-' }}</span>
</template>
```

- [ ] **Step 12: 更新模板 - 修改添加面板**

修改添加面板以使用新的选择逻辑：

```vue
<a-select
  v-model:value="addForm.item_id"
  placeholder="搜索零件或规格"
  show-search
  allow-clear
  :filter-option="filterItem"
  :options="availableOptions"
  :loading="loadingAvailable"
  :field-names="{ label: 'label', value: 'value' }"
  class="add-select"
/>
```

---

## Task 7: 重构 InventoryList 页面

**Files:**
- Modify: `src/views/inventory/InventoryList.vue`

- [ ] **Step 1: 添加图片列**

修改 `columns` 定义，添加图片列：

```typescript
const columns = [
  { title: '图片', key: 'image', width: 80, align: 'center' },              // 新增
  { title: '类型', dataIndex: 'type', key: 'type', width: 100, align: 'center' },
  { title: '名称', dataIndex: 'name', key: 'name', width: 140, ellipsis: true, align: 'center' },
  { title: '编码', dataIndex: 'code', key: 'code', width: 130, align: 'center' },
  { title: '规格', key: 'specs', width: 240, align: 'center' },             // 宽度增加
  { title: '库存', key: 'currentStock', width: 100, align: 'center' },
  { title: '预警库存', key: 'warnStock', width: 110, align: 'center' },
  { title: '预警状态', key: 'warningStatus', width: 120, align: 'center' },
  { title: '操作', key: 'actions', width: 140, align: 'center' }
]
```

- [ ] **Step 2: 更新模板 - 添加图片列**

在模板中添加图片列显示：

```vue
<template v-else-if="column.key === 'image'">
  <a-image
    v-if="record.image_id"
    :src="`/api/file/${record.image_id}`"
    :width="50"
    :height="50"
    :preview="true"
    style="border-radius: 4px; object-fit: cover;"
  />
  <span v-else class="cell-muted">-</span>
</template>
```

- [ ] **Step 3: 更新模板 - 修改规格列**

更新规格列显示以支持新结构：

```vue
<template v-else-if="column.key === 'specs'">
  <template v-if="record.specs && record.specs.length > 0">
    <a-tag v-for="spec in record.specs" :key="spec.spec_id" class="spec-tag">
      {{ spec.spec || '默认' }}: {{ spec.current_stock }}
    </a-tag>
  </template>
  <span v-else class="cell-muted">-</span>
</template>
```

- [ ] **Step 4: 添加图片预览样式**

在 `<style scoped>` 中添加：

```scss
.cell-spec {
  font-size: 13px;
  color: #52525b;
}
```

---

## Task 8: 重构 ProductList 页面

**Files:**
- Modify: `src/views/inventory/ProductList.vue`

- [ ] **Step 1: 添加图片列**

修改 `columns` 定义，添加图片列：

```typescript
const columns = [
  { title: '图片', key: 'image', width: 80, align: 'center' },              // 新增
  { title: '产品名称', dataIndex: 'name', key: 'name', width: 240, ellipsis: true, align: 'center' },
  { title: '产品编码', dataIndex: 'code', key: 'code', width: 200, align: 'center' },
  { title: '产品描述', dataIndex: 'description', key: 'description', ellipsis: true, align: 'center' },
  { title: '操作', key: 'actions', width: 280, align: 'center' }
]
```

- [ ] **Step 2: 更新模板 - 添加图片列**

在模板中添加图片列显示：

```vue
<template v-else-if="column.key === 'image'">
  <a-image
    v-if="record.image_id"
    :src="`/api/file/${record.image_id}`"
    :width="50"
    :height="50"
    :preview="true"
    style="border-radius: 4px; object-fit: cover;"
  />
  <span v-else class="cell-muted">-</span>
</template>
```

- [ ] **Step 3: 添加图片预览样式**

在 `<style scoped>` 中添加：

```scss
.cell-muted {
  color: #a1a1aa;
}
```

---

## 完成后验证

- [ ] **运行类型检查**

```bash
npm run type-check
```

- [ ] **运行开发服务器**

```bash
npm run dev
```

- [ ] **功能测试清单**
  1. 零件创建（无图片）
  2. 零件创建（有图片）
  3. 零件编辑（替换图片）
  4. 零件规格编辑（新增、修改、删除）
  5. 产品创建（无图片）
  6. 产品创建（有图片）
  7. 产品编辑（替换图片）
  8. 产品-零件关联（选择规格）
  9. 零件列表（图片显示、规格库存显示）
  10. 产品列表（图片显示）
