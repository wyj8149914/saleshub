# 仓库管理前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现仓库管理前端功能，包括入库/出库选择仓库、零件详情查看库存分布、仓库管理页面。

**Architecture:** 前端基于 Vue 3 + TypeScript + Ant Design Vue，复用现有组件模式。后端API已完整支持，只需修改前端类型、API调用和界面。

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue, dayjs

---

## 文件结构

### 新增文件
```
saleshub_web/src/
├── views/inventory/
│   └── WarehouseList.vue          # 仓库管理页面
├── components/inventory/
│   ├── InventoryItemDetail.vue    # 零件详情弹窗
│   ├── WarehouseForm.vue          # 仓库新建/编辑弹窗
│   └── WarehouseSelect.vue        # 仓库选择组件(可复用)
└── types/
    └── warehouse.ts               # 仓库相关类型定义
```

### 修改文件
```
saleshub_web/src/
├── types/inventory.ts             # 添加 warehouse_id 到 Payload 类型
├── api/inventory.ts               # 添加仓库相关API
├── views/inventory/
│   ├── StockIn.vue                # 入库记录页面(无需改动)
│   └── StockOut.vue               # 出库记录页面(无需改动)
├── components/inventory/
│   ├── StockInModal.vue           # 入库弹窗(调整布局+仓库选择)
│   └── StockOutModal.vue          # 出库弹窗(仓库选择+可用库存)
└── router/index.ts                # 添加仓库管理路由
```

---

## Task 1: 添加仓库相关类型定义

**Files:**
- Create: `saleshub_web/src/types/warehouse.ts`
- Modify: `saleshub_web/src/types/inventory.ts`

- [ ] **Step 1: 创建 warehouse.ts 类型文件**

```typescript
// saleshub_web/src/types/warehouse.ts

export interface Warehouse {
    warehouse_id: string
    name: string
    location: string | null
    status: 1 | 2
    create_time: string
    update_time: string | null
}

export interface WarehouseListQuery {
    pageIndex: number
    pageSize: number
    status?: 1 | 2
}

export interface WarehouseCreatePayload {
    name: string
    location?: string
}

export interface WarehouseUpdatePayload {
    warehouse_id: string
    name: string
    location?: string
}

export interface SpecWarehouseStock {
    id: string
    warehouse_id: string
    warehouse_name: string
    warehouse_location: string | null
    current_stock: number
}
```

- [ ] **Step 2: 更新 inventory.ts 添加 warehouse_id**

修改 `saleshub_web/src/types/inventory.ts`：

在 `StockInPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockInPayload {
    warehouse_id: string  // 新增
    item_id: string
    spec_id: string
    quantity: number
    date: string
    photo_id: string
    remark?: string
}
```

在 `StockInBatchPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockInBatchPayload {
    warehouse_id: string  // 新增
    items: StockInBatchItem[]
    date: string
    photo_id: string
    remark?: string
}
```

在 `StockOutPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockOutPayload {
    warehouse_id: string  // 新增
    item_id: string
    spec_id: string
    quantity: number
    date: string
    remark?: string
}
```

在 `StockOutBatchPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockOutBatchPayload {
    warehouse_id: string  // 新增
    items: StockOutBatchItem[]
    date: string
    remark?: string
}
```

在 `StockOutByProductPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockOutByProductPayload {
    warehouse_id: string  // 新增
    product_id: string
    quantity: number
    date: string
    remark?: string
}
```

在 `StockCheckPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockCheckPayload {
    warehouse_id: string  // 新增
    item_id: string
    spec_id: string
    after_stock: number
    date: string
    remark?: string
}
```

在 `StockCheckBatchPayload` 接口添加 `warehouse_id`：
```typescript
export interface StockCheckBatchPayload {
    warehouse_id: string  // 新增
    items: StockCheckBatchItem[]
    date: string
    remark?: string
}
```

在 `StockInRecord` 和 `StockOutRecord` 接口添加 `warehouse_id` 和 `warehouse_name`：
```typescript
export interface StockInRecord {
    record_id: string
    record_no: string
    warehouse_id: string       // 新增
    warehouse_name: string     // 新增
    date: string
    quantity: number
    remark: string | null
    photo_id: string | null
    photo_url: string | null
    before_stock: number
    after_stock: number
    item_name: string | null
    spec: string | null
    create_time: string
}

export interface StockOutRecord {
    record_id: string
    record_no: string
    warehouse_id: string       // 新增
    warehouse_name: string     // 新增
    date: string
    quantity: number
    remark: string | null
    before_stock: number
    after_stock: number
    item_name: string | null
    spec: string | null
    create_time: string
}
```

