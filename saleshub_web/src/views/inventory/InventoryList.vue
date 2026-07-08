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

        <a-select v-model:value="filterParentTypeId" placeholder="一级类型" allow-clear class="filter-select"
          :loading="typesLoading" @change="handleFilterParentChange">
          <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select v-model:value="filterChildTypeId" placeholder="二级类型" allow-clear class="filter-select"
          :loading="typesLoading" :disabled="!filterParentTypeId" @change="handleSearch">
          <a-select-option v-for="t in filterChildTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select v-model:value="filters.is_custom" placeholder="是否定制" allow-clear class="filter-select"
          @change="handleSearch">
          <a-select-option :value="1">否</a-select-option>
          <a-select-option :value="2">是</a-select-option>
        </a-select>

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button type="primary" @click="handleReset">重置</a-button>
      </a-space>

      <a-space :size="8">
        <a-button @click="typeManagerVisible = true">
          <template #icon>
            <AppstoreOutlined />
          </template>
          类型管理
        </a-button>
        <a-button type="primary" class="create-btn" @click="handleCreate">
          <template #icon>
            <PlusOutlined />
          </template>
          新建零件
        </a-button>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table :columns="columns" :data-source="items" :loading="loading" :pagination="pagination" bordered
        row-key="item_id" expand-row-by-click :row-expandable="isRowExpandable" @change="handleTableChange">
        <template #expandedRowRender="{ record: item }">
          <a-table :columns="specColumns" :data-source="item.specs" :pagination="false" row-key="spec_id" size="small"
            bordered class="spec-sub-table">
            <template #bodyCell="{ column, record: spec }">
              <template v-if="column.key === 'spec'">
                <span class="cell-spec">{{ spec.spec }}</span>
              </template>
              <template v-else-if="column.key === 'price'">
                <span v-if="spec.price !== null && spec.price !== undefined" class="cell-price">
                  ¥{{ spec.price }}
                </span>
                <span v-else class="cell-muted">-</span>
              </template>
              <template v-else-if="column.key === 'current_stock'">
                <span class="stock-num" :class="{ 'text-danger': isSpecWarning(item, spec) }">
                  {{ spec.current_stock }}
                </span>
              </template>
              <template v-else-if="column.key === 'warningStatus'">
                <a-tag :class="isSpecWarning(item, spec) ? 'tag-warning' : 'tag-normal'">
                  {{ isSpecWarning(item, spec) ? '库存不足' : '正常' }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'image'">
            <a-image v-if="record.image_url" :src="record.image_url" :width="50" :height="50" :preview="true"
              style="border-radius: 4px; object-fit: cover;" />
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'type'">
            <span class="type-full-name">{{ record.type_full_name || record.type_name || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'code'">
            <span class="cell-code">{{ record.code }}</span>
          </template>

          <template v-else-if="column.key === 'isCustom'">
            <a-tag :class="record.is_custom === 2 ? 'tag-custom' : 'tag-normal'">
              {{ record.is_custom === 2 ? '是' : '否' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'allSpecs'">
            <span v-if="isDefaultSpec(record)" class="cell-muted">-</span>
            <div v-else class="spec-summary">
              <span v-for="spec in record.specs" :key="spec.spec_id" class="spec-summary-item">
                {{ spec.spec }}: {{ spec.current_stock }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'totalStock'">
            <span class="stock-num" :class="{ 'text-danger': isItemWarning(record) }">
              {{ getTotalStock(record) }}
            </span>
          </template>

          <template v-else-if="column.key === 'warnStock'">
            <span class="stock-num text-muted">{{ record.warn_stock }}</span>
          </template>

          <template v-else-if="column.key === 'warningStatus'">
            <a-tag :class="isItemWarning(record) ? 'tag-warning' : 'tag-normal'">
              {{ isItemWarning(record) ? '库存不足' : '正常' }}
            </a-tag>
          </template>

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
        </template>
      </a-table>
    </a-card>

    <InventoryItemForm v-model:visible="formVisible" :item="currentItem" @success="handleFormSuccess" />
    <InventoryItemDetail v-model:visible="detailVisible" :item="detailItem" />
    <ItemTypeManager v-model:visible="typeManagerVisible" @success="loadTypes" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined, SearchOutlined, TagOutlined, AppstoreOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { InventoryItem, ItemSpec, ItemTypeNode } from '@/types/inventory'
  import InventoryItemForm from '@/components/inventory/InventoryItemForm.vue'
  import InventoryItemDetail from '@/components/inventory/InventoryItemDetail.vue'
  import ItemTypeManager from '@/components/inventory/ItemTypeManager.vue'

  const columns = [
    { title: '图片', dataIndex: 'image_url', key: 'image', width: 80, align: 'center' },
    { title: '类型', dataIndex: 'type_full_name', key: 'type', width: 140, align: 'center' },
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true, align: 'center' },
    { title: '编码', dataIndex: 'code', key: 'code', width: 130, align: 'center' },
    { title: '是否定制', dataIndex: 'is_custom', key: 'isCustom', width: 80, align: 'center' },
    { title: '所有规格', key: 'allSpecs', width: 180, ellipsis: true, align: 'center' },
    { title: '总库存', key: 'totalStock', width: 80, align: 'center' },
    { title: '预警库存', key: 'warnStock', width: 80, align: 'center' },
    { title: '预警状态', key: 'warningStatus', width: 120, align: 'center' },
    { title: '备注', key: 'remark', width: 120, align: 'center', ellipsis: true },
    { title: '操作', key: 'actions', align: 'left' }
  ]

  const specColumns = [
    { title: '规格名称', dataIndex: 'spec', key: 'spec', width: 120, align: 'center' },
    { title: '价格', dataIndex: 'price', key: 'price', width: 100, align: 'center' },
    { title: '当前库存', dataIndex: 'current_stock', key: 'current_stock', width: 100, align: 'center' },
    { title: '预警状态', key: 'warningStatus', width: 100, align: 'center' }
  ]

  const loading = ref(false)
  const items = ref<InventoryItem[]>([])
  const formVisible = ref(false)
  const typeManagerVisible = ref(false)
  const detailVisible = ref(false)
  const currentItem = ref<InventoryItem | null>(null)
  const detailItem = ref<InventoryItem | null>(null)

  // 类型筛选相关
  const typesLoading = ref(false)
  const allTypes = ref<ItemTypeNode[]>([])
  const filterParentTypeId = ref<string | undefined>(undefined)
  const filterChildTypeId = ref<string | undefined>(undefined)

  const parentTypes = ref<ItemTypeNode[]>([])

  // 根据选中的一级类型，过滤出二级类型选项
  const filterChildTypes = ref<ItemTypeNode[]>([])

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

  const getTotalStock = (item: InventoryItem): number => {
    if (!item.specs || item.specs.length === 0) return 0
    return item.specs.reduce((sum, spec) => sum + spec.current_stock, 0)
  }

  const isDefaultSpec = (item: InventoryItem): boolean => {
    const spec = item.specs?.[0]
    return item.specs?.length === 1 && spec?.spec === ''
  }

  const isRowExpandable = (item: InventoryItem): boolean => {
    if (!item.specs?.length) return false
    return !isDefaultSpec(item)
  }

  const isItemWarning = (item: InventoryItem): boolean => {
    return getTotalStock(item) <= item.warn_stock
  }

  const isSpecWarning = (item: InventoryItem, spec: ItemSpec): boolean => {
    return spec.current_stock <= item.warn_stock
  }

  const filters = reactive<{
    name: string
    code: string
    is_custom: 1 | 2 | undefined
  }>({
    name: '',
    code: '',
    is_custom: undefined
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
      // 筛选 type_id：如果有二级类型用二级，否则用一级
      const typeId = filterChildTypeId.value || filterParentTypeId.value
      const res = await inventoryApi.listItems({
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
        name: filters.name || undefined,
        code: filters.code || undefined,
        type_id: typeId,
        is_custom: filters.is_custom
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
    filters.is_custom = undefined
    filterParentTypeId.value = undefined
    filterChildTypeId.value = undefined
    filterChildTypes.value = []
    pagination.current = 1
    loadItems()
  }

  // 一级类型筛选变更时，更新二级类型选项并重置二级选择
  const handleFilterParentChange = (value: string | undefined) => {
    filterChildTypeId.value = undefined
    if (value) {
      const parent = allTypes.value.find(t => t.type_id === value)
      filterChildTypes.value = parent?.children || []
    } else {
      filterChildTypes.value = []
    }
    handleSearch()
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

  const handleDetail = (item: InventoryItem) => {
    detailItem.value = item
    detailVisible.value = true
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
    loadTypes()
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

  .type-full-name {
    font-size: 13px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
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

  .table-card :deep(.ant-table-tbody > tr:nth-child(even) > td) {
    background: #e8f0f8;
  }

  .table-card :deep(.ant-table-tbody > tr:hover > td) {
    background: #cadff9;
  }

  .cell-muted {
    color: #a1a1aa;
  }

  .cell-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 16px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .cell-spec {
    font-size: 13px;
    color: #52525b;
  }

  .cell-price {
    color: #dc2626;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .spec-summary {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .spec-summary-item {
    display: inline-block;
    padding: 2px 8px;
    font-size: 13px;
    color: #52525b;
    background: #f4f4f5;
    border-radius: 4px;
    white-space: nowrap;
  }

  .spec-sub-table {
    margin: 0 16px 8px 48px;
  }

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

  .tag-custom {
    background: rgba(168, 85, 247, 0.1) !important;
    color: #9333ea !important;
    border-color: transparent !important;
    border-radius: 4px;
    font-size: 13px;
    margin: 0;
  }

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
