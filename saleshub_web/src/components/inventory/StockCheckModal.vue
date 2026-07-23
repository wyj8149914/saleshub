<template>
  <a-modal :open="visible" title="盘点" :confirm-loading="loading" :mask-closable="false" width="950px" ok-text="提交盘点"
    cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item>
        <a-radio-group v-model:value="mode" button-style="solid">
          <a-radio-button value="single">单条盘点</a-radio-button>
          <a-radio-button value="batch">批量盘点</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 单条盘点 -->
      <template v-if="mode === 'single'">
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="一级类型">
              <a-select v-model:value="singleParentTypeId" placeholder="选择一级类型" allow-clear :loading="typesLoading"
                @change="handleSingleParentTypeChange">
                <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
                  {{ t.type_name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item label="二级类型">
              <a-select v-model:value="singleChildTypeId" placeholder="选择二级类型" allow-clear :loading="typesLoading"
                @change="handleSingleChildTypeChange">
                <a-select-option v-for="t in singleChildTypes" :key="t.type_id" :value="t.type_id">
                  {{ t.type_name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :span="showSpecSelect ? 5 : 6">
            <a-form-item label="零件" name="item_id" :rules="[{ required: true, message: '请选择零件' }]">
              <a-select v-model:value="form.item_id" placeholder="请选择零件" show-search :filter-option="filterOption"
                :loading="singleItemsLoading" :options="singleItemOptions" @change="handleSingleItemChange" />
            </a-form-item>
          </a-col>

          <a-col v-if="showSpecSelect" :span="4">
            <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
              <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions"
                @change="handleSingleSpecChange" />
            </a-form-item>
          </a-col>

          <a-col :span="showSpecSelect ? 3 : 6">
            <a-form-item label="实际库存" name="after_stock"
              :rules="[{ required: true, message: '请输入实际库存' }, { type: 'number', min: 0, message: '库存不能小于0' }]">
              <a-input-number v-model:value="form.after_stock" placeholder="实际数量" :min="0" :precision="0"
                style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <div v-if="singleCurrentStock != null" class="stock-hint">
          系统当前库存：<strong>{{ singleCurrentStock }}</strong>
        </div>
      </template>

      <!-- 批量盘点：每行独立选择类型 -->
      <template v-else>
        <div class="batch-header">
          <span class="batch-label">盘点明细{{ batchRows.length > 1 ? '（同一批次共用单号）' : '' }}</span>
          <a-button type="link" size="small" @click="addRow">
            <PlusOutlined />
            添加一行
          </a-button>
        </div>

        <div v-for="(row, idx) in batchRows" :key="idx" class="batch-row">
          <a-select class="row-type" :value="row.parentTypeId" placeholder="一级类型" allow-clear :loading="typesLoading"
            @change="(v: string) => handleRowParentTypeChange(idx, v)">
            <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
              {{ t.type_name }}
            </a-select-option>
          </a-select>

          <a-select class="row-type" :value="row.childTypeId" placeholder="二级类型" allow-clear :loading="typesLoading"
            @change="(v: string) => handleRowChildTypeChange(idx, v)">
            <a-select-option v-for="t in row.childTypes" :key="t.type_id" :value="t.type_id">
              {{ t.type_name }}
            </a-select-option>
          </a-select>

          <a-select class="row-item" :value="row.item_id" placeholder="选择零件" show-search :filter-option="filterOption"
            :loading="singleItemsLoading" :options="getFilteredItemOptions(row)"
            @change="(v: string) => handleRowItemChange(idx, v)" />

          <a-select v-if="needsSpec(row)" class="row-spec" :value="row.spec_id" placeholder="规格"
            :options="specOptionsFor(row)" @change="(v: string) => handleRowSpecChange(idx, v)" />

          <a-input-number class="row-qty" :value="row.after_stock" placeholder="实际库存" :min="0" :precision="0"
            @change="(v: number | null) => (row.after_stock = v ?? 0)" />

          <a-button class="row-del" type="link" danger :disabled="batchRows.length === 1" @click="removeRow(idx)">
            <DeleteOutlined />
          </a-button>
        </div>
      </template>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="盘点日期" name="date" :rules="[{ required: true, message: '请选择盘点日期' }]">
            <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选，本批次共用）" :rows="3" :maxlength="500" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { inventoryApi } from '@/api/inventory'
import type { InventoryItem, ItemTypeNode } from '@/types/inventory'

interface Props {
  visible: boolean
}
const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}
const emit = defineEmits<Emits>()

const formRef = ref()
const loading = ref(false)

const mode = ref<'single' | 'batch'>('single')

const form = reactive({
  item_id: '',
  spec_id: '',
  after_stock: 0 as number,
  date: dayjs() as Dayjs,
  remark: '',
  warehouse_id: ''
})

// 类型相关（共享）
const typesLoading = ref(false)
const allTypes = ref<ItemTypeNode[]>([])
const parentTypes = ref<ItemTypeNode[]>([])

// 加载类型列表
const loadTypes = async () => {
  typesLoading.value = true
  try {
    const res = await inventoryApi.listItemTypes()
    allTypes.value = (res.datas || res) as ItemTypeNode[]
    parentTypes.value = allTypes.value
  } catch {
    // 错误由拦截器处理
  } finally {
    typesLoading.value = false
  }
}

// ========== 单条模式 ==========
const singleParentTypeId = ref<string | undefined>(undefined)
const singleChildTypeId = ref<string | undefined>(undefined)
const singleChildTypes = ref<ItemTypeNode[]>([])
const singleItemsLoading = ref(false)
const allSingleItems = ref<InventoryItem[]>([])  // 所有零件（未筛选）
const singleItems = ref<InventoryItem[]>([])     // 筛选后的零件

const singleItemOptions = computed(() =>
  singleItems.value.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }))
)