---

## Task 2: 添加仓库相关API

**Files:**
- Modify: `saleshub_web/src/api/inventory.ts`

- [ ] **Step 1: 导入仓库类型**

在文件顶部添加导入：
```typescript
import type {
    // ... 现有导入
    Warehouse, WarehouseListQuery, WarehouseCreatePayload, WarehouseUpdatePayload, SpecWarehouseStock
} from '@/types/warehouse'
```

- [ ] **Step 2: 添加仓库API方法**

在 `inventoryApi` 对象中添加：
```typescript
// ---- 仓库 ----
listWarehouses(query?: { status?: 1 | 2 }) {
    return http.get<Warehouse[]>('/saleshub/inventory/listWarehouses', { params: query || {} })
},

createWarehouse(payload: WarehouseCreatePayload) {
    return http.post('/saleshub/inventory/createWarehouse', payload)
},

updateWarehouse(payload: WarehouseUpdatePayload) {
    return http.post('/saleshub/inventory/updateWarehouse', payload)
},

deleteWarehouse(warehouse_id: string) {
    return http.post('/saleshub/inventory/deleteWarehouse', { warehouse_id })
},

// 查询规格在各仓库的库存分布
listSpecWarehouseStock(spec_id: string) {
    return http.get<SpecWarehouseStock[]>('/saleshub/inventory/listSpecWarehouseStock', { params: { spec_id } })
},
```

---

## Task 3: 创建仓库选择组件

**Files:**
- Create: `saleshub_web/src/components/inventory/WarehouseSelect.vue`

- [ ] **Step 1: 创建 WarehouseSelect.vue 组件**

```vue
<template>
  <a-select
    :value="modelValue"
    :placeholder="placeholder"
    :loading="loading"
    :disabled="disabled"
    allow-clear
    show-search
    :filter-option="filterOption"
    @update:value="$emit('update:modelValue', $event)"
    @change="handleChange"
  >
    <a-select-option v-for="w in warehouses" :key="w.warehouse_id" :value="w.warehouse_id">
      {{ w.name }}{{ w.location ? ` (${w.location})` : '' }}
    </a-select-option>
  </a-select>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { inventoryApi } from '@/api/inventory'
import type { Warehouse } from '@/types/warehouse'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  status?: 1 | 2
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '请选择仓库',
  disabled: false,
  status: 1
})

interface Emits {
  (e: 'update:modelValue', value: string | undefined): void
  (e: 'change', value: string | undefined, warehouse: Warehouse | undefined): void
}

const emit = defineEmits<Emits>()

const loading = ref(false)
const warehouses = ref<Warehouse[]>([])

const filterOption = (input: string, option: { children: string }) => {
  return option.children.toLowerCase().includes(input.toLowerCase())
}

const loadWarehouses = async () => {
  loading.value = true
  try {
    const res = await inventoryApi.listWarehouses({ status: props.status })
    warehouses.value = res.datas || res
  } catch {
    warehouses.value = []
  } finally {
    loading.value = false
  }
}

const handleChange = (value: string | undefined) => {
  const warehouse = warehouses.value.find(w => w.warehouse_id === value)
  emit('change', value, warehouse)
}

watch(() => props.status, () => {
  loadWarehouses()
})

onMounted(() => {
  loadWarehouses()
})

defineExpose({ refresh: loadWarehouses })
</script>
```

---

## Task 4: 改造入库弹窗

**Files:**
- Modify: `saleshub_web/src/components/inventory/StockInModal.vue`

- [ ] **Step 1: 导入仓库选择组件**

在 `<script setup>` 中添加导入：
```typescript
import WarehouseSelect from './WarehouseSelect.vue'
```

- [ ] **Step 2: 修改 form 数据结构**

修改 `form` 响应式对象，添加 `warehouse_id`：
```typescript
const form = reactive({
  warehouse_id: '',      // 新增
  item_id: '',
  spec_id: '',
  quantity: 1 as number,
  date: dayjs() as Dayjs,
  photo_id: '',
  remark: ''
})
```

- [ ] **Step 3: 修改 batchRows 数据结构**

```typescript
interface BatchRow {
  item_id: string
  spec_id: string
  quantity: number
}
// batchRows 不需要 warehouse_id，因为批量入库时仓库在顶部统一选择
```

