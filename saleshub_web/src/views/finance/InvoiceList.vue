<template>
  <div class="page">
    <div class="page-head">
      <a-space :size="12" wrap>
        <a-select
          v-model:value="filterNature"
          placeholder="发票性质"
          allow-clear
          style="width: 120px"
          :options="natureOptions"
        />

        <a-select
          v-model:value="filterPurpose"
          placeholder="发票用途"
          allow-clear
          style="width: 130px"
          :options="purposeOptions"
        />

        <a-select
          v-model:value="filterTaxStatus"
          placeholder="报税状态"
          allow-clear
          style="width: 110px"
          :options="taxStatusOptions"
        />

        <a-range-picker v-model:value="filterDateRange" format="YYYY-MM-DD" value-format="YYYY-MM-DD" />

        <a-input
          v-model:value="filterKeyword"
          placeholder="发票号码/销售方/购买方"
          style="width: 240px"
          allow-clear
          @search="handleSearch"
        />

        <a-input v-model:value="filterTag" placeholder="标签" style="width: 140px" allow-clear @search="handleSearch" />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>

        <a-button type="primary" @click="openUpload('single')">
          <template #icon><FileAddOutlined /></template>
          单个识别
        </a-button>
        <a-button @click="openUpload('batch')">
          <template #icon><FolderAddOutlined /></template>
          批量识别
        </a-button>
      </a-space>
    </div>

    <!-- 批量报税操作条:选中发票后显示 -->
    <a-alert v-if="selectedRowKeys.length > 0" type="info" show-icon>
      <template #message>
        <a-space :size="12" wrap>
          <span>已选 {{ selectedRowKeys.length }} 张发票</span>
          <a-button type="primary" size="small" @click="handleTaxFile(InvoiceTaxStatus.FILED)">批量报税</a-button>
          <a-button size="small" @click="handleTaxFile(InvoiceTaxStatus.NOT_FILED)">取消报税</a-button>
          <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
        </a-space>
      </template>
    </a-alert>

    <a-table
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :row-selection="rowSelection"
      :pagination="{
        current: pageIndex,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (t: number) => `共 ${t} 条`,
        onChange: handlePageChange,
      }"
      bordered
      :row-key="(record: Invoice) => record.invoice_id"
      :scroll="{ x: true }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'sub_type_desc'">
          {{ record.sub_type_desc || '-' }}
        </template>

        <template v-else-if="column.key === 'invoice_date'">
          {{ formatDatePart(record.invoice_date) }}
        </template>

        <template v-else-if="column.key === 'total_amount'">
          <span class="amount-text">{{ record.total_amount ?? '-' }}</span>
        </template>

        <template v-else-if="column.key === 'tax_amount'">
          <span class="amount-text">{{ record.tax_amount ?? '-' }}</span>
        </template>

        <template v-else-if="column.key === 'invoice_nature'">
          <a-tag
            v-if="record.invoice_nature != null"
            :color="record.invoice_nature === InvoiceNature.ACTUAL ? 'blue' : 'purple'"
          >
            {{ INVOICE_NATURE_LABELS[record.invoice_nature] || '-' }}
          </a-tag>
          <span v-else>-</span>
        </template>

        <template v-else-if="column.key === 'invoice_purpose'">
          <a-tag v-if="record.invoice_purpose != null" color="cyan">
            {{ INVOICE_PURPOSE_LABELS[record.invoice_purpose] || '-' }}
          </a-tag>
          <span v-else>-</span>
        </template>

        <template v-else-if="column.key === 'is_tax_filed'">
          <a-tag v-if="record.is_tax_filed === InvoiceTaxStatus.FILED" color="success">已报税</a-tag>
          <a-tag v-else>未报税</a-tag>
        </template>

        <template v-else-if="column.key === 'tax_filed_time'">
          {{ formatDateTime(record.tax_filed_time) }}
        </template>

        <template v-else-if="column.key === 'create_time'">
          {{ formatDateTime(record.create_time) }}
        </template>

        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>

    <!-- 单个/批量识别弹窗 -->
    <InvoiceUploadModal v-model:open="uploadOpen" :mode="uploadMode" @success="loadList" />

    <!-- 发票详情抽屉 -->
    <InvoiceDetailDrawer v-model:open="detailOpen" :invoice-id="detailId" />
  </div>
