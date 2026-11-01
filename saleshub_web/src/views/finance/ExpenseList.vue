<template>
  <div class="page">
    <div class="page-head">
      <!-- 第一行:筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-select
          v-model:value="filterExpenseType"
          placeholder="费用类型"
          allow-clear
          style="width: 130px"
          :options="expenseTypeOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterChannel"
          placeholder="采购渠道"
          allow-clear
          style="width: 110px"
          :options="channelOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterCategory"
          placeholder="支出分类"
          allow-clear
          style="width: 130px"
          :options="categoryOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterPaymentMethod"
          placeholder="付款方式"
          allow-clear
          style="width: 120px"
          :options="paymentMethodOptions"
          @change="handleSearch"
        />

        <a-range-picker v-model:value="filterDateRange" format="YYYY-MM-DD" value-format="YYYY-MM-DD" />

        <a-input
          v-model:value="filterKeyword"
          placeholder="费用单编号/收款方"
          style="width: 200px"
          allow-clear
          @search="handleSearch"
        />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <!-- 第二行:新建入口 -->
      <a-space :size="12" wrap class="action-buttons">
        <a-button type="primary" @click="openForm(null)">
          <template #icon><PlusOutlined /></template>
          新建费用单
        </a-button>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="{
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
          onChange: handlePageChange,
        }"
        bordered
        :row-key="(record: Expense) => record.expense_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'expense_title'">
            {{ record.expense_title || '-' }}
          </template>

          <template v-else-if="column.key === 'expense_type'">
            <a-tag :color="record.expense_type === ExpenseType.WITH_INVOICE ? 'blue' : 'purple'">
              {{ EXPENSE_TYPE_LABELS[record.expense_type] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'invoice_number'">
            <template v-if="record.invoice_number">
              <div>{{ record.invoice_number }}</div>
              <div v-if="record.invoice_total_amount" class="invoice-amount">¥{{ record.invoice_total_amount }}</div>
            </template>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'channel'">
            {{ record.channel != null ? EXPENSE_CHANNEL_LABELS[record.channel] || '-' : '-' }}
          </template>

          <template v-else-if="column.key === 'order_no'">
            {{ record.order_no || '-' }}
          </template>

          <template v-else-if="column.key === 'amount'">
            <span class="amount-text">¥{{ record.amount }}</span>
          </template>

          <template v-else-if="column.key === 'expense_date'">
            {{ formatDatePart(record.expense_date) }}
          </template>

          <template v-else-if="column.key === 'category'">
            <a-tag v-if="record.category != null" color="cyan">
              {{ EXPENSE_CATEGORY_LABELS[record.category] || '-' }}
            </a-tag>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'payee'">
            {{ record.payee || '-' }}
          </template>

          <template v-else-if="column.key === 'payment_method'">
            {{ record.payment_method != null ? EXPENSE_PAYMENT_METHOD_LABELS[record.payment_method] || '-' : '-' }}
          </template>

          <template v-else-if="column.key === 'remark'">
            {{ record.remark || '-' }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button type="link" size="small" @click="openForm(record)">修改</a-button>
              <!-- 关联发票:仅类型1-有发票采购展示(已绑定时为换绑) -->
              <a-button
                v-if="record.expense_type === ExpenseType.WITH_INVOICE"
                type="link"
                size="small"
                @click="openBind(record)"
              >
                {{ record.invoice_id ? '换绑发票' : '关联发票' }}
              </a-button>
              <!-- 删除:行内二次确认;作废后关联发票自动释放 -->
              <a-popconfirm
                title="确定要删除此费用单吗？"
                ok-text="删除"
                cancel-text="取消"
                placement="left"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/修改弹窗 -->
    <ExpenseFormModal v-model:open="formOpen" :expense="formTarget" @success="loadList" />

    <!-- 详情抽屉 -->
    <ExpenseDetailDrawer v-model:open="detailOpen" :expense-id="detailId" />

    <!-- 关联/换绑发票弹窗 -->
    <ExpenseBindInvoiceModal v-model:open="bindOpen" :expense="bindTarget" @success="loadList" />
  </div>
</template>

<script setup lang="ts">
/**
 * 支出费用列表页:分页查询 + 筛选(费用类型/渠道/分类/付款方式/日期区间/关键字)
 * 入口:新建/修改(弹窗)、详情(抽屉)、类型1费用单关联/换绑发票(弹窗)
 */
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { expenseApi } from '@/api/expense';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CHANNEL_LABELS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_TYPE_LABELS,
  ExpenseType,
} from '@/types/expense';
import type { Expense, ExpenseListQuery } from '@/types/expense';
import ExpenseFormModal from '@/components/expense/ExpenseFormModal.vue';
import ExpenseDetailDrawer from '@/components/expense/ExpenseDetailDrawer.vue';
import ExpenseBindInvoiceModal from '@/components/expense/ExpenseBindInvoiceModal.vue';

const columns = [
  { title: '费用单编号', dataIndex: 'expense_no', key: 'expense_no', width: 110, fixed: 'left' as const },
  { title: '费用名称', dataIndex: 'expense_title', key: 'expense_title', width: 140, ellipsis: true },
  { title: '费用类型', dataIndex: 'expense_type', key: 'expense_type', width: 110 },
  { title: '发票号码', key: 'invoice_number', width: 190 },
  { title: '渠道', key: 'channel', width: 80 },
  { title: '电商订单号', key: 'order_no', width: 130, ellipsis: true },
  { title: '支出金额', dataIndex: 'amount', key: 'amount', width: 110, align: 'right' as const },
  { title: '支出日期', key: 'expense_date', width: 110 },
  { title: '支出分类', key: 'category', width: 110 },
  { title: '收款方', key: 'payee', width: 140, ellipsis: true },
  { title: '付款方式', key: 'payment_method', width: 100 },
  { title: '备注', key: 'remark', ellipsis: true },
  { title: '操作', key: 'action', width: 230, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<Expense[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
const filterExpenseType = ref<number | undefined>(undefined);
const filterChannel = ref<number | undefined>(undefined);
const filterCategory = ref<number | undefined>(undefined);
const filterPaymentMethod = ref<number | undefined>(undefined);
const filterKeyword = ref('');
/** 支出日期区间,[start_date, end_date],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();

// 筛选下拉选项(由枚举 label map 生成)
const expenseTypeOptions = Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const channelOptions = Object.entries(EXPENSE_CHANNEL_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const categoryOptions = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const paymentMethodOptions = Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 加载费用单列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const query: ExpenseListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    if (filterExpenseType.value !== undefined) {
      query.expense_type = filterExpenseType.value;
    }
    if (filterChannel.value !== undefined) {
      query.channel = filterChannel.value;
    }
    if (filterCategory.value !== undefined) {
      query.category = filterCategory.value;
    }
    if (filterPaymentMethod.value !== undefined) {
      query.payment_method = filterPaymentMethod.value;
    }
    if (filterDateRange.value?.[0]) {
      query.start_date = filterDateRange.value[0];
    }
    if (filterDateRange.value?.[1]) {
      query.end_date = filterDateRange.value[1];
    }
    const keyword = filterKeyword.value.trim();
    if (keyword) {
      query.keyword = keyword;
    }

    const res = await expenseApi.list(query);
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
  filterExpenseType.value = undefined;
  filterChannel.value = undefined;
  filterCategory.value = undefined;
  filterPaymentMethod.value = undefined;
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

// ============ 新建/修改弹窗 ============
const formOpen = ref(false);
/** 编辑目标列表行,null 表示新建 */
const formTarget = ref<Expense | null>(null);

const openForm = (record: Expense | null) => {
  formTarget.value = record;
  formOpen.value = true;
};

// ============ 详情抽屉 ============
const detailOpen = ref(false);
const detailId = ref('');

const openDetail = (record: Expense) => {
  detailId.value = record.expense_id;
  detailOpen.value = true;
};

// ============ 关联/换绑发票弹窗 ============
const bindOpen = ref(false);
const bindTarget = ref<Expense | null>(null);

const openBind = (record: Expense) => {
  bindTarget.value = record;
  bindOpen.value = true;
};

/**
 * 删除费用单:popconfirm 二次确认 → 调接口 → 成功后刷新列表
 * 若当前页删至最后一条且不在第一页,自动回退一页,避免看到空页
 */
const handleDelete = async (record: Expense) => {
  try {
    await expenseApi.delete(record.expense_id);
    message.success('删除成功');
    if (records.value.length === 1 && pageIndex.value > 1) {
      pageIndex.value -= 1;
    }
    loadList();
  } catch {
    // 错误已由全局拦截器提示
  }
};

/** 支出日期仅展示日期部分 */
const formatDatePart = (date: string | null): string => {
  if (!date) return '-';
  return date.slice(0, 10);
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

.action-buttons {
  margin-top: 12px;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 发票号码下方的价税合计小字 */
.invoice-amount {
  font-size: 12px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
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