- [ ] **Step 4: 修改单条入库模板**

修改 `<template>` 中单条入库部分：
```vue
<!-- 单条入库 -->
<template v-if="mode === 'single'">
  <a-form-item label="仓库" name="warehouse_id" :rules="[{ required: true, message: '请选择仓库' }]">
    <WarehouseSelect v-model="form.warehouse_id" />
  </a-form-item>

  <a-row :gutter="12">
    <a-col :span="12">
      <a-form-item label="入库日期" name="date" :rules="[{ required: true, message: '请选择入库日期' }]">
        <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item label="数量" name="quantity"
        :rules="[{ required: true, message: '请输入数量' }, { type: 'number', min: 1, message: '数量必须大于0' }]">
        <a-input-number v-model:value="form.quantity" placeholder="数量" :min="1" :precision="0"
          style="width: 100%" />
      </a-form-item>
    </a-col>
  </a-row>

  <a-row :gutter="12">
    <a-col :span="showSpecSelect ? 12 : 24">
      <a-form-item label="零件" name="item_id" :rules="[{ required: true, message: '请选择零件' }]">
        <a-select v-model:value="form.item_id" placeholder="请选择零件" show-search :filter-option="filterOption"
          :loading="itemsLoading" :options="itemOptions" @change="handleSingleItemChange" />
      </a-form-item>
    </a-col>
    <a-col v-if="showSpecSelect" :span="12">
      <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
        <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions" />
      </a-form-item>
    </a-col>
  </a-row>
</template>
```

- [ ] **Step 5: 修改批量入库模板**

修改 `<template>` 中批量入库部分：
```vue
<!-- 批量入库 -->
<template v-else>
  <a-form-item label="仓库" name="warehouse_id" :rules="[{ required: true, message: '请选择仓库' }]">
    <WarehouseSelect v-model="form.warehouse_id" />
  </a-form-item>

  <a-form-item label="入库日期" name="date" :rules="[{ required: true, message: '请选择入库日期' }]">
    <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
  </a-form-item>

  <a-form-item label="入库照片" name="photo_id">
    <a-upload v-model:file-list="fileList" :before-upload="beforeUpload" :custom-request="handleUpload"
      :max-count="1" list-type="picture-card" :disabled="uploading">
      <div v-if="fileList.length < 1 && !uploading">
        <plus-outlined />
        <div style="margin-top: 8px">上传照片</div>
      </div>
    </a-upload>
  </a-form-item>

  <a-form-item label="备注" name="remark">
    <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选，本批次共用）" :rows="3" :maxlength="500" show-count />
  </a-form-item>

  <div class="batch-header">
    <span class="batch-label">入库明细</span>
    <a-button type="link" size="small" @click="addRow">
      <PlusOutlined />
      添加一行
    </a-button>
  </div>

  <div v-for="(row, idx) in batchRows" :key="idx" class="batch-row">
    <a-select class="row-item" :value="row.item_id" placeholder="选择零件" show-search :filter-option="filterOption"
      :options="itemOptions" @change="(v: string) => handleRowItemChange(idx, v)" />

    <a-select v-if="needsSpec(row.item_id)" class="row-spec" :value="row.spec_id" placeholder="规格"
      :options="specOptionsFor(row.item_id)" @change="(v: string) => (row.spec_id = v)" />

    <a-input-number class="row-qty" :value="row.quantity" placeholder="数量" :min="1" :precision="0"
      @change="(v: number | null) => (row.quantity = v ?? 1)" />

    <a-button class="row-del" type="link" danger :disabled="batchRows.length === 1" @click="removeRow(idx)">
      <DeleteOutlined />
    </a-button>
  </div>
</template>
```

- [ ] **Step 6: 修改单条入库提交逻辑**

修改 `handleSubmit` 函数中单条入库部分：
```typescript
if (mode.value === 'single') {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    const res = await inventoryApi.stockIn({
      warehouse_id: form.warehouse_id,  // 新增
      item_id: form.item_id,
      spec_id: form.spec_id,
      quantity: form.quantity,
      date: dateStr,
      photo_id: form.photo_id,
      remark: form.remark || undefined
    })
    if (res.result === 0) {
      message.success('入库成功')
      emit('update:visible', false)
      emit('success')
    } else {
      message.error(res.msg || '入库失败')
    }
  } catch (error) {
    console.error('入库失败:', error)
  } finally {
    loading.value = false
  }
  return
}
```

- [ ] **Step 7: 修改批量入库提交逻辑**