</template>

<script setup lang="ts">
/**
 * 发票列表页:分页查询 + 筛选(性质/用途/报税状态/开票日期区间/关键字)
 * 入口:单个识别、批量识别(弹窗),发票详情(抽屉),多选批量报税/取消报税
 */
import { computed, onMounted, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { FileAddOutlined, FolderAddOutlined } from '@ant-design/icons-vue';
import { invoiceApi } from '@/api/invoice';
import { useAuthStore } from '@/stores/auth';
import {
  INVOICE_NATURE_LABELS,
  INVOICE_PURPOSE_LABELS,
  INVOICE_TAX_STATUS_LABELS,
  InvoiceNature,
  InvoiceTaxStatus,
} from '@/types/invoice';
import type { Invoice, InvoiceListQuery } from '@/types/invoice';
import { validateTaxSelection } from '@/utils/invoice';
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal.vue';
import InvoiceDetailDrawer from '@/components/invoice/InvoiceDetailDrawer.vue';

const columns = [
  { title: '发票号码', dataIndex: 'invoice_number', key: 'invoice_number', width: 200, fixed: 'left' as const },
  { title: '发票类型', dataIndex: 'sub_type_desc', key: 'sub_type_desc', width: 150 },
  { title: '销售方', dataIndex: 'seller_name', key: 'seller_name', ellipsis: true },
  { title: '购买方', dataIndex: 'buyer_name', key: 'buyer_name', ellipsis: true },
  { title: '开票日期', dataIndex: 'invoice_date', key: 'invoice_date', width: 110 },
  { title: '价税合计', dataIndex: 'total_amount', key: 'total_amount', width: 100, align: 'right' as const },
  { title: '税额', dataIndex: 'tax_amount', key: 'tax_amount', width: 100, align: 'right' as const },
  { title: '性质', dataIndex: 'invoice_nature', key: 'invoice_nature', width: 90 },
  { title: '用途', dataIndex: 'invoice_purpose', key: 'invoice_purpose', width: 100 },
  { title: '报税状态', dataIndex: 'is_tax_filed', key: 'is_tax_filed', width: 90 },
  { title: '报税时间', dataIndex: 'tax_filed_time', key: 'tax_filed_time', width: 160 },
  { title: '入库时间', dataIndex: 'create_time', key: 'create_time', width: 160 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<Invoice[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 多选与批量报税 ============
const authStore = useAuthStore();
/** 已选中发票的 invoice_id 列表 */
const selectedRowKeys = ref<string[]>([]);

/** 行多选配置:勾选变化时同步 selectedRowKeys */
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys as string[];
  },
}));

/** 清空选中 */
const clearSelection = () => {
  selectedRowKeys.value = [];
};

