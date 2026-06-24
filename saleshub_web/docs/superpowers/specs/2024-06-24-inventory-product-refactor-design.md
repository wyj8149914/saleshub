# 零件和产品模块重构设计文档

**日期**: 2024-06-24
**目标**: 适配服务端新接口规范，增强用户体验

## 1. 概述

本次重构的核心是**适配服务端新的数据结构**并**增强用户体验**。主要变化：

- **规格结构升级**：从简单字符串数组升级为对象数组 `{spec_id, spec, current_stock}`
- **图片功能**：零件和产品支持图片上传/预览/替换
- **规格选择**：产品-零件关联需要指定具体规格

修改范围：
- 1 个 API 文件 (`inventory.ts`)
- 1 个新增工具文件 (`upload.ts`)
- 4 个组件文件
- 2 个页面文件

架构保持不变，采用自下而上的修改顺序：API → 工具 → 组件 → 页面。

## 2. API 层设计 (`src/api/inventory.ts`)

### 新增类型

```typescript
// 文件上传响应
export interface FileUploadResponse {
  relation_id: string
  url: string
  hash: string
  is_duplicate: boolean
}

// 零件规格
export interface ItemSpec {
  spec_id: string
  spec: string
  current_stock: number
}
```

### 修改类型

1. **InventoryItem**：
   - `specs`: `string[]` → `ItemSpec[]`
   - 新增 `image_id: string | null`
   - `isWarning`: `boolean` → `1 | 2`

2. **Product**：
   - 新增 `image_id: string | null`

3. **ItemCreatePayload**：
   - 新增 `image_id?: string`

4. **ItemUpdatePayload**：
   - 新增 `image_id?: string`

5. **ProductCreatePayload**：
   - 新增 `image_id?: string`

6. **ProductUpdatePayload**：
   - 新增 `image_id?: string`

7. **ProductItemRelation**：
   - 新增 `spec_id: string`
   - 新增 `spec: string`

8. **ProductItemPayload**：
   - 新增 `spec_id: string`（必填）

### 新增文件上传 API

```typescript
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

## 3. 工具层设计 (`src/utils/upload.ts`)

封装通用文件上传逻辑：

```typescript
interface UploadOptions {
  maxSize?: number      // 默认 10MB
  acceptTypes?: string[] // 默认 ['image/*']
}

export async function uploadImage(
  file: File,
  options?: UploadOptions
): Promise<{ relationId: string; url: string }> {
  // 1. 校验文件类型
  // 2. 校验文件大小
  // 3. 调用 fileApi.uploadFile
  // 4. 返回 relation_id 和 url
}
```

## 4. 组件设计

### 4.1 SpecEditor 组件重构

**数据结构变化**：
```typescript
// 旧结构
type SpecValue = string

// 新结构
interface SpecValue {
  spec_id: string      // 编辑模式有值，创建模式为空或临时 ID
  spec: string         // 规格名称
}
```

**功能变化**：
- 编辑模式：显示现有规格的 `spec_id`（只读）和名称（可编辑）
- 创建模式：`spec_id` 为空，提交后由服务端生成
- 新增规格：`spec_id` 为 `temp_${Date.now()}_${index}`

**API 交互**：
- 创建时：提取 `spec` 数组发送给服务端
- 更新时：发送完整的 `{spec_id, spec}` 数组

### 4.2 InventoryItemForm 组件重构

**新增功能**：
1. 图片上传区域（使用 `a-upload` 组件）
2. 图片预览（编辑模式显示现有图片）
3. 替换图片（重新上传覆盖 `image_id`）

**UI 结构**：
```
[类型选择]
[名称输入]
[规格编辑] - 仅常用件
[预警阈值输入]
[图片上传区域]
  - 上传按钮
  - 预览图（如有）
  - 删除按钮（可选实现）
```

**表单状态**：
```typescript
interface FormData {
  type: ItemType
  name: string
  code: string
  specs: SpecValue[]  // 新结构
  warnStock: number | undefined
  image_id: string | undefined  // 新增
}
```

**数据转换**：
- 创建时：`specs` → 提取 `spec` 数组
- 更新时：`specs` → 提取 `{spec_id, spec}` 数组

### 4.3 ProductForm 组件重构

与 InventoryItemForm 类似的图片上传功能，但更简单（无规格）。

**UI 结构**：
```
[产品名称输入]
[产品描述输入]
[图片上传区域]
```

### 4.4 ProductItemsManager 组件重构

**核心变化**：零件选择改为扁平列表

**选项生成逻辑**：
```typescript
function generateOptions(items: InventoryItem[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const item of items) {
    if (!item.specs || item.specs.length === 0) {
      // 无规格：零件本身作为选项
      options.push({
        label: `${item.name}（${item.code}）`,
        value: item.item_id,
        specId: '',
        specName: ''
      })
    } else {
      // 有规格：每个规格作为独立选项
      for (const spec of item.specs) {
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

  return options
}
```

**已选列表更新**：
- 新增 `spec` 列显示规格名称
- 唯一性由 `item_id + spec_id` 组合确定

**提交数据**：
```typescript
items.map(i => ({
  item_id: i.item_id,
  spec_id: i.spec_id,      // 新增
  quantity_per_product: i.quantity_per_product,
  remark: i.remark
}))
```

## 5. 页面设计

### 5.1 InventoryList 页面重构

**新增列**：
- 图片列：显示缩略图（`image_id` 转换为 URL），点击可预览

**规格列更新**：
- 旧：显示规格名称标签
- 新：显示"规格: 库存"标签，如"不锈钢: 50"

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

### 5.2 ProductList 页面重构

**新增图片列**（与 InventoryList 类似）

## 6. 数据流设计

### 零件创建流程
```
用户操作 → 填写表单 → 上传图片（如有） → 提交
                ↓
         发送 { type, name, specs: string[], warnStock, image_id }
                ↓
         服务端创建零件 + 规格记录 → 返回 item_id
```

### 零件更新流程
```
用户操作 → 填写表单 → 上传新图片（如有） → 提交
                ↓
         发送 { item_id, type, name, specs: {spec_id, spec}[], warnStock, image_id }
                ↓
         服务端同步规格（识别新增/更新/删除） → 返回结果
```

### 产品-零件关联流程
```
用户操作 → 从扁平列表选择"零件-规格"组合 → 添加到已选列表
                ↓
         保存 → 发送完整关联数组 [{item_id, spec_id, quantity, remark}, ...]
                ↓
         服务端全量覆盖关联记录
```

## 7. 错误处理

- **文件上传失败**：显示错误提示，清空上传状态，允许重试
- **规格删除失败**（库存非零）：显示服务端返回的错误消息
- **网络错误**：由 `request.ts` 拦截器统一处理
- **图片预览失败**：显示占位图或错误提示

## 8. 实现顺序

1. API 层 (`inventory.ts`)
2. 工具层 (`upload.ts`)
3. SpecEditor 组件重构
4. InventoryItemForm 组件重构
5. ProductForm 组件重构
6. ProductItemsManager 组件重构
7. InventoryList 页面重构
8. ProductList 页面重构

## 9. 测试要点

- 文件上传：格式校验、大小限制、重复上传
- 规格编辑：新增、修改、删除（库存非零时删除失败）
- 图片功能：上传、预览、替换
- 产品-零件关联：规格选择、空规格处理
- 列表显示：规格库存显示、图片显示