修改 `handleSubmit` 函数中批量入库部分：
```typescript
// 批量
const err = validateBatch()
if (err) {
  message.warning(err)
  return
}
loading.value = true
try {
  const res = await inventoryApi.stockInBatch({
    warehouse_id: form.warehouse_id,  // 新增
    items: batchRows.value.map((r) => ({
      item_id: r.item_id,
      spec_id: r.spec_id,
      quantity: r.quantity
    })),
    date: dateStr,
    photo_id: form.photo_id,
    remark: form.remark || undefined
  })
  if (res.result === 0) {
    message.success('批量入库成功')
    emit('update:visible', false)
    emit('success')
  } else {
    message.error(res.msg || '入库失败')
  }
} catch (error) {
  console.error('批量入库失败:', error)
} finally {
  loading.value = false
}
```

- [ ] **Step 8: 修改 resetForm 函数**

```typescript
const resetForm = () => {
  mode.value = 'single'
  form.warehouse_id = ''   // 新增
  form.item_id = ''
  form.spec_id = ''
  form.quantity = 1
  form.date = dayjs()
  form.photo_id = ''
  form.remark = ''
  batchRows.value = [{ item_id: '', spec_id: '', quantity: 1 }]
  fileList.value = []
  formRef.value?.clearValidate()
}
```

---

## Task 5: 创建出库弹窗

**Files:**
- Modify: `saleshub_web/src/components/inventory/StockOutModal.vue`

先读取现有出库弹窗代码，然后进行类似入库弹窗的改造。

- [ ] **Step 1: 导入仓库选择组件**

在 `<script setup>` 中添加导入：
```typescript
import WarehouseSelect from './WarehouseSelect.vue'
```

- [ ] **Step 2: 添加仓库相关状态和库存查询逻辑**

```typescript
const selectedWarehouseId = ref<string>('')
const availableStock = ref<number | null>(null)
const warehousesWithStock = ref<Map<string, Map<string, number>>>(new Map())

// 查询某规格在某仓库的库存
const loadSpecWarehouseStock = async (specId: string) => {
  if (!specId) {
    availableStock.value = null
    return
  }
  try {
    const res = await inventoryApi.listSpecWarehouseStock(specId)
    if (res.result === 0) {
      const stockMap = new Map<string, number>()
      for (const item of (res.datas || [])) {
        stockMap.set(item.warehouse_id, item.current_stock)
      }
      warehousesWithStock.value.set(specId, stockMap)
      if (selectedWarehouseId.value) {
        availableStock.value = stockMap.get(selectedWarehouseId.value) || 0
      }
    }
  } catch {
    availableStock.value = null
  }
}

// 监听仓库选择变化
watch(selectedWarehouseId, (warehouseId) => {
  if (warehouseId && form.spec_id) {
    const stockMap = warehousesWithStock.value.get(form.spec_id)
    availableStock.value = stockMap?.get(warehouseId) || 0
  } else {
    availableStock.value = null
  }
})
```

- [ ] **Step 3: 修改单条出库模板**

```vue
<!-- 单条出库 -->
<template v-if="mode === 'single'">
  <a-form-item label="仓库" name="warehouse_id" :rules="[{ required: true, message: '请选择仓库' }]">
    <WarehouseSelect v-model="form.warehouse_id" @change="handleWarehouseChange" />
  </a-form-item>

  <a-row :gutter="12">
    <a-col :span="12">
      <a-form-item label="出库日期" name="date" :rules="[{ required: true, message: '请选择出库日期' }]">
        <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item label="数量" name="quantity"
        :rules="[{ required: true, message: '请输入数量' }, { type: 'number', min: 1, message: '数量必须大于0' }]">
        <a-input-number v-model:value="form.quantity" placeholder="数量" :min="1" :precision="0"
          style="width: 100%" :max="availableStock || undefined" />
      </a-form-item>
    </a-col>
  </a-row>

  <a-row :gutter="12">
    <a-col :span="showSpecSelect ? 12 : 24">
      <a-form-item label="零件" name="item_id" :rules="[{ required: true, message: '请选择零件' }]">
        <a-select v-model:value="form.item_id" placeholder="请选择零件" show-search :filter-option="filterOption"
          :loading="itemsLoading" :options="itemOptions" @change="handleSingleItemChange" />
      </a-form-item>
    </a-col>
    <a-col v-if="showSpecSelect" :span="12">
      <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
        <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions"
          @change="handleSpecChange" />
      </a-form-item>
    </a-col>
  </a-row>

  <a-form-item v-if="availableStock !== null" label="可用库存">
    <span class="stock-available">{{ availableStock }}</span>
  </a-form-item>

  <a-form-item label="备注" name="remark">
    <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="3" :maxlength="500" show-count />
  </a-form-item>
</template>
```

