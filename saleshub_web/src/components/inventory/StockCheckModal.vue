<template>
  <a-modal :open="visible" title="盘点" :confirm-loading="loading" :mask-closable="false" width="720px" ok-text="提交盘点"
    cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item>
        <a-radio-group v-model:value="mode" button-style="solid">
          <a-radio-button value="single">单条盘点</a-radio-button>
          <a-radio-button value="batch">批量盘点</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <template v-if="mode === 'single'">
        <a-row :gutter="12">
          <a-col :span="showSpecSelect ? 9 : 12">
            <a-form-item label="零件" name="item_id" :rules="[{ required: true, message: '请选择零件' }]">
              <a-select v-model:value="form.item_id" placeholder="请选择零件" show-search :filter-option="filterOption"
                :loading="itemsLoading" :options="itemOptions" @change="handleSingleItemChange" />
            </a-form-item>
          </a-col>

          <a-col v-if="showSpecSelect" :span="7">
            <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
              <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions"
                @change="handleSingleSpecChange" />
            </a-form-item>
          </a-col>

          <a-col :span="showSpecSelect ? 8 : 12">
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

      <template v-else>
        <div class="batch-header">
          <span class="batch-label">盘点明细{{ batchRows.length > 1 ? '（同一批次共用单号）' : '' }}</span>
          <a-button type="link" size="small" @click="addRow">
            <PlusOutlined />
            添加一行
          </a-button>
        </div>

        <div v-for="(row, idx) in batchRows" :key="idx" class="batch-row">
          <a-select class="row-item" :value="row.item_id" placeholder="选择零件" show-search :filter-option="filterOption"
            :options="itemOptions" @change="(v: string) => handleRowItemChange(idx, v)" />

          <a-select v-if="needsSpec(row.item_id)" class="row-spec" :value="row.spec_id" placeholder="规格"
            :options="specOptionsFor(row.item_id)" @change="(v: string) => handleRowSpecChange(idx, v)" />

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
  import type { InventoryItem } from '@/types/inventory'

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
  const itemsLoading = ref(false)

  const mode = ref<'single' | 'batch'>('single')
  const items = ref<InventoryItem[]>([])

  const form = reactive({
    item_id: '',
    spec_id: '',
    after_stock: 0 as number,
    date: dayjs() as Dayjs,
    remark: ''
  })

  interface BatchRow {
    item_id: string
    spec_id: string
    after_stock: number
  }
  const batchRows = ref<BatchRow[]>([{ item_id: '', spec_id: '', after_stock: 0 }])

  const itemOptions = computed(() =>
    items.value.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }))
  )

  const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

  function getSpec(itemId: string, specId: string) {
    const item = items.value.find((i) => i.item_id === itemId)
    return item?.specs?.find((s) => s.spec_id === specId)
  }

  function specOptionsFor(itemId: string) {
    const item = items.value.find((i) => i.item_id === itemId)
    if (!item?.specs) return []
    return item.specs.map((s) => ({
      label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
      value: s.spec_id
    }))
  }

  function needsSpec(itemId: string) {
    const item = items.value.find((i) => i.item_id === itemId)
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
  }

  const singleItem = computed(() => items.value.find((i) => i.item_id === form.item_id))

  const showSpecSelect = computed(() => {
    const item = singleItem.value
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
  })

  const singleSpecOptions = computed(() => specOptionsFor(form.item_id))

  const singleCurrentStock = computed(() => {
    if (!form.spec_id) return null
    return getSpec(form.item_id, form.spec_id)?.current_stock ?? null
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
    const spec = getSpec(form.item_id, specId)
    if (spec) {
      form.after_stock = spec.current_stock
    }
  }

  const addRow = () => {
    batchRows.value.push({ item_id: '', spec_id: '', after_stock: 0 })
  }

  const removeRow = (idx: number) => {
    batchRows.value.splice(idx, 1)
  }

  const handleRowItemChange = (idx: number, value: string) => {
    const row = batchRows.value[idx]
    if (!row) return
    row.item_id = value
    row.spec_id = ''
    row.after_stock = 0
    const item = items.value.find((i) => i.item_id === value)
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
    const spec = getSpec(row.item_id, specId)
    if (spec) {
      row.after_stock = spec.current_stock
    }
  }

  const loadItems = async () => {
    itemsLoading.value = true
    try {
      const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 })
      if (res.result === 0) {
        items.value = res.datas.items
      }
    } catch (error) {
      console.error('加载零件列表失败:', error)
    } finally {
      itemsLoading.value = false
    }
  }

  const validateBatch = (): string | null => {
    const rows = batchRows.value
    if (rows.length === 0) return '请至少添加一条盘点明细'
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      if (!row.item_id) return `第 ${i + 1} 行未选择零件`
      if (needsSpec(row.item_id) && !row.spec_id) return `第 ${i + 1} 行未选择规格`
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
          item_id: r.item_id,
          spec_id: r.spec_id,
          after_stock: r.after_stock,
          date: dateStr,
          remark: form.remark || undefined
        })
      } else {
        res = await inventoryApi.stockCheckBatch({
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
    batchRows.value = [{ item_id: '', spec_id: '', after_stock: 0 }]
    formRef.value?.clearValidate()
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        resetForm()
        loadItems()
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

  .row-item {
    flex: 1;
    min-width: 0;
  }

  .row-spec {
    width: 190px;
    flex-shrink: 0;
  }

  .row-qty {
    width: 120px;
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
