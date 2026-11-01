<template>
  <div class="page">
    <div class="page-head">
      <!-- 第一行:搜索条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-select
          v-model:value="filterNature"
          placeholder="发票性质"
          allow-clear
          style="width: 120px"
          :options="natureOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterPurpose"
          placeholder="发票用途"
          allow-clear
          style="width: 130px"
          :options="purposeOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterTaxStatus"
          placeholder="报税状态"
          allow-clear
          style="width: 110px"
          :options="taxStatusOptions"
          @change="handleSearch"
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
      </a-space>

      <!-- 第二行:批量报税/取消报税(需先勾选发票)与单个/批量识别 -->
      <a-space :size="12" wrap class="action-buttons">
        <a-button type="primary" @click="openUpload('single')">
          <template #icon><FileAddOutlined /></template>
          单个识别
        </a-button>
        <a-button type="primary" @click="openUpload('batch')">
          <template #icon><FolderAddOutlined /></template>
          批量识别
        </a-button>
        <a-button type="primary" :disabled="!hasSelection" @click="handleTaxFile(InvoiceTaxStatus.FILED)">
          <template #icon><CheckCircleOutlined /></template>
          批量报税
        </a-button>
        <a-button type="primary" :disabled="!hasSelection" @click="handleTaxFile(InvoiceTaxStatus.NOT_FILED)">
          <template #icon><CloseCircleOutlined /></template>
          取消报税
        </a-button>

        <!-- 勾选发票后的合计提示 -->
        <span v-if="hasSelection" class="selected-summary">
          已选 {{ selectedRowKeys.length }} 张,价税合计:{{ selectedTotalAmount }}
        </span>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
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
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'sub_type_desc'">
            {{ record.sub_type_desc || '-' }}
          </template>

          <template v-else-if="column.key === 'invoice_date'">
            {{ formatDatePart(record.invoice_date) }}
          </template>

          <template v-else-if="column.key === 'total_amount'">
            <span class="amount-text">¥{{ record.total_amount ?? '-' }}</span>
          </template>

          <template v-else-if="column.key === 'tax_amount'">
            <span class="amount-text">¥{{ record.tax_amount ?? '-' }}</span>
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
            <!-- 删除:行内二次确认;已被费用单关联的发票由服务端拒绝并提示 -->
            <a-popconfirm
              title="确定要删除此发票吗？"
              ok-text="删除"
              cancel-text="取消"
              placement="left"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

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
import { CheckCircleOutlined, CloseCircleOutlined, FileAddOutlined, FolderAddOutlined } from '@ant-design/icons-vue';
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
import { sumInvoiceTotalAmount, validateTaxSelection } from '@/utils/invoice';
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal.vue';
import InvoiceDetailDrawer from '@/components/invoice/InvoiceDetailDrawer.vue';

const columns = [
  { title: '发票号码', dataIndex: 'invoice_number', key: 'invoice_number', width: 200, fixed: 'left' as const },
  { title: '销售方', dataIndex: 'seller_name', key: 'seller_name', ellipsis: true },
  { title: '价税合计', dataIndex: 'total_amount', key: 'total_amount', align: 'right' as const },
  { title: '报税状态', dataIndex: 'is_tax_filed', key: 'is_tax_filed' },
  { title: '性质', dataIndex: 'invoice_nature', key: 'invoice_nature' },
  { title: '用途', dataIndex: 'invoice_purpose', key: 'invoice_purpose' },
  { title: '发票类型', dataIndex: 'sub_type_desc', key: 'sub_type_desc' },
  { title: '开票日期', dataIndex: 'invoice_date', key: 'invoice_date' },
  { title: '报税时间', dataIndex: 'tax_filed_time', key: 'tax_filed_time' },
  { title: '购买方', dataIndex: 'buyer_name', key: 'buyer_name', ellipsis: true },
  { title: '税额', dataIndex: 'tax_amount', key: 'tax_amount', align: 'right' as const },
  { title: '入库时间', dataIndex: 'create_time', key: 'create_time' },
  { title: '操作', key: 'action', fixed: 'right' as const },
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

/** 是否已勾选发票,控制批量报税/取消报税按钮可用状态 */
const hasSelection = computed(() => selectedRowKeys.value.length > 0);

/** 行多选配置:勾选变化时同步 selectedRowKeys */
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys as string[];
  },
}));

/** 已勾选的完整行数据(用于批量报税预校验与金额汇总) */
const selectedRecords = computed(() =>
  records.value.filter((record) => selectedRowKeys.value.includes(record.invoice_id)),
);

/** 已勾选发票的价税合计总额(空值不计入,两位小数) */
const selectedTotalAmount = computed(() => sumInvoiceTotalAmount(selectedRecords.value));

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
 * 删除发票:popconfirm 二次确认 → 调接口 → 成功后刷新列表
 * 若当前页删至最后一条且不在第一页,自动回退一页,避免看到空页
 */
const handleDelete = async (record: Invoice) => {
  try {
    await invoiceApi.delete(record.invoice_id);
    message.success('删除成功');
    if (records.value.length === 1 && pageIndex.value > 1) {
      pageIndex.value -= 1;
    }
    loadList();
  } catch {
    // 错误已由全局拦截器提示(如发票已被费用单关联)
  }
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
  // 已勾选行数据用于前端预校验(与服务端整批校验规则一致)
  const recordsToTax = selectedRecords.value;
  const check = validateTaxSelection(recordsToTax, targetStatus);
  if (!check.valid) {
    message.warning(check.msg);
    return;
  }
  const isFiling = targetStatus === InvoiceTaxStatus.FILED;
  Modal.confirm({
    title: isFiling ? '确认批量报税？' : '确认取消报税？',
    content: isFiling
      ? `将对选中的 ${recordsToTax.length} 张发票标记为已报税,价税合计 ${sumInvoiceTotalAmount(recordsToTax)} 元,并记录报税时间与操作人。`
      : `将对选中的 ${recordsToTax.length} 张发票恢复为未报税,价税合计 ${sumInvoiceTotalAmount(recordsToTax)} 元,并清空其报税时间与操作人。`,
    okText: isFiling ? '报税' : '取消报税',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await invoiceApi.taxFile({
          invoice_ids: recordsToTax.map((record) => record.invoice_id),
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

/* 头部两行布局:第一行筛选条件,第二行操作按钮 */
.page-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* 已选发票合计提示:金额加粗等宽 */
.selected-summary {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.action-buttons {
  margin-top: 12px;
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
</style>