- [ ] **Step 4: 添加样式**

```css
.stock-available {
  font-weight: 600;
  font-size: 16px;
  color: #16a34a;
}
```

- [ ] **Step 5: 修改提交逻辑添加 warehouse_id**

类似入库弹窗的修改。

---

## Task 6: 创建零件详情弹窗

**Files:**
- Create: `saleshub_web/src/components/inventory/InventoryItemDetail.vue`

- [ ] **Step 1: 创建 InventoryItemDetail.vue 组件**

```vue
<template>
  <a-modal
    :open="visible"
    title="零件详情"
    :footer="null"
    :width="720"
    @cancel="handleClose"
  >
    <a-spin :spinning="loading">
      <div v-if="item" class="detail-content">
        <!-- 基本信息 -->
        <div class="section">
          <div class="section-title">基本信息</div>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="零件名称">{{ item.name }}</a-descriptions-item>
            <a-descriptions-item label="编码">{{ item.code }}</a-descriptions-item>
            <a-descriptions-item label="零件类型">{{ item.type_full_name || item.type_name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="是否定制">{{ item.is_custom === 2 ? '是' : '否' }}</a-descriptions-item>
            <a-descriptions-item label="预警库存">{{ item.warn_stock }}</a-descriptions-item>
            <a-descriptions-item label="备注">{{ item.remark || '-' }}</a-descriptions-item>
          </a-descriptions>
        </div>

        <!-- 规格信息 -->
        <div class="section">
          <div class="section-title">规格信息</div>
          <a-table
            :columns="specColumns"
            :data-source="item.specs"
            :pagination="false"
            row-key="spec_id"
            size="small"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'spec'">
                <span>{{ record.spec || '默认' }}</span>
              </template>
              <template v-if="column.key === 'price'">
                <span v-if="record.price !== null && record.price !== undefined">¥{{ record.price }}</span>
                <span v-else class="text-muted">-</span>
              </template>
              <template v-if="column.key === 'current_stock'">
                <span class="stock-num" :class="{ 'text-danger': record.current_stock <= item.warn_stock }">
                  {{ record.current_stock }}
                </span>
              </template>
            </template>
          </a-table>
        </div>

        <!-- 库存分布 -->
        <div class="section">
          <div class="section-title">库存分布</div>
          <div v-for="spec in item.specs" :key="spec.spec_id" class="spec-distribution">
            <div class="spec-header" @click="toggleSpec(spec.spec_id)">
              <span class="spec-name">{{ spec.spec || '默认' }}</span>
              <span class="spec-total">总库存: {{ spec.current_stock }}</span>
              <DownOutlined :class="{ 'expanded': expandedSpecs.has(spec.spec_id) }" />
            </div>
            <div v-if="expandedSpecs.has(spec.spec_id)" class="warehouse-list">
              <a-table
                v-if="specStockData[spec.spec_id]?.length"
                :columns="warehouseColumns"
                :data-source="specStockData[spec.spec_id]"
                :pagination="false"
                size="small"
                bordered
              />
              <a-empty v-else description="暂无库存分布" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
            </div>
          </div>
        </div>

        <!-- 总库存 -->
        <div class="total-stock">
          总库存: <span class="total-num">{{ totalStock }}</span>
        </div>
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { DownOutlined, Empty } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import type { InventoryItem } from '@/types/inventory'
import type { SpecWarehouseStock } from '@/types/warehouse'

interface Props {
  visible: boolean
  item: InventoryItem | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const emit = defineEmits<Emits>()

const loading = ref(false)
const expandedSpecs = ref<Set<string>>(new Set())
const specStockData = ref<Record<string, SpecWarehouseStock[]>>({})

const specColumns = [
  { title: '规格名称', dataIndex: 'spec', key: 'spec', width: 150, align: 'center' },
  { title: '价格', dataIndex: 'price', key: 'price', width: 120, align: 'center' },
  { title: '总库存', dataIndex: 'current_stock', key: 'current_stock', width: 120, align: 'center' }
]

const warehouseColumns = [
  { title: '仓库名称', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 150, align: 'center' },
  { title: '位置', dataIndex: 'warehouse_location', key: 'warehouse_location', width: 150, align: 'center' },
  { title: '库存数量', dataIndex: 'current_stock', key: 'current_stock', width: 120, align: 'center' }
]

const totalStock = computed(() => {
  if (!props.item?.specs) return 0
  return props.item.specs.reduce((sum, spec) => sum + spec.current_stock, 0)
})

const toggleSpec = async (specId: string) => {
  if (expandedSpecs.value.has(specId)) {
    expandedSpecs.value.delete(specId)
  } else {
    expandedSpecs.value.add(specId)
    if (!specStockData.value[specId]) {
      await loadSpecWarehouseStock(specId)
    }
  }
}

const loadSpecWarehouseStock = async (specId: string) => {
  try {
    const res = await inventoryApi.listSpecWarehouseStock(specId)
    if (res.result === 0) {
      specStockData.value[specId] = res.datas || []
    }
  } catch {
    specStockData.value[specId] = []
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val) {
    expandedSpecs.value.clear()
    specStockData.value = {}
  }
})
</script>

<style scoped>
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.section-title {
  padding: 12px 16px;
  background: #fafafa;
  font-weight: 600;
  font-size: 14px;
  color: #52525b;
  border-bottom: 1px solid #f0f0f0;
}

.spec-distribution {
  border-bottom: 1px solid #f0f0f0;
}

.spec-distribution:last-child {
  border-bottom: none;
}

.spec-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: #fff;
  transition: background 0.2s;
}

.spec-header:hover {
  background: #f5f5f5;
}

.spec-name {
  flex: 1;
  font-weight: 500;
}

.spec-total {
  margin-right: 8px;
  color: #71717a;
  font-size: 13px;
}

.spec-header .anticon {
  transition: transform 0.2s;
}

.spec-header .anticon.expanded {
  transform: rotate(180deg);
}

.warehouse-list {
  padding: 12px 16px;
  background: #fafafa;
}

.stock-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stock-num.text-danger {
  color: #dc2626;
}

.text-muted {
  color: #a1a1aa;
}

.total-stock {
  text-align: right;
  padding: 8px 0;
  font-size: 14px;
  color: #52525b;
}

.total-num {
  font-weight: 600;
  font-size: 18px;
  color: #18181b;
  margin-left: 4px;
}
</style>
```

