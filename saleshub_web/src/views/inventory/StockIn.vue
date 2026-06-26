<template>
  <div class="page">
    <div class="page-head">
      <a-space class="filters" :size="12" wrap>
        <a-input v-model:value="filters.record_no" placeholder="按入库单号精确搜索" allow-clear class="filter-input"
          @press-enter="handleSearch" @change="handleFilterChange">
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>

        <a-range-picker v-model:value="dateRange" :format="'YYYY-MM-DD'" @change="handleSearch" />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="action-btn" @click="handleStockIn">
        <template #icon>
          <PlusOutlined />
        </template>
        入库
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table :columns="columns" :data-source="records" :loading="loading" :pagination="pagination" bordered
        row-key="record_id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'record_no'">
            <span class="cell-code">{{ record.record_no }}</span>
          </template>

          <template v-else-if="column.key === 'item'">
            <span>{{ record.item_name || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'spec'">
            <span v-if="record.spec">{{ record.spec }}</span>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'quantity'">
            <span class="stock-num text-in">+{{ record.quantity }}</span>
          </template>

          <template v-else-if="column.key === 'stockChange'">
            <span v-if="record.before_stock != null && record.after_stock != null">
              {{ record.before_stock }} → {{ record.after_stock }}
            </span>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'photo'">
            <a-image v-if="record.photo_url" :src="record.photo_url" :width="44" :height="44" :preview="true"
              style="border-radius: 4px; object-fit: cover;" />
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'remark'">
            <span v-if="record.remark">{{ record.remark }}</span>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'create_time'">
            {{ formatDate(record.create_time) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <StockInModal v-model:visible="modalVisible" @success="handleStockInSuccess" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import type { Dayjs } from 'dayjs'
  import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { StockInRecord } from '@/types/inventory'
  import StockInModal from '@/components/inventory/StockInModal.vue'

  const columns = [
    { title: '入库单号', dataIndex: 'record_no', key: 'record_no', width: 140, align: 'center' as const },
    { title: '零件', key: 'item', width: 180, ellipsis: true, align: 'center' as const },
    { title: '规格', dataIndex: 'spec', key: 'spec', width: 120, align: 'center' as const },
    { title: '入库数量', dataIndex: 'quantity', key: 'quantity', width: 110, align: 'center' as const },
    { title: '库存变更', key: 'stockChange', width: 150, align: 'center' as const },
    { title: '入库日期', dataIndex: 'date', key: 'date', width: 130, align: 'center' as const },
    { title: '照片', dataIndex: 'photo_url', key: 'photo', width: 80, align: 'center' as const },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, align: 'center' as const },
    { title: '操作时间', dataIndex: 'create_time', key: 'create_time', width: 170, align: 'center' as const }
  ]

  const loading = ref(false)
  const records = ref<StockInRecord[]>([])
  const modalVisible = ref(false)

  const filters = reactive({
    record_no: ''
  })
  const dateRange = ref<[Dayjs, Dayjs] | null>(null)

  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`
  })

  const formatDate = (date: string): string => {
    if (!date) return '-'
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const loadRecords = async () => {
    loading.value = true
    try {
      const res = await inventoryApi.listStockInRecords({
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
        record_no: filters.record_no || undefined,
        start_date: dateRange.value?.[0]?.format('YYYY-MM-DD'),
        end_date: dateRange.value?.[1]?.format('YYYY-MM-DD')
      })
      records.value = res.datas.items
      pagination.total = res.datas.total
    } catch {
      records.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    loadRecords()
  }

  const handleReset = () => {
    filters.record_no = ''
    dateRange.value = null
    pagination.current = 1
    loadRecords()
  }

  const handleFilterChange = (e: any) => {
    if (e?.target?.value === '') {
      handleSearch()
    }
  }

  const handleTableChange = (pag: any) => {
    pagination.current = pag.current
    pagination.pageSize = pag.pageSize
    loadRecords()
  }

  const handleStockIn = () => {
    modalVisible.value = true
  }

  const handleStockInSuccess = () => {
    modalVisible.value = false
    pagination.current = 1
    loadRecords()
  }

  onMounted(() => {
    loadRecords()
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
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .filters {
    flex-wrap: wrap;
  }

  .filter-input {
    width: 240px;
  }

  .filter-input :deep(.ant-input-affix-wrapper),
  .filter-input :deep(.ant-input-affix-wrapper-focused) {
    border-radius: 8px;
  }

  .filter-input :deep(.ant-input-affix-wrapper-focused) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  .action-btn {
    border-radius: 8px;
    background: #16a34a;
    border-color: #16a34a;
    font-weight: 500;
    transition: all 0.18s ease;
  }

  .action-btn:hover {
    background: #15803d;
    border-color: #15803d;
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(22, 163, 74, 0.28);
  }

  .table-card {
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .table-card :deep(.ant-card-body) {
    padding: 0;
  }

  .table-card :deep(.ant-table-thead>tr>th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 16px;
    color: #52525b;
    border-bottom: 1px solid #e4e4e7;
  }

  .table-card :deep(.ant-table-tbody>tr>td) {
    font-size: 16px;
  }

  .table-card :deep(.ant-table-tbody>tr:nth-child(even)>td) {
    background: #f0f7f1;
  }

  .table-card :deep(.ant-table-tbody>tr:hover>td) {
    background: #dcf3e3;
  }

  .cell-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 15px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
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
    font-size: 13px;
    color: #a1a1aa;
  }

  .cell-muted {
    color: #a1a1aa;
  }

  .stock-num {
    font-weight: 600;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }

  .text-in {
    color: #16a34a;
  }

  .table-card :deep(.ant-pagination) {
    margin: 16px 24px;
  }

  @media (max-width: 768px) {
    .page-head {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-input {
      width: 100%;
    }

    .action-btn {
      width: 100%;
    }
  }
</style>
