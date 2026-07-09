<template>
  <a-modal :open="visible" title="入库" :confirm-loading="loading" :mask-closable="false" width="950px" ok-text="提交入库"
    cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item>
        <a-radio-group v-model:value="mode" button-style="solid">
          <a-radio-button value="single">单条入库</a-radio-button>
          <a-radio-button value="batch">批量入库</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 单条入库 -->
      <template v-if="mode === 'single'">
        <a-form-item label="仓库" name="warehouse_id" :rules="[{ required: true, message: '请选择仓库' }]">
          <WarehouseSelect v-model="form.warehouse_id" />
        </a-form-item>

        <a-row :gutter="12">
          <a-col :span="5">
            <a-form-item label="一级类型">
              <a-select v-model:value="singleParentTypeId" placeholder="选择一级类型" allow-clear :loading="typesLoading"
                @change="handleSingleParentTypeChange">
                <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
                  {{ t.type_name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :span="5">
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

          <a-col v-if="showSpecSelect" :span="5">
            <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
              <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions" />
            </a-form-item>
          </a-col>

          <a-col :span="showSpecSelect ? 3 : 6">
            <a-form-item label="数量" name="quantity"
              :rules="[{ required: true, message: '请输入数量' }, { type: 'number', min: 1, message: '数量必须大于0' }]">
              <a-input-number v-model:value="form.quantity" placeholder="数量" :min="1" :precision="0"
                style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="入库日期" name="date" :rules="[{ required: true, message: '请选择入库日期' }]">
              <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
            </a-form-item>
          </a-col>
        </a-row>

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
          <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="3" :maxlength="500" show-count />
        </a-form-item>
      </template>

      <!-- 批量入库：动态行，每行独立选择类型 -->
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
          <span class="batch-label">入库明细（每行独立选择类型和零件）</span>
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
            :options="specOptionsFor(row)" @change="(v: string) => (row.spec_id = v)" />

          <a-input-number class="row-qty" :value="row.quantity" placeholder="数量" :min="1" :precision="0"
            @change="(v: number | null) => (row.quantity = v ?? 1)" />

          <a-button class="row-del" type="link" danger :disabled="batchRows.length === 1" @click="removeRow(idx)">
            <DeleteOutlined />
          </a-button>
        </div>
      </template>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { inventoryApi, fileApi } from '@/api/inventory'
import type { InventoryItem, ItemTypeNode } from '@/types/inventory'
import WarehouseSelect from './WarehouseSelect.vue'

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
const uploading = ref(false)

const mode = ref<'single' | 'batch'>('single')
const fileList = ref<any[]>([])

const form = reactive({
  warehouse_id: '',
  item_id: '',
  spec_id: '',
  quantity: 1 as number,
  date: dayjs() as Dayjs,
  photo_id: '',
  remark: ''
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
      // 检查零件的 type_id 或其父类型
      if (item.type_id === typeId) return true
      // 检查是否是父类型
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

const handleSingleItemChange = () => {
  form.spec_id = ''
  const defaultSpec = singleItem.value?.specs?.[0]
  if (singleItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
    form.spec_id = defaultSpec.spec_id
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
  quantity: number
}

const batchRows = ref<BatchRow[]>([createEmptyRow()])

function createEmptyRow(): BatchRow {
  return {
    parentTypeId: undefined,
    childTypeId: undefined,
    childTypes: [],
    item_id: '',
    spec_id: '',
    quantity: 1
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
}

const handleRowItemChange = (idx: number, value: string) => {
  const row = batchRows.value[idx]
  if (!row) return
  row.item_id = value
  row.spec_id = ''
  const items = getRowItems(row)
  const item = items.find((i) => i.item_id === value)
  const defaultSpec = item?.specs?.[0]
  if (item?.specs?.length === 1 && defaultSpec?.spec === '') {
    row.spec_id = defaultSpec.spec_id
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

// ========== 照片上传 ==========
const beforeUpload = (file: File) => {
  if (!file.type.startsWith('image/')) {
    message.error('只能上传图片文件')
    return false
  }
  if (file.size / 1024 / 1024 >= 5) {
    message.error('图片大小不能超过5MB')
    return false
  }
  return true
}

const handleUpload = async (options: any) => {
  const { file } = options
  uploading.value = true
  try {
    const data = await fileApi.uploadFile(file)
    form.photo_id = data.relation_id
    message.success('照片上传成功')
  } catch (error) {
    console.error('照片上传失败:', error)
    message.error('照片上传失败')
    fileList.value = []
  } finally {
    uploading.value = false
  }
}

// ========== 校验 ==========
const validateBatch = (): string | null => {
  const rows = batchRows.value
  if (rows.length === 0) return '请至少添加一条入库明细'
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    if (!row.item_id) return `第 ${i + 1} 行未选择零件`
    if (needsSpec(row) && !row.spec_id) return `第 ${i + 1} 行未选择规格`
    if (!row.quantity || row.quantity < 1) return `第 ${i + 1} 行数量无效`
  }
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.item_id}|${row.spec_id}`
    if (seen.has(key)) return '入库列表存在重复的(零件+规格)'
    seen.add(key)
  }
  return null
}

// ========== 提交 ==========
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
      const res = await inventoryApi.stockIn({
        warehouse_id: form.warehouse_id,
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

  // 批量
  if (!form.warehouse_id) {
    message.warning('请选择仓库')
    return
  }
  if (!form.date) {
    message.warning('请选择入库日期')
    return
  }
  const err = validateBatch()
  if (err) {
    message.warning(err)
    return
  }
  loading.value = true
  try {
    const res = await inventoryApi.stockInBatch({
      warehouse_id: form.warehouse_id,
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
}

const handleCancel = () => {
  emit('update:visible', false)
}

const resetForm = () => {
  mode.value = 'single'
  form.warehouse_id = ''
  form.item_id = ''
  form.spec_id = ''
  form.quantity = 1
  form.date = dayjs()
  form.photo_id = ''
  form.remark = ''
  batchRows.value = [createEmptyRow()]
  fileList.value = []
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
</style>
