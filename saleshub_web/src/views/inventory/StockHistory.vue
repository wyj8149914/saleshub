<template>
  <a-card title="库存历史" :bordered="false">
    <template #extra>
      <a-space :size="12" wrap>
        <a-select v-model:value="filterParentTypeId" placeholder="一级类型" allow-clear style="width: 140px"
          :loading="typesLoading" @change="handleParentTypeChange">
          <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select v-model:value="filterChildTypeId" placeholder="二级类型" allow-clear style="width: 140px"
          :loading="typesLoading" @change="handleChildTypeChange">
          <a-select-option v-for="t in filterChildTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select v-model:value="selectedItemId" placeholder="选择零件" show-search style="width: 240px"
          :loading="itemsLoading" :options="itemOptions" :filter-option="filterOption" @change="handleItemChange" />

        <a-select v-model:value="selectedSpecId" placeholder="选择规格" allow-clear style="width: 160px"
          :options="specOptions" :disabled="!selectedItemId" @change="handleSpecChange" />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </template>

    <a-table :columns="columns" :data-source="historyRecords" :loading="loading"
      :pagination="{ current: pageIndex, pageSize, total, showSizeChanger: true, onChange: handlePageChange }" bordered
      :row-key="(record: StockHistoryRecord) => record.id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">
            {{ getTypeText(record.type) }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'quantity'">
          <span :class="getQuantityClass(record)">
            {{ formatQuantity(record) }}
          </span>
        </template>

        <template v-else-if="column.key === 'stockChange'">
          <span v-if="record.before_stock != null && record.after_stock != null">
            {{ record.before_stock }} → {{ record.after_stock }}
          </span>
          <span v-else>-</span>
        </template>

        <template v-else-if="column.key === 'spec'">
          {{ record.spec || '-' }}
        </template>

        <template v-else-if="column.key === 'create_time'">
          {{ formatDate(record.create_time) }}
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { StockHistoryRecord, InventoryItem, ItemTypeNode } from '@/types/inventory'

  const columns = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
    { title: '零件名称', dataIndex: 'item_name', key: 'item_name', width: 140 },
    { title: '规格', dataIndex: 'spec', key: 'spec', width: 120 },
    { title: '变更数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
    { title: '库存变更', key: 'stockChange', width: 140 },
    { title: '业务日期', dataIndex: 'date', key: 'date', width: 120 },
    { title: '操作时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true }
  ]

  const loading = ref(false)
  const historyRecords = ref<StockHistoryRecord[]>([])
  const pageIndex = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  // 类型相关
  const typesLoading = ref(false)
  const allTypes = ref<ItemTypeNode[]>([])
  const parentTypes = ref<ItemTypeNode[]>([])
  const filterParentTypeId = ref<string | undefined>(undefined)
  const filterChildTypeId = ref<string | undefined>(undefined)
  const filterChildTypes = ref<ItemTypeNode[]>([])

  // 零件相关
  const itemsLoading = ref(false)
  const allItemsUnfiltered = ref<InventoryItem[]>([])  // 所有零件（未筛选）
  const allItems = ref<InventoryItem[]>([])            // 筛选后的零件
  const selectedItemId = ref<string>('')
  const selectedSpecId = ref<string>('')

  // 加载所有零件
  const loadAllItems = async () => {
    itemsLoading.value = true
    try {
      const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 })
      allItemsUnfiltered.value = res.datas.items || []
      allItems.value = allItemsUnfiltered.value
    } catch {
      allItemsUnfiltered.value = []
      allItems.value = []
    } finally {
      itemsLoading.value = false
    }
  }

  // 根据类型筛选零件
  const filterItems = () => {
    const typeId = filterChildTypeId.value || filterParentTypeId.value
    if (typeId) {
      allItems.value = allItemsUnfiltered.value.filter(item => {
        if (item.type_id === typeId) return true
        const parent = allTypes.value.find(t => t.type_id === typeId)
        if (parent?.children?.some(c => c.type_id === item.type_id)) return true
        return false
      })
    } else {
      allItems.value = allItemsUnfiltered.value
    }
  }

  // 零件选项
  const itemOptions = computed(() =>
    allItems.value.map((item: InventoryItem) => ({
      label: `${item.name} (${item.code})`,
      value: item.item_id
    }))
  )

  // 规格选项
  const specOptions = computed(() => {
    if (!selectedItemId.value) return []
    const item = allItems.value.find((i: InventoryItem) => i.item_id === selectedItemId.value)
    if (!item) return []
    return item.specs.map((spec: any) => ({
      label: spec.spec || '默认规格',
      value: spec.spec_id
    }))
  })

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'in': return 'green'
      case 'out': return 'red'
      case 'check': return 'blue'
      default: return 'default'
    }
  }

  const getTypeText = (type: string): string => {
    switch (type) {
      case 'in': return '入库'
      case 'out': return '出库'
      case 'check': return '盘点'
      default: return '未知'
    }
  }

  const getQuantityDiff = (record: StockHistoryRecord): number => {
    if (record.type === 'check') {
      return record.after_stock - record.before_stock
    }
    if (record.type === 'in') {
      return record.quantity ?? 0
    }
    if (record.type === 'out') {
      return -(record.quantity ?? 0)
    }
    return 0
  }

  const formatQuantity = (record: StockHistoryRecord): string => {
    const diff = getQuantityDiff(record)
    if (diff > 0) return `+${diff}`
    if (diff < 0) return `${diff}`
    return '0'
  }

  const getQuantityClass = (record: StockHistoryRecord): string => {
    const diff = getQuantityDiff(record)
    if (diff > 0) return 'qty-text qty-plus'
    if (diff < 0) return 'qty-text qty-minus'
    return 'qty-text qty-zero'
  }

  const formatDate = (date: Date | string): string => {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 加载类型
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

  const loadHistory = async () => {
    if (!selectedItemId.value) {
      historyRecords.value = []
      total.value = 0
      return
    }

    loading.value = true
    try {
      const response = await inventoryApi.stockHistoryList({
        item_id: selectedItemId.value,
        spec_id: selectedSpecId.value || undefined,
        pageIndex: pageIndex.value,
        pageSize: pageSize.value
      })
      if (response.result === 0) {
        historyRecords.value = response.datas.items
        total.value = response.datas.total
      } else {
        message.error(response.msg || '加载库存历史失败')
      }
    } catch (error) {
      console.error('加载库存历史失败:', error)
      message.error('加载库存历史失败')
    } finally {
      loading.value = false
    }
  }

  // 一级类型变更
  const handleParentTypeChange = (value: string | undefined) => {
    filterChildTypeId.value = undefined
    selectedItemId.value = ''
    selectedSpecId.value = ''

    if (value) {
      const parent = allTypes.value.find(t => t.type_id === value)
      filterChildTypes.value = parent?.children || []
    } else {
      filterChildTypes.value = []
    }
    filterItems()
  }

  // 二级类型变更
  const handleChildTypeChange = (value: string | undefined) => {
    selectedItemId.value = ''
    selectedSpecId.value = ''
    filterItems()
  }

  const handleItemChange = () => {
    selectedSpecId.value = ''
    pageIndex.value = 1
    loadHistory()
  }

  const handleSpecChange = () => {
    pageIndex.value = 1
    loadHistory()
  }

  const handlePageChange = (page: number, size: number) => {
    pageIndex.value = page
    pageSize.value = size
    loadHistory()
  }

  const handleSearch = () => {
    pageIndex.value = 1
    loadHistory()
  }

  const handleReset = () => {
    filterParentTypeId.value = undefined
    filterChildTypeId.value = undefined
    selectedItemId.value = ''
    selectedSpecId.value = ''
    filterChildTypes.value = []
    allItems.value = allItemsUnfiltered.value
    historyRecords.value = []
    total.value = 0
  }

  const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

  onMounted(() => {
    loadTypes()
    loadAllItems()
  })
</script>

<style scoped lang="scss">
  :deep(.ant-card) {
    .ant-card-head-title {
      font-weight: 600;
    }
  }

  :deep(.ant-table) {
    .ant-table-tbody>tr:hover {
      background-color: #fafafa;
    }
  }

  .qty-text {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .qty-plus {
    color: #16a34a;
  }

  .qty-minus {
    color: #dc2626;
  }

  .qty-zero {
    color: #71717a;
  }
</style>
