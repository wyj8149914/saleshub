<template>
  <a-card title="库存历史" :bordered="false">
    <template #extra>
      <a-select v-model:value="selectedItemId" placeholder="选择零件" show-search :filter-option="filterItemOption"
        :loading="itemsLoading" :options="itemOptions" style="width: 300px" @change="handleItemChange" />
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
          <span
            :style="{ color: record.type === 'in' ? '#52c41a' : record.type === 'out' ? '#ff4d4f' : '#1677ff', fontWeight: 500 }">
            <template v-if="record.type === 'in'">+{{ record.quantity }}</template>
            <template v-else-if="record.type === 'out'">-{{ record.quantity }}</template>
            <template v-else>{{ record.quantity ?? '-' }}</template>
          </span>
        </template>

        <template v-else-if="column.key === 'stockChange'">
          <span v-if="record.before_stock != null && record.after_stock != null">
            {{ record.before_stock }} → {{ record.after_stock }}
          </span>
          <span v-else>-</span>
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
  import type { InventoryItem, StockRecord } from '@/api/inventory'

  interface StockHistoryRecord extends StockRecord {
    id: string
    itemName?: string
  }

  const columns = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
    { title: '零件名称', dataIndex: 'itemName', key: 'itemName', width: 140 },
    { title: '变更数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
    { title: '库存变更', key: 'stockChange', width: 140 },
    { title: '操作时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true }
  ]

  const loading = ref(false)
  const itemsLoading = ref(false)
  const inventoryItems = ref<InventoryItem[]>([])
  const selectedItemId = ref<string>('')
  const historyRecords = ref<StockHistoryRecord[]>([])
  const pageIndex = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  const itemOptions = computed(() =>
    inventoryItems.value.map((item: InventoryItem) => ({
      label: `${item.name} (${item.code})`,
      value: item.item_id
    }))
  )

  const filterItemOption = (input: string, option: { label: string; value: string }) => {
    return option.label.toLowerCase().includes(input.toLowerCase())
  }

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

  const loadInventoryItems = async () => {
    itemsLoading.value = true
    try {
      const response = await inventoryApi.listItems({
        pageIndex: 1,
        pageSize: 1000
      })
      if (response.result === 0) {
        inventoryItems.value = response.datas.items
      } else {
        message.error(response.msg || '加载零件列表失败')
      }
    } catch (error) {
      console.error('加载零件列表失败:', error)
      message.error('加载零件列表失败')
    } finally {
      itemsLoading.value = false
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
      const response = await inventoryApi.listStockHistory({
        item_id: selectedItemId.value,
        pageIndex: pageIndex.value,
        pageSize: pageSize.value
      })
      if (response.result === 0) {
        const item = inventoryItems.value.find((i: InventoryItem) => i.item_id === selectedItemId.value)
        historyRecords.value = response.datas.items.map((record: StockRecord & { id?: string }) => ({
          ...record,
          id: record.id || record.record_id,
          itemName: item?.name || '-',
          quantity: record.type === 'check'
            ? Math.abs((record.after_stock ?? 0) - (record.before_stock ?? 0))
            : record.quantity
        }))
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

  const handleItemChange = () => {
    pageIndex.value = 1
    loadHistory()
  }

  const handlePageChange = (page: number, size: number) => {
    pageIndex.value = page
    pageSize.value = size
    loadHistory()
  }

  onMounted(() => {
    loadInventoryItems()
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
</style>