// 加载所有零件
const loadAllSingleItems = async () => {
  singleItemsLoading.value = true
  try {
    const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 })
    allSingleItems.value = res.datas.items || []
    singleItems.value = allSingleItems.value
  } catch {
    allSingleItems.value = []
    singleItems.value = []
  } finally {
    singleItemsLoading.value = false
  }
}

// 根据类型筛选零件
const filterSingleItems = () => {
  const typeId = singleChildTypeId.value || singleParentTypeId.value
  if (typeId) {
    singleItems.value = allSingleItems.value.filter(item => {
      if (item.type_id === typeId) return true
      const parent = allTypes.value.find(t => t.type_id === typeId)
      if (parent?.children?.some(c => c.type_id === item.type_id)) return true
      return false
    })
  } else {
    singleItems.value = allSingleItems.value
  }
}

const handleSingleParentTypeChange = (value: string | undefined) => {
  singleChildTypeId.value = undefined
  form.item_id = ''
  form.spec_id = ''
  form.after_stock = 0

  if (value) {
    const parent = allTypes.value.find(t => t.type_id === value)
    singleChildTypes.value = parent?.children || []
  } else {
    singleChildTypes.value = []
  }
  filterSingleItems()
}

const handleSingleChildTypeChange = (value: string | undefined) => {
  form.item_id = ''
  form.spec_id = ''
  form.after_stock = 0
  filterSingleItems()
}

const singleItem = computed(() => singleItems.value.find((i) => i.item_id === form.item_id))

const showSpecSelect = computed(() => {
  const item = singleItem.value
  if (!item?.specs?.length) return false
  return !(item.specs.length === 1 && item.specs[0]?.spec === '')
})

const singleSpecOptions = computed(() => {
  const item = singleItem.value
  if (!item?.specs) return []
  return item.specs.map((s) => ({
    label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
    value: s.spec_id
  }))
})

const singleCurrentStock = computed(() => {
  if (!form.spec_id) return null
  const spec = singleItem.value?.specs?.find(s => s.spec_id === form.spec_id)
  return spec?.current_stock ?? null
})

const handleSingleItemChange = () => {
  form.spec_id = ''
  form.after_stock = 0
  const defaultSpec = singleItem.value?.specs?.[0]
  if (singleItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
    form.spec_id = defaultSpec.spec_id
    form.after_stock = defaultSpec.current_stock
  }
}

