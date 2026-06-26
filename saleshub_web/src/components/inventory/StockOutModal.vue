<template>
  <a-modal :open="visible" title="出库" :confirm-loading="loading" :mask-closable="false" width="720px" ok-text="提交出库"
    cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item>
        <a-radio-group v-model:value="mode" button-style="solid">
          <a-radio-button value="item">按零件出库</a-radio-button>
          <a-radio-button value="product">按产品出库</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 按零件出库：动态行，单条/批量 -->
      <template v-if="mode === 'item'">
        <div class="batch-header">
          <span class="batch-label">出库明细{{ batchRows.length > 1 ? '（同一批次共用单号）' : '' }}</span>
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

      <!-- 按产品出库 -->
      <template v-else>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="产品" name="product_id"
              :rules="[{ required: true, message: '请选择产品' }]">
              <a-select v-model:value="form.product_id" placeholder="请选择产品" show-search :filter-option="filterOption"
                :loading="productsLoading" :options="productOptions" @change="handleProductChange" />
            </a-form-item>
          </a-col>

          <a-col :span="12">
            <a-form-item label="出库台数" name="quantity"
              :rules="[{ required: true, message: '请输入台数' }, { type: 'number', min: 1, message: '台数必须大于0' }]">
              <a-input-number v-model:value="form.quantity" placeholder="台数" :min="1" :precision="0"
                style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- BOM 预览 -->
        <div v-if="bomItems.length" class="bom-block">
          <div class="bom-title">产品零件清单（按 {{ form.quantity || 0 }} 台计算）</div>
          <a-table :columns="bomColumns" :data-source="bomView" :pagination="false" size="small" bordered
            row-key="relation_id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'item'">
                <div class="cell-item">
                  <span class="item-name">{{ record.item_name }}</span>
                  <span class="item-code">{{ record.item_code }}</span>
                </div>
              </template>

              <template v-else-if="column.key === 'spec'">
                <span v-if="record.spec">{{ record.spec }}</span>
                <span v-else class="cell-muted">-</span>
              </template>

              <template v-else-if="column.key === 'per'">
                × {{ record.quantity_per_product }}
              </template>

              <template v-else-if="column.key === 'needed'">
                <span class="needed-num">{{ record.needed }}</span>
              </template>

              <template v-else-if="column.key === 'stock'">
                <span :class="{ 'text-warn': record.needed > record.current_stock }">{{ record.current_stock }}</span>
              </template>
            </template>
          </a-table>
        </div>
      </template>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="出库日期" name="date" :rules="[{ required: true, message: '请选择出库日期' }]">
            <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%" :format="'YYYY-MM-DD'" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选，本批次共用）" :rows="3" :maxlength="500"
          show-count />
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
  import type { InventoryItem, Product, ProductItemRelation } from '@/api/inventory'

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
  const productsLoading = ref(false)

  const mode = ref<'item' | 'product'>('item')
  const items = ref<InventoryItem[]>([])
  const products = ref<Product[]>([])
  const bomItems = ref<ProductItemRelation[]>([])

  const form = reactive({
    product_id: '',
    quantity: 1 as number,
    date: dayjs() as Dayjs,
    remark: ''
  })

  interface BatchRow {
    item_id: string
    spec_id: string
    quantity: number
  }
  const batchRows = ref<BatchRow[]>([{ item_id: '', spec_id: '', quantity: 1 }])

  // ---- 选项 ----
  const itemOptions = computed(() =>
    items.value.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }))
  )

  const productOptions = computed(() =>
    products.value.map((p) => ({ label: `${p.name} (${p.code})`, value: p.product_id }))
  )

  const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

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

  // ---- 按零件出库：行操作 ----
  const addRow = () => {
    batchRows.value.push({ item_id: '', spec_id: '', quantity: 1 })
  }

  const removeRow = (idx: number) => {
    batchRows.value.splice(idx, 1)
  }

  const handleRowItemChange = (idx: number, value: string) => {
    const row = batchRows.value[idx]
    if (!row) return
    row.item_id = value
    row.spec_id = ''
    const item = items.value.find((i) => i.item_id === value)
    const defaultSpec = item?.specs?.[0]
    if (item?.specs?.length === 1 && defaultSpec?.spec === '') {
      row.spec_id = defaultSpec.spec_id
    }
  }

  // ---- 按产品出库：BOM ----
  const handleProductChange = async (productId: string) => {
    bomItems.value = []
    if (!productId) return
    try {
      const res = await inventoryApi.listProductItems(productId)
      if (res.result === 0) {
        bomItems.value = res.datas.items
      }
    } catch (error) {
      console.error('加载产品零件清单失败:', error)
    }
  }

  const bomColumns = [
    { title: '零件', key: 'item', ellipsis: true },
    { title: '规格', key: 'spec', width: 110 },
    { title: '单台用量', key: 'per', width: 100, align: 'center' as const },
    { title: '需求量', key: 'needed', width: 90, align: 'center' as const },
    { title: '当前库存', key: 'stock', width: 100, align: 'center' as const }
  ]

  const bomView = computed(() =>
    bomItems.value.map((r) => ({
      ...r,
      needed: (form.quantity || 0) * r.quantity_per_product
    }))
  )

  // ---- 数据加载 ----
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

  const loadProducts = async () => {
    productsLoading.value = true
    try {
      const res = await inventoryApi.listProducts({ pageIndex: 1, pageSize: 1000 })
      if (res.result === 0) {
        products.value = res.datas.items
      }
    } catch (error) {
      console.error('加载产品列表失败:', error)
    } finally {
      productsLoading.value = false
    }
  }

  // ---- 校验 ----
  const validateBatch = (): string | null => {
    const rows = batchRows.value
    if (rows.length === 0) return '请至少添加一条出库明细'
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      if (!row.item_id) return `第 ${i + 1} 行未选择零件`
      if (needsSpec(row.item_id) && !row.spec_id) return `第 ${i + 1} 行未选择规格`
      if (!row.quantity || row.quantity < 1) return `第 ${i + 1} 行数量无效`
    }
    const seen = new Set<string>()
    for (const row of rows) {
      const key = `${row.item_id}|${row.spec_id}`
      if (seen.has(key)) return '出库列表存在重复的(零件+规格)'
      seen.add(key)
    }
    return null
  }

  // ---- 提交 ----
  const handleSubmit = async () => {
    const dateStr = form.date.format('YYYY-MM-DD')

    if (mode.value === 'item') {
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
          res = await inventoryApi.stockOut({
            item_id: r.item_id,
            spec_id: r.spec_id,
            quantity: r.quantity,
            date: dateStr,
            remark: form.remark || undefined
          })
        } else {
          res = await inventoryApi.stockOutBatch({
            items: batchRows.value.map((r) => ({
              item_id: r.item_id,
              spec_id: r.spec_id,
              quantity: r.quantity
            })),
            date: dateStr,
            remark: form.remark || undefined
          })
        }
        if (res.result === 0) {
          message.success('出库成功')
          emit('update:visible', false)
          emit('success')
        } else {
          message.error(res.msg || '出库失败')
        }
      } catch (error) {
        console.error('出库失败:', error)
      } finally {
        loading.value = false
      }
      return
    }

    // 按产品出库
    try {
      await formRef.value?.validate()
    } catch {
      return
    }
    if (!bomItems.value.length) {
      message.warning('该产品未配置零件')
      return
    }
    loading.value = true
    try {
      const res = await inventoryApi.stockOutByProduct({
        product_id: form.product_id,
        quantity: form.quantity,
        date: dateStr,
        remark: form.remark || undefined
      })
      if (res.result === 0) {
        message.success('出库成功')
        emit('update:visible', false)
        emit('success')
      } else {
        message.error(res.msg || '出库失败')
      }
    } catch (error) {
      console.error('按产品出库失败:', error)
    } finally {
      loading.value = false
    }
  }

  const handleCancel = () => {
    emit('update:visible', false)
  }

  const resetForm = () => {
    mode.value = 'item'
    form.product_id = ''
    form.quantity = 1
    form.date = dayjs()
    form.remark = ''
    batchRows.value = [{ item_id: '', spec_id: '', quantity: 1 }]
    bomItems.value = []
    formRef.value?.clearValidate()
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        resetForm()
        loadItems()
        loadProducts()
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
    width: 110px;
    flex-shrink: 0;
  }

  .row-del {
    flex-shrink: 0;
    padding: 0 8px;
  }

  .bom-block {
    margin-bottom: 16px;
  }

  .bom-title {
    font-size: 13px;
    font-weight: 500;
    color: #52525b;
    margin-bottom: 8px;
  }

  .cell-item {
    display: flex;
    flex-direction: column;
    line-height: 1.35;
  }

  .item-name {
    font-weight: 500;
    color: #18181b;
  }

  .item-code {
    font-size: 12px;
    color: #a1a1aa;
  }

  .cell-muted {
    color: #a1a1aa;
  }

  .needed-num {
    font-weight: 600;
    color: #dc2626;
    font-variant-numeric: tabular-nums;
  }

  .text-warn {
    color: #dc2626;
    font-weight: 600;
  }
</style>