// ============ 筛选状态 ============
const filterNature = ref<number | undefined>(undefined);
const filterPurpose = ref<number | undefined>(undefined);
/** 报税状态筛选:1-未报税,2-已报税 */
const filterTaxStatus = ref<number | undefined>(undefined);
const filterKeyword = ref('');
/** 开票日期区间,[start_date, end_date],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();
const filterTag = ref('');

// 筛选下拉选项
const natureOptions = Object.entries(INVOICE_NATURE_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const purposeOptions = Object.entries(INVOICE_PURPOSE_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const taxStatusOptions = Object.entries(INVOICE_TAX_STATUS_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 加载发票列表(服务端分页);翻页/筛选/刷新都会重新加载,选中状态随之清空避免跨页残留 */
const loadList = async () => {
  selectedRowKeys.value = [];
  loading.value = true;
  try {
    const query: InvoiceListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    if (filterNature.value !== undefined) {
      query.invoice_nature = filterNature.value;
    }
    if (filterPurpose.value !== undefined) {
      query.invoice_purpose = filterPurpose.value;
    }
    if (filterTaxStatus.value !== undefined) {
      query.is_tax_filed = filterTaxStatus.value;
    }
    if (filterDateRange.value?.[0]) {
      query.start_date = filterDateRange.value[0];
    }
    if (filterDateRange.value?.[1]) {
      query.end_date = filterDateRange.value[1];
    }
    if (filterTag.value) {
      query.tag = filterTag.value;
    }
    const keyword = filterKeyword.value.trim();
    if (keyword) {
      query.keyword = keyword;
    }

    const res = await invoiceApi.list(query);
    records.value = res.datas.items || [];
    total.value = res.datas.total || 0;
  } catch {
    // 错误已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

/** 查询(重置页码) */
const handleSearch = () => {
  pageIndex.value = 1;
  loadList();
};

/** 重置筛选条件并刷新 */
const handleReset = () => {
  filterNature.value = undefined;
  filterPurpose.value = undefined;
  filterTaxStatus.value = undefined;
  filterKeyword.value = '';
  filterDateRange.value = undefined;
  pageIndex.value = 1;
  loadList();
};

const handlePageChange = (page: number, size: number) => {
  pageIndex.value = page;
  pageSize.value = size;
  loadList();
};

// ============ 识别弹窗 ============
const uploadOpen = ref(false);
const uploadMode = ref<'single' | 'batch'>('single');

const openUpload = (mode: 'single' | 'batch') => {
  uploadMode.value = mode;
  uploadOpen.value = true;
};

// ============ 详情抽屉 ============
const detailOpen = ref(false);
const detailId = ref('');

const openDetail = (record: Invoice) => {
  detailId.value = record.invoice_id;
  detailOpen.value = true;
};

/**
 * 批量报税/取消报税:前端预校验 → 二次确认 → 调接口 → 刷新列表
 * 服务端为整批校验(任一不符合条件整批拒绝),预校验可拦截无效请求
 * @param targetStatus 目标报税状态:1-取消报税,2-报税
 */
const handleTaxFile = (targetStatus: number) => {
  // 操作人自动取当前登录用户
  const userId = authStore.user?.user_id;
  if (!userId) {
    message.error('用户信息缺失,请重新登录后再试');
    return;
  }
  // 按选中 key 过滤出完整行数据,用于前端预校验
  const selectedRecords = records.value.filter((record) => selectedRowKeys.value.includes(record.invoice_id));
  const check = validateTaxSelection(selectedRecords, targetStatus);
  if (!check.valid) {
    message.warning(check.msg);
    return;
  }
  const isFiling = targetStatus === InvoiceTaxStatus.FILED;
  Modal.confirm({
    title: isFiling ? '确认批量报税？' : '确认取消报税？',
    content: isFiling
      ? `将对选中的 ${selectedRecords.length} 张发票标记为已报税,并记录报税时间与操作人。`
      : `将对选中的 ${selectedRecords.length} 张发票恢复为未报税,并清空其报税时间与操作人。`,
    okText: isFiling ? '报税' : '取消报税',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await invoiceApi.taxFile({
          invoice_ids: selectedRecords.map((record) => record.invoice_id),
          is_tax_filed: targetStatus,
          user_id: userId,
        });
        message.success(`${isFiling ? '报税' : '取消报税'}成功,共更新 ${res.datas.updated_count} 张发票`);
        clearSelection();
        loadList();
      } catch {
        // 失败已由全局拦截器提示(如整批不符合条件),关闭确认框由用户重新选择
      }
    },
  });
};

/** 开票日期仅展示日期部分 */
const formatDatePart = (date: string | null): string => {
  if (!date) return '-';
  return date.slice(0, 10);
};

/** 时间格式化为本地日期时间 */
const formatDateTime = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

onMounted(() => {
  loadList();
});
</script>

<style scoped lang="scss">
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

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
