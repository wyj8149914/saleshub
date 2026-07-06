<template>
  <!-- 产品管理列表页：筛选、分页、新建/编辑/删除、关联零件 -->
  <div class="page">
    <!-- 顶部筛选栏与新建按钮 -->
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

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button type="primary" @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="create-btn" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建产品
      </a-button>
    </div>

    <!-- 产品数据表格，分页变更由 handleTableChange 处理 -->
    <a-card :bordered="false" class="table-card">
      <a-table :columns="columns" :data-source="products" :loading="loading" :pagination="pagination" bordered
        row-key="product_id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <!-- 产品缩略图，无图显示占位 -->
          <template v-if="column.key === 'image'">
            <a-image v-if="record.image_url" :src="record.image_url" :width="50" :height="50" :preview="true"
              style="border-radius: 4px; object-fit: cover;" />
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'code'">
            <span class="cell-code">{{ record.code }}</span>
          </template>

          <template v-else-if="column.key === 'description'">
            <a-tooltip :title="record.description" placement="topLeft">
              <span class="cell-desc">{{ record.description || '-' }}</span>
            </a-tooltip>
          </template>

          <template v-else-if="column.key === 'price'">
            <span v-if="record.price !== null && record.price !== undefined" class="cell-price">
              ¥{{ record.price }}
            </span>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'remark'">
            <a-tooltip :title="record.remark" placement="topLeft">
              <span class="cell-desc">{{ record.remark || '-' }}</span>
            </a-tooltip>
          </template>

          <!-- 行操作：编辑、关联零件、删除（带二次确认） -->
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

    <!-- 新建/编辑产品弹窗 -->
    <ProductForm v-model:visible="formVisible" :product="currentProduct" @success="handleFormSuccess" />

    <!-- 管理产品关联零件弹窗 -->
    <ProductItemsManager v-model:visible="itemsManagerVisible" :product="currentProductForItems" />
  </div>
</template>

<script setup lang="ts">
  /**
   * ProductList — 产品管理列表页
   *
   * 职责：展示产品分页列表，支持按名称/编码筛选，
   * 并提供新建、编辑、删除及「关联零件」入口。
   */
  import { ref, reactive, onMounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined, SearchOutlined, TagOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { Product } from '@/types/inventory'
  import ProductForm from '@/components/inventory/ProductForm.vue'
  import ProductItemsManager from '@/components/inventory/ProductItemsManager.vue'

  /** 表格列定义，key 与模板 #bodyCell 中的 column.key 对应 */
  const columns = [
    { title: '图片', dataIndex: 'image_url', key: 'image', width: 80, align: 'center' },
    { title: '产品名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true, align: 'center' },
    { title: '产品编码', dataIndex: 'code', key: 'code', width: 140, align: 'center' },
    { title: '产品描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true, align: 'center' },
    { title: '价格', dataIndex: 'price', key: 'price', width: 100, align: 'center' },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 150, ellipsis: true, align: 'center' },
    { title: '操作', key: 'actions', width: 260, align: 'center' }
  ]

  /** 表格数据加载中 */
  const loading = ref(false)
  /** 当前页产品列表 */
  const products = ref<Product[]>([])
  /** 产品表单弹窗显隐 */
  const formVisible = ref(false)
  /** 当前编辑的产品；null 表示新建模式 */
  const currentProduct = ref<Product | null>(null)
  /** 零件关联管理弹窗显隐 */
  const itemsManagerVisible = ref(false)
  /** 当前要管理零件关联的产品 */
  const currentProductForItems = ref<Product | null>(null)

  /** 筛选条件：名称模糊、编码精确 */
  const filters = reactive({
    name: '',
    code: ''
  })

  /** 分页配置，与 a-table pagination 双向联动 */
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`
  })

  /**
   * 加载产品列表
   * 根据当前分页与 filters 调用 listProducts API
   */
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

  /** 查询：重置到第一页并重新加载 */
  const handleSearch = () => {
    pagination.current = 1
    loadProducts()
  }

  /** 重置筛选条件并重新加载第一页 */
  const handleReset = () => {
    filters.name = ''
    filters.code = ''
    pagination.current = 1
    loadProducts()
  }

  /**
   * 筛选输入框 change 回调
   * 点击 clearable 清空时立即触发查询，无需再点「查询」
   */
  const handleFilterChange = (e: any) => {
    if (e?.target?.value === '') {
      handleSearch()
    }
  }

  /** 表格分页/每页条数变化时更新 pagination 并重新加载 */
  const handleTableChange = (pag: any) => {
    pagination.current = pag.current
    pagination.pageSize = pag.pageSize
    loadProducts()
  }

  /** 打开新建产品弹窗 */
  const handleCreate = () => {
    currentProduct.value = null
    formVisible.value = true
  }

  /** 打开编辑产品弹窗，传入当前行数据 */
  const handleEdit = (product: Product) => {
    currentProduct.value = product
    formVisible.value = true
  }

  /** 打开零件关联管理弹窗 */
  const handleManageItems = (product: Product) => {
    currentProductForItems.value = product
    itemsManagerVisible.value = true
  }

  /**
   * 删除产品
   * 若当前页删至最后一条且不在第一页，自动回退一页再刷新
   */
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

  /** 产品表单保存成功后关闭弹窗并刷新列表 */
  const handleFormSuccess = () => {
    formVisible.value = false
    loadProducts()
  }

  /** 页面挂载时加载首屏数据 */
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

  .cell-price {
    color: #dc2626;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .cell-muted {
    color: #a1a1aa;
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