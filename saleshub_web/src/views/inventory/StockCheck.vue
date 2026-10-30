<template>
  <div class="page">
    <div class="page-head">
      <a-space class="filters" :size="12" wrap>
        <a-input
          v-model:value="filters.record_no"
          placeholder="按盘点单号精确搜索"
          allow-clear
          class="filter-input"
          @press-enter="handleSearch"
          @change="handleFilterChange"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>

        <a-select
          v-model:value="filterParentTypeId"
          placeholder="一级类型"
          allow-clear
          class="filter-select"
          :loading="typesLoading"
          @change="handleParentTypeChange"
        >
          <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select
          v-model:value="filterChildTypeId"
          placeholder="二级类型"
          allow-clear
          class="filter-select"
          :loading="typesLoading"
          @change="handleChildTypeChange"
        >
          <a-select-option v-for="t in filterChildTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select
          v-model:value="selectedItemId"
          placeholder="选择零件"
          allow-clear
          show-search
          class="filter-select-wide"
          :loading="itemsLoading"
          :options="itemOptions"
          :filter-option="filterOption"
          @change="handleItemChange"
        >
        </a-select>

        <a-select
          v-model:value="selectedSpecId"
          placeholder="选择规格"
          allow-clear
          class="filter-select"
          :options="specOptions"
          :disabled="!selectedItemId"
          @change="handleSearch"
        >
        </a-select>

        <a-range-picker v-model:value="dateRange" :format="'YYYY-MM-DD'" @change="handleSearch" />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <a-button type="primary" class="action-btn" @click="handleStockCheck">
        <template #icon>
          <PlusOutlined />
        </template>
        盘点
      </a-button>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        bordered
        row-key="check_id"
        @change="handleTableChange"
      >
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

          <template v-else-if="column.key === 'diff'">
            <span :class="diffClass(record)">{{ formatDiff(record) }}</span>
          </template>

          <template v-else-if="column.key === 'stockChange'">
            <span v-if="record.before_stock != null && record.after_stock != null">
              {{ record.before_stock }} → {{ record.after_stock }}
            </span>
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

    <StockCheckModal v-model:visible="modalVisible" @success="handleStockCheckSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import type { Dayjs } from 'dayjs';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import type { ChangeEvent } from 'ant-design-vue/es/_util/EventInterface';
import type { TablePaginationConfig } from 'ant-design-vue/es/table';
import { inventoryApi } from '@/api/inventory';
import type { StockCheckRecord, ItemTypeNode, InventoryItem, ItemSpec } from '@/types/inventory';
import StockCheckModal from '@/components/inventory/StockCheckModal.vue';

const columns = [
  {
    title: '盘点单号',
    dataIndex: 'record_no',
    key: 'record_no',
    width: 140,
    align: 'center' as const,
  },
  { title: '零件', key: 'item', width: 180, ellipsis: true, align: 'center' as const },
  { title: '规格', dataIndex: 'spec', key: 'spec', width: 120, align: 'center' as const },
  { title: '盈亏', key: 'diff', width: 90, align: 'center' as const },
  { title: '库存变更', key: 'stockChange', width: 150, align: 'center' as const },
  { title: '盘点日期', dataIndex: 'date', key: 'date', width: 130, align: 'center' as const },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, align: 'center' as const },
  {
    title: '操作时间',
    dataIndex: 'create_time',
    key: 'create_time',
    width: 170,
    align: 'center' as const,
  },
];

const loading = ref(false);
const records = ref<StockCheckRecord[]>([]);
const modalVisible = ref(false);

// 类型相关
const typesLoading = ref(false);
const allTypes = ref<ItemTypeNode[]>([]);
const parentTypes = ref<ItemTypeNode[]>([]);
const filterParentTypeId = ref<string | undefined>(undefined);
const filterChildTypeId = ref<string | undefined>(undefined);
const filterChildTypes = ref<ItemTypeNode[]>([]);

// 零件相关
const itemsLoading = ref(false);
const allItemsUnfiltered = ref<InventoryItem[]>([]); // 所有零件（未筛选）
const allItems = ref<InventoryItem[]>([]); // 筛选后的零件
const selectedItemId = ref<string>('');
const selectedSpecId = ref<string>('');

// 加载所有零件
const loadAllItems = async () => {
  itemsLoading.value = true;
  try {
    const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 });
    allItemsUnfiltered.value = res.datas.items || [];
    allItems.value = allItemsUnfiltered.value;
  } catch {
    allItemsUnfiltered.value = [];
    allItems.value = [];
  } finally {
    itemsLoading.value = false;
  }
};

// 根据类型筛选零件
const filterItems = () => {
  const typeId = filterChildTypeId.value || filterParentTypeId.value;
  if (typeId) {
    allItems.value = allItemsUnfiltered.value.filter((item) => {
      if (item.type_id === typeId) return true;
      const parent = allTypes.value.find((t) => t.type_id === typeId);
      if (parent?.children?.some((c) => c.type_id === item.type_id)) return true;
      return false;
    });
  } else {
    allItems.value = allItemsUnfiltered.value;
  }
};

