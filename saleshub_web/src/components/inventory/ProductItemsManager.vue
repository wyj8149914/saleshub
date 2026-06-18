<template>
  <a-modal
    :open="visible"
    title="管理产品零件"
    :width="860"
    :confirm-loading="saving"
    :mask-closable="false"
    wrap-class-name="product-items-modal"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <!-- 产品信息 -->
    <div v-if="product" class="product-info">
      <div class="product-name">{{ product.name }}</div>
      <span class="product-code">{{ product.code }}</span>
    </div>

    <!-- 添加面板 -->
    <div class="add-panel">
      <a-select
        v-model:value="addForm.item_id"
        placeholder="搜索零件名称或编码"
        show-search
        allow-clear
        :filter-option="filterItem"
        :options="availableOptions"
        :loading="loadingAvailable"
        class="add-select"
      />
      <a-input-number
        v-model:value="addForm.quantity_per_product"
        :min="1"
        :precision="0"
        :max="9999"
        class="add-quantity"
      >
        <template #addonBefore>单台数量</template>
      </a-input-number>
      <a-input
        v-model:value="addForm.remark"
        placeholder="备注（可选，最长 100 字符）"
        :maxlength="100"
        class="add-remark"
      />
      <a-button
        type="primary"
        class="add-btn"
        :disabled="!addForm.item_id"
        @click="handleAdd"
      >
        添加
      </a-button>
    </div>

    <!-- 关联列表 -->
    <a-table
      :columns="columns"
      :data-source="selectedItems"
      :loading="loading"
      :pagination="false"
      row-key="item_id"
      size="middle"
      class="items-table"
      :locale="{ emptyText: '暂未关联任何零件，使用上方搜索框添加' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'item_type'">
          <a-tag :class="record.item_type === 'device' ? 'tag-device' : 'tag-common'">
            {{ record.item_type === 'device' ? '设备件' : '常用件' }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'item_name'">
          <span class="cell-name">{{ record.item_name }}</span>
        </template>

        <template v-else-if="column.key === 'item_code'">
          <span class="cell-code">{{ record.item_code }}</span>
        </template>

        <template v-else-if="column.key === 'stock'">
          <span class="stock-num" :class="{ 'text-danger': record.current_stock <= record.warn_stock }">
            {{ record.current_stock }}
          </span>
          <span class="stock-warn">/ {{ record.warn_stock }}</span>
        </template>

        <template v-else-if="column.key === 'quantity_per_product'">
          <a-input-number
            v-model:value="record.quantity_per_product"
            :min="1"
            :precision="0"
            :max="9999"
            size="small"
            class="qty-input"
          />
        </template>

        <template v-else-if="column.key === 'remark'">
          <a-input
            v-model:value="record.remark"
            placeholder="可选备注"
            :maxlength="100"
            size="small"
            class="remark-input"
          />
        </template>

        <template v-else-if="column.key === 'actions'">
          <a-button type="link" size="small" danger @click="handleRemove(record)">
            移除
          </a-button>
        </template>
      </template>
    </a-table>

    <div class="footer-hint">
      共 {{ selectedItems.length }} 个零件关联；保存时将全量覆盖该产品的关联列表
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { inventoryApi } from '@/api/inventory'
import type { Product, InventoryItem, ItemType } from '@/api/inventory'

interface Props {
  visible: boolean
  product: Product | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const emit = defineEmits<Emits>()

// 已关联零件（包含可编辑的 remark 与 quantity_per_product）
interface SelectedItem {
  item_id: string
  item_name: string
  item_code: string
  item_type: ItemType
  current_stock: number
  warn_stock: number
  quantity_per_product: number
  remark: string
}

const loading = ref(false)
const saving = ref(false)
const loadingAvailable = ref(false)

const selectedItems = ref<SelectedItem[]>([])
const availableItems = ref<InventoryItem[]>([])

const addForm = reactive<{
  item_id: string | undefined
  quantity_per_product: number
  remark: string
}>({
  item_id: undefined,
  quantity_per_product: 1,
  remark: ''
})

const columns = [
  { title: '类型', key: 'item_type', width: 90, align: 'center' as const },
  { title: '名称', key: 'item_name', ellipsis: true },
  { title: '编码', key: 'item_code', width: 130, align: 'center' as const },
  { title: '库存', key: 'stock', width: 120, align: 'right' as const },
  { title: '单台数量', key: 'quantity_per_product', width: 130, align: 'center' as const },
  { title: '备注', key: 'remark', width: 180 },
  { title: '操作', key: 'actions', width: 80, align: 'center' as const }
]

// 可添加选项：排除已关联的零件
const availableOptions = computed(() => {
  const selectedIds = new Set(selectedItems.value.map((i) => i.item_id))
  return availableItems.value
    .filter((i) => !selectedIds.has(i.item_id))
    .map((i) => ({
      label: `${i.name}（${i.code}）`,
      value: i.item_id
    }))
})

const filterItem = (input: string, option: { label: string; value: string }) => {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

const loadCurrentItems = async () => {
  if (!props.product) return
  loading.value = true
  try {
    const res = await inventoryApi.listProductItems(props.product.product_id)
    selectedItems.value = res.datas.items.map((i) => ({
      item_id: i.item_id,
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

// 拉取所有可选零件（一次拉一大页，零件总量预期不会过千）
const loadAvailableItems = async () => {
  loadingAvailable.value = true
  try {
    const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 999 })
    availableItems.value = res.datas.items
  } catch {
    // 错误由 request 拦截器统一处理
  } finally {
    loadingAvailable.value = false
  }
}

const handleAdd = () => {
  if (!addForm.item_id) return
  const item = availableItems.value.find((i) => i.item_id === addForm.item_id)
  if (!item) return

  selectedItems.value.push({
    item_id: item.item_id,
    item_name: item.name,
    item_code: item.code,
    item_type: item.type,
    current_stock: item.current_stock,
    warn_stock: item.warn_stock,
    quantity_per_product: addForm.quantity_per_product,
    remark: addForm.remark
  })

  addForm.item_id = undefined
  addForm.quantity_per_product = 1
  addForm.remark = ''
}

const handleRemove = (record: SelectedItem) => {
  const idx = selectedItems.value.findIndex((i) => i.item_id === record.item_id)
  if (idx >= 0) {
    selectedItems.value.splice(idx, 1)
  }
}

const handleSave = async () => {
  if (!props.product) return
  saving.value = true
  try {
    await inventoryApi.setProductItems(
      props.product.product_id,
      selectedItems.value.map((i) => ({
        item_id: i.item_id,
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

const handleCancel = () => {
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.product) {
      loadCurrentItems()
      loadAvailableItems()
      addForm.item_id = undefined
      addForm.quantity_per_product = 1
      addForm.remark = ''
    } else {
      selectedItems.value = []
      availableItems.value = []
    }
  }
)
</script>

<style scoped>
/* 产品信息条 */
.product-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  margin-bottom: 16px;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: #18181b;
}

.product-code {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  color: #52525b;
  background: #ffffff;
  padding: 2px 8px;
  border-radius: 4px;
}

/* 添加面板 */
.add-panel {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.add-select {
  flex: 1;
  min-width: 220px;
}

.add-remark {
  flex: 1;
  min-width: 200px;
}

.add-quantity {
  width: 160px;
  flex-shrink: 0;
}

.add-quantity :deep(.ant-input-number) {
  border-radius: 8px;
}

.add-quantity :deep(.ant-input-number-focused) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.add-quantity :deep(.ant-input-number-handler-wrap) {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.add-quantity :deep(.ant-input-group-addon) {
  background: #f4f4f5;
  border-color: #e4e4e7;
  color: #52525b;
  font-size: 13px;
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.add-btn {
  border-radius: 8px;
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff !important;
  font-weight: 500;
}

.add-btn:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #ffffff !important;
}

/* 禁用态保持蓝底白字可见，仅用透明度表达不可点击 */
.add-btn[disabled],
.add-btn[disabled]:hover {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
  opacity: 0.5;
  cursor: not-allowed;
}

.add-panel :deep(.ant-select-selector),
.add-panel :deep(.ant-input) {
  border-radius: 8px;
}

.add-panel :deep(.ant-select-focused .ant-select-selector) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

/* 关联表格 */
.items-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  font-size: 14px;
  color: #52525b;
  border-bottom: 1px solid #e4e4e7;
}

.items-table :deep(.ant-table-tbody > tr > td) {
  font-size: 14px;
}

.items-table :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: #f9fafb;
}

.items-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #eff6ff;
}

/* 类型标签 */
.tag-device {
  background: rgba(37, 99, 235, 0.1) !important;
  color: #2563eb !important;
  border-color: transparent !important;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
}

.tag-common {
  background: rgba(16, 185, 129, 0.1) !important;
  color: #059669 !important;
  border-color: transparent !important;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
}

.cell-name {
  font-weight: 500;
  color: #18181b;
}

.cell-code {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  color: #52525b;
}

.stock-num {
  font-weight: 600;
  color: #18181b;
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
}

.stock-num.text-danger {
  color: #dc2626;
}

.stock-warn {
  font-size: 12px;
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
}

/* 备注输入框 */
.remark-input {
  border-radius: 6px;
}

/* 行内单台数量输入 */
.qty-input {
  width: 100%;
  border-radius: 6px;
}

.qty-input :deep(.ant-input-number-focused) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.remark-input :deep(.ant-input:focus),
.remark-input :deep(.ant-input:hover) {
  border-color: #2563eb;
}

/* 移除按钮 */
.items-table :deep(.ant-btn-link) {
  padding: 4px 8px;
  height: auto;
  font-size: 13px;
}

.items-table :deep(.ant-btn-link:hover) {
  color: #dc2626;
}

/* 底部提示 */
.footer-hint {
  margin-top: 12px;
  padding: 10px 12px;
  font-size: 12px;
  color: #71717a;
  background: #f4f4f5;
  border-radius: 6px;
  line-height: 1.5;
}
</style>
