<template>
  <div class="page">
    <div class="page-head">
      <a-space class="filters" :size="12" wrap>
        <a-input v-model:value="filters.name" placeholder="按名称搜索" allow-clear class="filter-input"
          @press-enter="handleSearch" @change="handleFilterChange">
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>

        <a-input v-model:value="filters.code" placeholder="按编码精确搜索" allow-clear class="filter-input"
          @press-enter="handleSearch" @change="handleFilterChange">
          <template #prefix>
            <TagOutlined />
          </template>
        </a-input>

        <a-select v-model:value="filters.type" placeholder="零件类型" allow-clear class="filter-select"
          @change="handleSearch">
          <a-select-option value="device">设备件</a-select-option>
          <a-select-option value="common">常用件</a-select-option>
        </a-select>

        <a-select v-model:value="filters.isWarning" placeholder="预警状态" allow-clear class="filter-select"
          @change="handleSearch">
          <a-select-option :value="1">正常库存</a-select-option>
          <a-select-option :value="2">预警库存</a-select-option>
        </a-select>

        <a-button @click="handleSearch">查询</a-button>
        <a-button type="text" @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="create-btn" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建零件
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table :columns="columns" :data-source="items" :loading="loading" :pagination="pagination" row-key="item_id"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :class="record.type === 'device' ? 'tag-device' : 'tag-common'">
              {{ record.type === 'device' ? '设备件' : '常用件' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'code'">
            <span class="cell-code">{{ record.code }}</span>
          </template>

          <template v-else-if="column.key === 'specs'">
            <template v-if="record.specs && record.specs.length > 0">
              <a-tag v-for="spec in record.specs" :key="spec" class="spec-tag">{{ spec }}</a-tag>
            </template>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'currentStock'">
            <span class="stock-num" :class="{ 'text-danger': record.isWarning }">
              {{ record.current_stock }}
            </span>
          </template>

          <template v-else-if="column.key === 'warnStock'">
            <span class="stock-num text-muted">{{ record.warn_stock }}</span>
          </template>

          <template v-else-if="column.key === 'warningStatus'">
            <a-tag :class="record.isWarning ? 'tag-warning' : 'tag-normal'">
              {{ record.isWarning ? '库存不足' : '正常' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm title="确定要删除此零件吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <InventoryItemForm v-model:visible="formVisible" :item="currentItem" @success="handleFormSuccess" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined, SearchOutlined, TagOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { InventoryItem, ItemType } from '@/api/inventory'
  import InventoryItemForm from '@/components/inventory/InventoryItemForm.vue'

  const columns = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, align: 'center' },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140, ellipsis: true, align: 'center' },
    { title: '编码', dataIndex: 'code', key: 'code', width: 130, align: 'center' },
    { title: '规格', key: 'specs', width: 220, align: 'center' },
    { title: '库存', key: 'currentStock', width: 100, align: 'center' },
    { title: '预警库存', key: 'warnStock', width: 110, align: 'center' },
    { title: '预警状态', key: 'warningStatus', width: 120, align: 'center' },
    { title: '操作', key: 'actions', width: 140, align: 'center' }
  ]

  const loading = ref(false)
  const items = ref<InventoryItem[]>([])
  const formVisible = ref(false)
  const currentItem = ref<InventoryItem | null>(null)

  const filters = reactive<{
    name: string
    code: string
    type: ItemType | undefined
    isWarning: 1 | 2 | undefined
  }>({
    name: '',
    code: '',
    type: undefined,
    isWarning: undefined
  })

  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`
  })

  const loadItems = async () => {
    loading.value = true
    try {
      const res = await inventoryApi.listItems({
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
        name: filters.name || undefined,
        code: filters.code || undefined,
        type: filters.type,
        isWarning: filters.isWarning
      })
      items.value = res.datas.items
      pagination.total = res.datas.total
    } catch {
      // 错误由 request 拦截器统一处理
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    loadItems()
  }

  const handleReset = () => {
    filters.name = ''
    filters.code = ''
    filters.type = undefined
    filters.isWarning = undefined
    pagination.current = 1
    loadItems()
  }

  const handleFilterChange = (e: any) => {
    if (e?.target?.value === '') {
      handleSearch()
    }
  }

  const handleTableChange = (pag: any) => {
    pagination.current = pag.current
    pagination.pageSize = pag.pageSize
    loadItems()
  }

  const handleCreate = () => {
    currentItem.value = null
    formVisible.value = true
  }

  const handleEdit = (item: InventoryItem) => {
    currentItem.value = item
    formVisible.value = true
  }

  const handleDelete = async (item: InventoryItem) => {
    try {
      await inventoryApi.deleteItem(item.item_id)
      message.success('删除成功')
      if (items.value.length === 1 && pagination.current > 1) {
        pagination.current -= 1
      }
      await loadItems()
    } catch {
      // 错误由 request 拦截器统一处理
    }
  }

  const handleFormSuccess = () => {
    formVisible.value = false
    loadItems()
  }

  onMounted(() => {
    loadItems()
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
    width: 200px;
  }

  .filter-select {
    width: 140px;
  }

  .filter-input :deep(.ant-input-affix-wrapper),
  .filter-select :deep(.ant-select-selector) {
    border-radius: 8px !important;
  }

  .filter-input :deep(.ant-input-affix-wrapper-focused) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  .create-btn {
    border-radius: 8px;
    background: #2563eb;
    border-color: #2563eb;
    font-weight: 500;
    transition: all 0.18s ease;
  }

  .create-btn:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(37, 99, 235, 0.28);
  }

  .table-card {
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .table-card :deep(.ant-card-body) {
    padding: 0;
  }

  .table-card :deep(.ant-table-thead > tr > th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 16px;
    color: #52525b;
    border-bottom: 1px solid #e4e4e7;
  }

  .table-card :deep(.ant-table-tbody > tr > td) {
    font-size: 16px;
  }

  /* 隔行灰底（偶数行） */
  .table-card :deep(.ant-table-tbody > tr:nth-child(even) > td) {
    background: #e8f0f8;
  }

  /* hover 时覆盖为浅蓝（写在隔行规则之后以确保生效） */
  .table-card :deep(.ant-table-tbody > tr:hover > td) {
    background: #cadff9;
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

  /* 编码 monospace */
  .cell-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 16px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .cell-muted {
    color: #a1a1aa;
  }

  /* 规格标签 */
  .spec-tag {
    background: #f4f4f5 !important;
    color: #52525b !important;
    border-color: transparent !important;
    border-radius: 4px;
    font-size: 16px;
    margin: 2px 4px 2px 0;
  }

  /* 库存数字（等宽数字，右对齐便于比较） */
  .stock-num {
    font-weight: 600;
    color: #18181b;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }

  .stock-num.text-muted {
    font-weight: 500;
    color: #71717a;
  }

  .stock-num.text-danger {
    color: #dc2626;
  }

  /* 预警状态标签：绿色正常 / 红色库存不足 */
  .tag-normal {
    background: rgba(16, 185, 129, 0.1) !important;
    color: #059669 !important;
    border-color: transparent !important;
    border-radius: 4px;
    font-size: 13px;
    margin: 0;
  }

  .tag-warning {
    background: rgba(220, 38, 38, 0.1) !important;
    color: #dc2626 !important;
    border-color: transparent !important;
    border-radius: 4px;
    font-size: 13px;
    margin: 0;
  }

  /* 操作按钮 */
  .table-card :deep(.ant-btn-link) {
    padding: 4px 8px;
    height: auto;
    font-size: 16px;
  }

  .table-card :deep(.ant-btn-link:hover) {
    color: #2563eb;
  }

  .table-card :deep(.ant-btn-link.ant-btn-dangerous:hover) {
    color: #dc2626;
  }

  /* 分页器 */
  .table-card :deep(.ant-pagination) {
    margin: 16px 24px;
  }

  @media (max-width: 768px) {
    .page-head {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-input,
    .filter-select {
      width: 100%;
    }

    .create-btn {
      width: 100%;
    }
  }
</style>