---

## Task 7: 修改零件列表页面添加详情按钮

**Files:**
- Modify: `saleshub_web/src/views/inventory/InventoryList.vue`

- [ ] **Step 1: 导入零件详情组件**

```typescript
import InventoryItemDetail from '@/components/inventory/InventoryItemDetail.vue'
```

- [ ] **Step 2: 添加详情弹窗状态**

```typescript
const detailVisible = ref(false)
const detailItem = ref<InventoryItem | null>(null)
```

- [ ] **Step 3: 添加查看详情方法**

```typescript
const handleDetail = (item: InventoryItem) => {
  detailItem.value = item
  detailVisible.value = true
}
```

- [ ] **Step 4: 修改操作列模板**

```vue
<template v-else-if="column.key === 'actions'">
  <div class="actions-cell" @click.stop>
    <a-space :size="4">
      <a-button type="link" size="small" @click="handleDetail(record)">详情</a-button>
      <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
      <a-popconfirm title="确定要删除此零件吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record)"
        placement="left">
        <a-button type="link" size="small" danger>删除</a-button>
      </a-popconfirm>
    </a-space>
  </div>
</template>
```

- [ ] **Step 5: 添加详情弹窗组件**

在模板末尾添加：
```vue
<InventoryItemDetail v-model:visible="detailVisible" :item="detailItem" />
```

---

## Task 8: 创建仓库表单弹窗

**Files:**
- Create: `saleshub_web/src/components/inventory/WarehouseForm.vue`

- [ ] **Step 1: 创建 WarehouseForm.vue 组件**