// 零件选项
const itemOptions = computed(() =>
  allItems.value.map((item: InventoryItem) => ({
    label: `${item.name} (${item.code})`,
    value: item.item_id,
  })),
);

// 规格选项
const specOptions = computed(() => {
  if (!selectedItemId.value) return [];
  const item = allItems.value.find((i: InventoryItem) => i.item_id === selectedItemId.value);
  if (!item) return [];
  return item.specs.map((spec: ItemSpec) => ({
    label: spec.spec || '默认规格',
    value: spec.spec_id,
  }));
});

// 加载类型
const loadTypes = async () => {
  typesLoading.value = true;
  try {
    const res = await inventoryApi.listItemTypes();
    allTypes.value = (res.datas || res) as ItemTypeNode[];
    parentTypes.value = allTypes.value;
  } catch {
    // 错误由拦截器处理
  } finally {
    typesLoading.value = false;
  }
};

// 一级类型变更
const handleParentTypeChange = (value: string | undefined) => {
  filterChildTypeId.value = undefined;
  selectedItemId.value = '';
  selectedSpecId.value = '';

  if (value) {
    const parent = allTypes.value.find((t) => t.type_id === value);
    filterChildTypes.value = parent?.children || [];
  } else {
    filterChildTypes.value = [];
  }
  filterItems();
};

// 二级类型变更
const handleChildTypeChange = () => {
  selectedItemId.value = '';
  selectedSpecId.value = '';
  filterItems();
};

const handleItemChange = () => {
  selectedSpecId.value = '';
  pagination.current = 1;
  loadRecords();
};

const filters = reactive({
  record_no: '',
});
const dateRange = ref<[Dayjs, Dayjs] | null>(null);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
});

const formatDate = (date: string): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDiff = (record: StockCheckRecord): string => {
  const diff = record.after_stock - record.before_stock;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return '0';
};

const diffClass = (record: StockCheckRecord): string => {
  const diff = record.after_stock - record.before_stock;
  if (diff > 0) return 'stock-num text-plus';
  if (diff < 0) return 'stock-num text-minus';
  return 'stock-num text-zero';
};

const filterOption = (input: string, option: { label: string }) =>
  option.label.toLowerCase().includes(input.toLowerCase());

const loadRecords = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.listStockCheckRecords({
      pageIndex: pagination.current,
      pageSize: pagination.pageSize,
      record_no: filters.record_no || undefined,
      item_id: selectedItemId.value || undefined,
      spec_id: selectedSpecId.value || undefined,
      start_date: dateRange.value?.[0]?.format('YYYY-MM-DD'),
      end_date: dateRange.value?.[1]?.format('YYYY-MM-DD'),
    });
    records.value = res.datas.items;
    pagination.total = res.datas.total;
  } catch {
    records.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.current = 1;
  loadRecords();
};

const handleReset = () => {
  filters.record_no = '';
  dateRange.value = null;
  filterParentTypeId.value = undefined;
  filterChildTypeId.value = undefined;
  selectedItemId.value = '';
  selectedSpecId.value = '';
  filterChildTypes.value = [];
  allItems.value = allItemsUnfiltered.value;
  pagination.current = 1;
  loadRecords();
};

const handleFilterChange = (e: ChangeEvent) => {
  if (e.target.value === '') {
    handleSearch();
  }
};

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current ?? 1;
  pagination.pageSize = pag.pageSize ?? 10;
  loadRecords();
};

const handleStockCheck = () => {
  modalVisible.value = true;
};

const handleStockCheckSuccess = () => {
  modalVisible.value = false;
  pagination.current = 1;
  loadRecords();
};

onMounted(() => {
  loadRecords();
  loadTypes();
  loadAllItems();
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

.filter-select-wide {
  width: 200px;
}

.filter-input :deep(.ant-input-affix-wrapper),
.filter-input :deep(.ant-input-affix-wrapper-focused),
.filter-select :deep(.ant-select-selector),
.filter-select-wide :deep(.ant-select-selector) {
  border-radius: 8px !important;
}

.filter-input :deep(.ant-input-affix-wrapper-focused) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.action-btn {
  border-radius: 8px;
  background: #2563eb;
  border-color: #2563eb;
  font-weight: 500;
  transition: all 0.18s ease;
}

.action-btn:hover {
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

.table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: #dce8f5;
}

.cell-code {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 15px;
  color: #52525b;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.cell-muted {
  color: #a1a1aa;
}

.stock-num {
  font-weight: 600;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.text-plus {
  color: #16a34a;
}

.text-minus {
  color: #dc2626;
}

.text-zero {
  color: #71717a;
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
  .filter-select,
  .filter-select-wide {
    width: 100%;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