const handleSingleSpecChange = (specId: string) => {
  const spec = singleItem.value?.specs?.find(s => s.spec_id === specId)
  if (spec) {
    form.after_stock = spec.current_stock
  }
}

// ========== 批量模式 ==========
const allBatchItems = ref<InventoryItem[]>([])  // 所有零件（共享）

interface BatchRow {
  parentTypeId: string | undefined
  childTypeId: string | undefined
  childTypes: ItemTypeNode[]
  item_id: string
  spec_id: string
  after_stock: number
}

const batchRows = ref<BatchRow[]>([createEmptyRow()])

function createEmptyRow(): BatchRow {
  return {
    parentTypeId: undefined,
    childTypeId: undefined,
    childTypes: [],
    item_id: '',
    spec_id: '',
    after_stock: 0
  }
}

// 根据类型筛选零件选项
const getFilteredItemOptions = (row: BatchRow) => {
  const typeId = row.childTypeId || row.parentTypeId
  let items = allBatchItems.value
  if (typeId) {
    items = items.filter(item => {
      if (item.type_id === typeId) return true
      const parent = allTypes.value.find(t => t.type_id === typeId)
      if (parent?.children?.some(c => c.type_id === item.type_id)) return true
      return false
    })
  }
  return items.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }))
}

// 获取当前行的零件列表（用于规格选择）
const getRowItems = (row: BatchRow) => {
  const typeId = row.childTypeId || row.parentTypeId
  let items = allBatchItems.value
  if (typeId) {
    items = items.filter(item => {
      if (item.type_id === typeId) return true
      const parent = allTypes.value.find(t => t.type_id === typeId)
      if (parent?.children?.some(c => c.type_id === item.type_id)) return true
      return false
    })
  }
  return items
}

const handleRowParentTypeChange = (idx: number, value: string | undefined) => {
  const row = batchRows.value[idx]
  if (!row) return
  row.parentTypeId = value
  row.childTypeId = undefined
  row.item_id = ''
  row.spec_id = ''
  row.after_stock = 0

  if (value) {
    const parent = allTypes.value.find(t => t.type_id === value)
    row.childTypes = parent?.children || []
  } else {
    row.childTypes = []
  }
}

const handleRowChildTypeChange = (idx: number, value: string | undefined) => {
  const row = batchRows.value[idx]
  if (!row) return
  row.childTypeId = value
  row.item_id = ''
  row.spec_id = ''
  row.after_stock = 0
}

const handleRowItemChange = (idx: number, value: string) => {
  const row = batchRows.value[idx]
  if (!row) return
  row.item_id = value
  row.spec_id = ''
  row.after_stock = 0
  const items = getRowItems(row)
  const item = items.find((i) => i.item_id === value)
  const defaultSpec = item?.specs?.[0]
  if (item?.specs?.length === 1 && defaultSpec?.spec === '') {
    row.spec_id = defaultSpec.spec_id
    row.after_stock = defaultSpec.current_stock
  }
}

const handleRowSpecChange = (idx: number, specId: string) => {
  const row = batchRows.value[idx]
  if (!row) return
  row.spec_id = specId
  const items = getRowItems(row)
  const spec = items.find((i) => i.item_id === row.item_id)?.specs?.find(s => s.spec_id === specId)
  if (spec) {
    row.after_stock = spec.current_stock
  }
}

const addRow = () => {
  batchRows.value.push(createEmptyRow())
}

const removeRow = (idx: number) => {
  batchRows.value.splice(idx, 1)
}

const filterOption = (input: string, option: { label: string }) =>
  option.label.toLowerCase().includes(input.toLowerCase())

function needsSpec(row: BatchRow) {
  const items = getRowItems(row)
  const item = items.find((i) => i.item_id === row.item_id)
  if (!item?.specs?.length) return false
  return !(item.specs.length === 1 && item.specs[0]?.spec === '')
}