```vue
<template>
  <a-modal
    :open="visible"
    :title="isEdit ? '编辑仓库' : '新建仓库'"
    :confirm-loading="loading"
    :mask-closable="false"
    ok-text="确定"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="仓库名称" name="name" :rules="[{ required: true, message: '请输入仓库名称' }]">
        <a-input v-model:value="form.name" placeholder="请输入仓库名称" :maxlength="100" />
      </a-form-item>

      <a-form-item label="位置" name="location">
        <a-input v-model:value="form.location" placeholder="请输入位置（可选）" :maxlength="200" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import { inventoryApi } from '@/api/inventory'
import type { Warehouse } from '@/types/warehouse'

interface Props {
  visible: boolean
  warehouse: Warehouse | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const emit = defineEmits<Emits>()

const formRef = ref()
const loading = ref(false)

const isEdit = ref(false)
const form = reactive({
  name: '',
  location: ''
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    if (isEdit.value && props.warehouse) {
      const res = await inventoryApi.updateWarehouse({
        warehouse_id: props.warehouse.warehouse_id,
        name: form.name,
        location: form.location || undefined
      })
      if (res.result === 0) {
        message.success('更新成功')
        emit('update:visible', false)
        emit('success')
      } else {
        message.error(res.msg || '更新失败')
      }
    } else {
      const res = await inventoryApi.createWarehouse({
        name: form.name,
        location: form.location || undefined
      })
      if (res.result === 0) {
        message.success('创建成功')
        emit('update:visible', false)
        emit('success')
      } else {
        message.error(res.msg || '创建失败')
      }
    }
  } catch (error) {
    console.error('操作失败:', error)
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val) {
    isEdit.value = !!props.warehouse
    if (props.warehouse) {
      form.name = props.warehouse.name
      form.location = props.warehouse.location || ''
    } else {
      form.name = ''
      form.location = ''
    }
    formRef.value?.clearValidate()
  }
})
</script>
```

---

## Task 9: 创建仓库管理页面

**Files:**
- Create: `saleshub_web/src/views/inventory/WarehouseList.vue`

- [ ] **Step 1: 创建 WarehouseList.vue 页面**

```vue
<template>
  <div class="page">
    <div class="page-head">
      <a-button type="primary" class="create-btn" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建仓库
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="warehouses"
        :loading="loading"
        :pagination="pagination"
        bordered
        row-key="warehouse_id"
        :expand-row-by-click="true"
        @change="handleTableChange"
      >
        <template #expandedRowRender="{ record }">
          <a-table
            :columns="stockColumns"
            :data-source="warehouseStockData[record.warehouse_id] || []"
            :loading="stockLoading[record.warehouse_id]"
            :pagination="false"
            size="small"
            bordered
            class="stock-sub-table"
          >
            <template #bodyCell="{ column, record: stock }">
              <template v-if="column.key === 'current_stock'">
                <span class="stock-num" :class="{ 'text-danger': stock.current_stock <= stock.warn_stock }">
                  {{ stock.current_stock }}
                </span>
              </template>
              <template v-if="column.key === 'warningStatus'">
                <a-tag :class="stock.current_stock <= stock.warn_stock ? 'tag-warning' : 'tag-normal'">
                  {{ stock.current_stock <= stock.warn_stock ? '库存不足' : '正常' }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :class="record.status === 1 ? 'tag-normal' : 'tag-disabled'">
              {{ record.status === 1 ? '正常' : '停用' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <div class="actions-cell">
              <a-space :size="4">
                <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除此仓库吗？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="handleDelete(record)"
                  placement="left"
                >
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <WarehouseForm v-model:visible="formVisible" :warehouse="currentWarehouse" @success="handleFormSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import type { Warehouse } from '@/types/warehouse'
import WarehouseForm from '@/components/inventory/WarehouseForm.vue'

interface WarehouseStock {
  item_name: string
  spec: string
  current_stock: number
  warn_stock: number
}

const columns = [
  { title: '仓库名称', dataIndex: 'name', key: 'name', width: 150, align: 'center' },
  { title: '位置', dataIndex: 'location', key: 'location', width: 200, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' },
  { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 170, align: 'center' },
  { title: '操作', key: 'actions', width: 150, align: 'center' }
]

const stockColumns = [
  { title: '零件名称', dataIndex: 'item_name', key: 'item_name', width: 150, align: 'center' },
  { title: '规格', dataIndex: 'spec', key: 'spec', width: 120, align: 'center' },
  { title: '库存数量', dataIndex: 'current_stock', key: 'current_stock', width: 100, align: 'center' },
  { title: '预警状态', key: 'warningStatus', width: 100, align: 'center' }
]

const loading = ref(false)
const warehouses = ref<Warehouse[]>([])
const formVisible = ref(false)
const currentWarehouse = ref<Warehouse | null>(null)
const warehouseStockData = ref<Record<string, WarehouseStock[]>>({})
const stockLoading = ref<Record<string, boolean>>({})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const loadWarehouses = async () => {
  loading.value = true
  try {
    const res = await inventoryApi.listWarehouses()
    warehouses.value = res.datas || res
    pagination.total = warehouses.value.length
  } catch {
    warehouses.value = []
  } finally {
    loading.value = false
  }
}

const handleTableChange = async (pag: any, _filters: any, sorter: any) => {
  // 展开时加载库存数据
  if (sorter.action === 'expand') {
    const warehouseId = sorter.target?.warehouse_id
    if (warehouseId && !warehouseStockData.value[warehouseId]) {
      await loadWarehouseStock(warehouseId)
    }
  }
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
}

const loadWarehouseStock = async (warehouseId: string) => {
  stockLoading.value[warehouseId] = true
  try {
    // TODO: 后端需要新增接口查询某仓库的库存明细
    // 暂时使用空数组
    warehouseStockData.value[warehouseId] = []
  } catch {
    warehouseStockData.value[warehouseId] = []
  } finally {
    stockLoading.value[warehouseId] = false
  }
}

const handleCreate = () => {
  currentWarehouse.value = null
  formVisible.value = true
}

const handleEdit = (warehouse: Warehouse) => {
  currentWarehouse.value = warehouse
  formVisible.value = true
}

const handleDelete = async (warehouse: Warehouse) => {
  try {
    const res = await inventoryApi.deleteWarehouse(warehouse.warehouse_id)
    if (res.result === 0) {
      message.success('删除成功')
      await loadWarehouses()
    } else {
      message.error(res.msg || '删除失败')
    }
  } catch {
    // 错误已处理
  }
}

const handleFormSuccess = () => {
  formVisible.value = false
  loadWarehouses()
}

onMounted(() => {
  loadWarehouses()
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  justify-content: flex-end;
}

.create-btn {
  border-radius: 8px;
  background: #2563eb;
  border-color: #2563eb;
  font-weight: 500;
}

.create-btn:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.table-card {
  border-radius: 12px;
}

.table-card :deep(.ant-card-body) {
  padding: 0;
}

.table-card :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  color: #52525b;
}

.stock-sub-table {
  margin: 0 16px 8px 48px;
}

.stock-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stock-num.text-danger {
  color: #dc2626;
}

.tag-normal {
  background: rgba(16, 185, 129, 0.1) !important;
  color: #059669 !important;
  border-color: transparent !important;
  border-radius: 4px;
}

.tag-warning {
  background: rgba(220, 38, 38, 0.1) !important;
  color: #dc2626 !important;
  border-color: transparent !important;
  border-radius: 4px;
}

.tag-disabled {
  background: rgba(161, 161, 170, 0.1) !important;
  color: #71717a !important;
  border-color: transparent !important;
  border-radius: 4px;
}

.actions-cell :deep(.ant-btn-link) {
  padding: 4px 8px;
  height: auto;
}
</style>
```

