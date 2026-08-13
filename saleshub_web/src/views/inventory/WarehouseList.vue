<template>
  <div class="page">
    <div class="page-head">
      <a-space class="filters" :size="12" wrap>
        <a-input
          v-model:value="filters.name"
          placeholder="按仓库名称搜索"
          allow-clear
          class="filter-input"
          @press-enter="handleSearch"
          @change="handleFilterChange"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="create-btn" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建仓库
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="warehouses"
        :loading="loading"
        :pagination="pagination"
        bordered
        row-key="warehouse_id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="cell-name">{{ record.name }}</span>
          </template>

          <template v-else-if="column.key === 'location'">
            <span v-if="record.location" class="cell-location">{{ record.location }}</span>
            <span v-else class="cell-muted">-</span>
          </template>

          <template v-else-if="column.key === 'createTime'">
            <span class="cell-time">{{ formatTime(record.create_time) }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="actions-cell">
              <a-space :size="4">
                <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
                <a-popconfirm title="确定要删除此仓库吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record)" placement="left">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <WarehouseForm v-model:visible="formVisible" :warehouse="currentWarehouse" @success="handleFormSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import type { ChangeEvent } from 'ant-design-vue/es/_util/EventInterface';
import type { TablePaginationConfig } from 'ant-design-vue/es/table';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { inventoryApi } from '@/api/inventory';
import type { Warehouse } from '@/types/warehouse';
import WarehouseForm from '@/components/inventory/WarehouseForm.vue';

const columns = [
  { title: '仓库名称', dataIndex: 'name', key: 'name', width: 200, align: 'center' },
  {
    title: '位置',
    dataIndex: 'location',
    key: 'location',
    width: 250,
    align: 'center',
    ellipsis: true,
  },
  { title: '创建时间', dataIndex: 'create_time', key: 'createTime', width: 180, align: 'center' },
  { title: '操作', key: 'actions', width: 150, align: 'center' },
];

const loading = ref(false);
const warehouses = ref<Warehouse[]>([]);
const formVisible = ref(false);
const currentWarehouse = ref<Warehouse | null>(null);

const filters = reactive<{
  name: string;
  status: 1 | 2 | undefined;
}>({
  name: '',
  status: undefined,
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
});

const formatTime = (time: string): string => {
  return dayjs(time).format('YYYY-MM-DD HH:mm');
};

// 所有仓库数据（后端暂不支持分页，需前端处理）
const allWarehouses = ref<Warehouse[]>([]);

// 应用前端分页
const applyPagination = () => {
  const start = (pagination.current - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  warehouses.value = allWarehouses.value.slice(start, end);
};

const loadWarehouses = async () => {
  loading.value = true;
  try {
    // 后端当前只支持 name 筛选，不支持分页和 status
    // TODO: 等 Task 11 后端补充分页和 status 筛选后，改为服务端分页
    const res = await inventoryApi.listWarehouses({
      pageIndex: 1,
      pageSize: 999,
      name: filters.name || undefined,
    });
    const list: Warehouse[] = res.datas || res;

    // 前端处理 status 筛选
    let filtered = list;
    if (filters.status !== undefined) {
      filtered = list.filter((w) => w.status === filters.status);
    }

    allWarehouses.value = filtered;
    pagination.total = filtered.length;

    // 应用前端分页
    applyPagination();
  } catch {
    // 错误由 request 拦截器统一处理
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.current = 1;
  loadWarehouses();
};

const handleReset = () => {
  filters.name = '';
  filters.status = undefined;
  pagination.current = 1;
  loadWarehouses();
};

const handleFilterChange = (e: ChangeEvent) => {
  if (e.target.value === '') {
    handleSearch();
  }
};

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current ?? 1;
  pagination.pageSize = pag.pageSize ?? 10;
  // 前端分页，不需要重新请求
  applyPagination();
};

const handleCreate = () => {
  currentWarehouse.value = null;
  formVisible.value = true;
};

const handleEdit = (warehouse: Warehouse) => {
  currentWarehouse.value = warehouse;
  formVisible.value = true;
};

const handleDelete = async (warehouse: Warehouse) => {
  try {
    await inventoryApi.deleteWarehouse(warehouse.warehouse_id);
    message.success('删除成功');
    await loadWarehouses();
  } catch {
    // 错误由 request 拦截器统一处理
  }
};

const handleFormSuccess = () => {
  formVisible.value = false;
  loadWarehouses();
};

onMounted(() => {
  loadWarehouses();
});
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
  font-size: 14px;
  color: #52525b;
  border-bottom: 1px solid #e4e4e7;
}

.table-card :deep(.ant-table-tbody > tr > td) {
  font-size: 14px;
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

.cell-name {
  font-weight: 500;
  color: #18181b;
}

.cell-location {
  color: #52525b;
}

.cell-time {
  font-size: 13px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
}

.tag-normal {
  background: rgba(16, 185, 129, 0.1) !important;
  color: #059669 !important;
  border-color: transparent !important;
  border-radius: 4px;
  font-size: 13px;
  margin: 0;
}

.tag-disabled {
  background: rgba(161, 161, 170, 0.1) !important;
  color: #71717a !important;
  border-color: transparent !important;
  border-radius: 4px;
  font-size: 13px;
  margin: 0;
}

.table-card :deep(.ant-btn-link) {
  padding: 4px 8px;
  height: auto;
  font-size: 14px;
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