function specOptionsFor(row: BatchRow) {
  const items = getRowItems(row)
  const item = items.find((i) => i.item_id === row.item_id)
  if (!item?.specs) return []
  return item.specs.map((s) => ({
    label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
    value: s.spec_id
  }))
}

// 校验
const validateBatch = (): string | null => {
  const rows = batchRows.value
  if (rows.length === 0) return '请至少添加一条盘点明细'
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    if (!row.item_id) return `第 ${i + 1} 行未选择零件`
    if (needsSpec(row) && !row.spec_id) return `第 ${i + 1} 行未选择规格`
    if (row.after_stock == null || row.after_stock < 0) return `第 ${i + 1} 行实际库存无效`
  }
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.item_id}|${row.spec_id}`
    if (seen.has(key)) return '盘点列表存在重复的(零件+规格)'
    seen.add(key)
  }
  return null
}

// 提交
const handleSubmit = async () => {
  const dateStr = form.date.format('YYYY-MM-DD')

  if (mode.value === 'single') {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }
    loading.value = true
    try {
      const res = await inventoryApi.stockCheck({
        warehouse_id: form.warehouse_id,
        item_id: form.item_id,
        spec_id: form.spec_id,
        after_stock: form.after_stock,
        date: dateStr,
        remark: form.remark || undefined
      })
      if (res.result === 0) {
        message.success('盘点成功')
        emit('update:visible', false)
        emit('success')
      } else {
        message.error(res.msg || '盘点失败')
      }
    } catch (error) {
      console.error('盘点失败:', error)
    } finally {
      loading.value = false
    }
    return
  }

  const err = validateBatch()
  if (err) {
    message.warning(err)
    return
  }
  loading.value = true
  try {
    let res
    if (batchRows.value.length === 1) {
      const r = batchRows.value[0]
      if (!r) return
      res = await inventoryApi.stockCheck({
        warehouse_id: form.warehouse_id,
        item_id: r.item_id,
        spec_id: r.spec_id,
        after_stock: r.after_stock,
        date: dateStr,
        remark: form.remark || undefined
      })
    } else {
      res = await inventoryApi.stockCheckBatch({
        warehouse_id: form.warehouse_id,
        items: batchRows.value.map((r) => ({
          item_id: r.item_id,
          spec_id: r.spec_id,
          after_stock: r.after_stock
        })),
        date: dateStr,
        remark: form.remark || undefined
      })
    }
    if (res.result === 0) {
      message.success('盘点成功')
      emit('update:visible', false)
      emit('success')
    } else {
      message.error(res.msg || '盘点失败')
    }
  } catch (error) {
    console.error('批量盘点失败:', error)
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  emit('update:visible', false)
}

const resetForm = () => {
  mode.value = 'single'
  form.item_id = ''
  form.spec_id = ''
  form.after_stock = 0
  form.date = dayjs()
  form.remark = ''
  batchRows.value = [createEmptyRow()]
  formRef.value?.clearValidate()

  // 重置单条模式
  singleParentTypeId.value = undefined
  singleChildTypeId.value = undefined
  singleChildTypes.value = []
  allSingleItems.value = []
  singleItems.value = []
  allBatchItems.value = []
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      resetForm()
      loadTypes()
      loadAllSingleItems()
      // 批量模式也加载所有零件
      inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 }).then(res => {
        allBatchItems.value = res.datas.items || []
      }).catch(() => {
        allBatchItems.value = []
      })
    }
  }
)
</script>

<style scoped>
.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.batch-label {
  font-size: 14px;
  font-weight: 500;
  color: #52525b;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.row-type {
  width: 130px;
  flex-shrink: 0;
}

.row-item {
  flex: 1;
  min-width: 0;
}

.row-spec {
  width: 200px;
  flex-shrink: 0;
}

.row-qty {
  width: 100px;
  flex-shrink: 0;
}

.row-del {
  flex-shrink: 0;
  padding: 0 8px;
}

.stock-hint {
  margin: -8px 0 16px;
  font-size: 13px;
  color: #52525b;
}

.stock-hint strong {
  color: #2563eb;
  font-variant-numeric: tabular-nums;
}
</style>
