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

        <a-button @click="handleSearch">查询</a-button>
        <a-button type="text" @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="create-btn" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建产品
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table :columns="columns" :data-source="products" :loading="loading" :pagination="pagination"
        row-key="product_id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="cell-code">{{ record.code }}</span>
          </template>

          <template v-else-if="column.key === 'description'">
            <span class="cell-desc">{{ record.description || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="handleManageItems(record)">关联零件</a-button>
              <a-popconfirm title="确定要删除此产品吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <ProductForm v-model:visible="formVisible" :product="currentProduct" @success="handleFormSuccess" />

    <ProductItemsManager v-model:visible="itemsManagerVisible" :product="currentProductForItems" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined, SearchOutlined, TagOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { Product } from '@/api/inventory'
  import ProductForm from '@/components/inventory/ProductForm.vue'
  import ProductItemsManager from '@/components/inventory/ProductItemsManager.vue'

  const columns = [
    { title: '产品名称', dataIndex: 'name', key: 'name', width: 240, ellipsis: true, align: 'center' },
    { title: '产品编码', dataIndex: 'code', key: 'code', width: 200, align: 'center' },
    { title: '产品描述', dataIndex: 'description', key: 'description', ellipsis: true, align: 'center' },
    { title: '操作', key: 'actions', width: 280, align: 'center' }
  ]

  const loading = ref(false)
  const products = ref<Product[]>([])
  const formVisible = ref(false)
  const currentProduct = ref<Product | null>(null)
  const itemsManagerVisible = ref(false)
  const currentProductForItems = ref<Product | null>(null)

  const filters = reactive({
    name: '',
    code: ''
  })

  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`
  })

  const loadProducts = async () => {
    loading.value = true
    try {
      const res = await inventoryApi.listProducts({
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
        name: filters.name || undefined,
        code: filters.code || undefined
      })
      products.value = res.datas.items
      pagination.total = res.datas.total
    } catch {
      // 错误由 request 拦截器统一处理
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    loadProducts()
  }

  const handleReset = () => {
    filters.name = ''
    filters.code = ''
    pagination.current = 1
    loadProducts()
  }

  // 输入框 clearable 时，清空后立即触发查询
  const handleFilterChange = (e: any) => {
    if (e?.target?.value === '') {
      handleSearch()
    }
  }

  const handleTableChange = (pag: any) => {
    pagination.current = pag.current
    pagination.pageSize = pag.pageSize
    loadProducts()
  }

  const handleCreate = () => {
    currentProduct.value = null
    formVisible.value = true
  }

  const handleEdit = (product: Product) => {
    currentProduct.value = product
    formVisible.value = true
  }

  const handleManageItems = (product: Product) => {
    currentProductForItems.value = product
    itemsManagerVisible.value = true
  }

  const handleDelete = async (product: Product) => {
    try {
      await inventoryApi.deleteProduct(product.product_id)
      message.success('删除成功')
      // 若当前页删除后为空且不是第一页，回退一页
      if (products.value.length === 1 && pagination.current > 1) {
        pagination.current -= 1
      }
      await loadProducts()
    } catch {
      // 错误由 request 拦截器统一处理
    }
  }

  const handleFormSuccess = () => {
    formVisible.value = false
    loadProducts()
  }

  onMounted(() => {
    loadProducts()
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
    width: 220px;
  }

  .filter-input :deep(.ant-input-affix-wrapper) {
    border-radius: 8px;
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

  .cell-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 16px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .cell-desc {
    color: #52525b;
  }

  /* 操作按钮去掉内边距，更紧凑 */
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

    .filter-input {
      width: 100%;
    }

    .create-btn {
      width: 100%;
    }
  }
</style>