---

## Task 10: 添加路由配置

**Files:**
- Modify: `saleshub_web/src/router/index.ts`

- [ ] **Step 1: 添加仓库管理路由**

在库存管理路由组中添加：
```typescript
{
  path: 'warehouse',
  name: 'WarehouseList',
  component: () => import('@/views/inventory/WarehouseList.vue'),
  meta: { title: '仓库管理' }
}
```

---

## Task 11: 后端补充接口

**Files:**
- Modify: `saleshub_web/src/api/inventory.ts`
- Modify: `saleshub_web/src/types/inventory.ts`

需要确认或新增后端接口：查询某仓库的库存明细列表。

- [ ] **Step 1: 添加仓库库存查询类型**

在 `types/warehouse.ts` 中添加：
```typescript
export interface WarehouseStockItem {
  item_id: string
  item_name: string
  spec_id: string
  spec: string
  current_stock: number
  warn_stock: number
}
```

- [ ] **Step 2: 添加仓库库存查询API**

在 `api/inventory.ts` 中添加：
```typescript
listWarehouseStock(warehouse_id: string) {
  return http.get<WarehouseStockItem[]>('/saleshub/inventory/listWarehouseStock', {
    params: { warehouse_id }
  })
},
```

**注意**：此接口需要后端新增，前端先预留。

---

## 执行顺序总结

1. **Task 1-2**: 类型定义和API（基础设施）
2. **Task 3**: 仓库选择组件（可复用）
3. **Task 4-5**: 入库/出库弹窗改造（核心功能）
4. **Task 6-7**: 零件详情弹窗（查看功能）
5. **Task 8-9**: 仓库管理页面（管理功能）
6. **Task 10**: 路由配置
7. **Task 11**: 后端补充接口（可选）

每个Task完成后可独立测试和提交。
