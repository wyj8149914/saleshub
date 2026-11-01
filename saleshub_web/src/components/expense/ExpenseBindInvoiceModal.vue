<template>
  <a-modal
    :open="open"
    title="关联发票"
    :confirm-loading="loading"
    :mask-closable="false"
    width="720px"
    ok-text="确认关联"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-alert
      :type="expense?.invoice_id ? 'warning' : 'info'"
      show-icon
      class="bind-tip"
      :message="
        expense?.invoice_id
          ? `费用单 ${expense?.expense_no} 已关联发票 ${expense?.invoice_number || '-'},确认后将直接换绑(旧发票自动释放)`
          : `为费用单 ${expense?.expense_no || ''} 关联发票,可选择已有未绑定发票或上传识别新发票`
      "
    />

    <!-- 双页签:选择已有发票 / 上传识别,两条路径产物统一为下方发票摘要 -->
    <a-tabs v-model:activeKey="activeTab">
      <!-- 页签1:从未绑定费用单的实开发票中选择(接口不分页,前端本地过滤) -->
      <a-tab-pane key="select" tab="选择已有发票">
        <a-input-search v-model:value="keyword" placeholder="搜索发票号码/销售方" class="list-search" allow-clear />
        <a-table
          :columns="selectColumns"
          :data-source="filteredInvoices"
          :loading="unboundLoading"
          :row-selection="rowSelection"
          :pagination="false"
          size="small"
          bordered
          :row-key="(record: Invoice) => record.invoice_id"
          :scroll="{ x: 'max-content', y: 280 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'sub_type_desc'">
              {{ record.sub_type_desc || '-' }}
            </template>

            <template v-else-if="column.key === 'total_amount'">
              <span class="amount-text">{{ record.total_amount ? `¥${record.total_amount}` : '-' }}</span>
            </template>

            <template v-else-if="column.key === 'invoice_date'">
              {{ formatDatePart(record.invoice_date) }}
            </template>

            <template v-else-if="column.key === 'seller_name'">
              {{ record.seller_name || '-' }}
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- 页签2:上传发票识别入库(性质固定实开,用途在识别弹窗内选择) -->
      <a-tab-pane key="upload" tab="上传识别">
        <a-button type="primary" @click="invoiceUploadOpen = true">
          <UploadOutlined />
          {{ invoice ? '重新上传识别' : '上传发票识别(单个)' }}
        </a-button>
        <!-- 单个发票识别弹窗(与发票列表的单个识别保持一致) -->
        <InvoiceUploadModal
          v-model:open="invoiceUploadOpen"
          mode="single"
          :fixed-nature="InvoiceNature.ACTUAL"
          @uploaded="handleInvoiceUploaded"
        />
      </a-tab-pane>
    </a-tabs>

    <!-- 选中/识别的发票摘要(两条路径共用) -->
    <a-descriptions v-if="invoice" :column="1" size="small" bordered class="invoice-summary">
      <a-descriptions-item label="发票号码">{{ invoice.invoice_number }}</a-descriptions-item>
      <a-descriptions-item label="发票类型">{{ invoice.sub_type_desc || '-' }}</a-descriptions-item>
      <a-descriptions-item label="价税合计">{{
        invoice.total_amount ? `¥${invoice.total_amount}` : '-'
      }}</a-descriptions-item>
      <a-descriptions-item v-if="invoice.is_duplicate" label="提示">
        <a-tag color="orange">该发票已入库,将直接选用</a-tag>
      </a-descriptions-item>
    </a-descriptions>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 支出费用单关联/换绑发票弹窗
 * 两条路径:1) 页签「选择已有发票」从 /saleshub/invoice/unboundList 未绑定实开发票中单选
 *          2) 页签「上传识别」走单个发票识别弹窗(上传 → /saleshub/invoice/upload 识别入库)
 * 任一路径产生的发票摘要确认后调 /saleshub/expense/bindInvoice 回填
 * 发票与费用单 1:1,已被其他费用单关联时后端拒绝并提示;重复关联同一发票幂等成功
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import { expenseApi } from '@/api/expense';
import { invoiceApi } from '@/api/invoice';
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal.vue';
import { InvoiceNature } from '@/types/invoice';
import type { Invoice, InvoiceBrief, InvoiceUploadResult } from '@/types/invoice';
import type { Expense } from '@/types/expense';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 目标费用单列表行(含已绑发票信息) */
  expense: Expense | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
/** 当前页签:select-选择已有发票,upload-上传识别 */
const activeTab = ref<'select' | 'upload'>('select');

// ============ 选择已有发票 ============
/** 未绑定费用单的实开发票列表(打开弹窗时加载) */
const unboundInvoices = ref<Invoice[]>([]);
const unboundLoading = ref(false);
/** 列表关键字过滤(接口不分页无筛选参数,前端本地模糊匹配发票号码/销售方) */
const keyword = ref('');
/** 已选发票 ID(表格单选) */
const selectedInvoiceId = ref<string>('');

/** 「选择已有发票」表格列 */
const selectColumns = [
  { title: '发票号码', dataIndex: 'invoice_number', key: 'invoice_number', width: 200, fixed: 'left' as const },
  { title: '发票类型', dataIndex: 'sub_type_desc', key: 'sub_type_desc', width: 160, ellipsis: true },
  { title: '价税合计', dataIndex: 'total_amount', key: 'total_amount', width: 100, align: 'right' as const },
  { title: '开票日期', dataIndex: 'invoice_date', key: 'invoice_date', width: 110 },
  { title: '销售方', dataIndex: 'seller_name', key: 'seller_name', ellipsis: true },
];

/** 按关键字过滤后的可选发票列表 */
const filteredInvoices = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) {
    return unboundInvoices.value;
  }
  return unboundInvoices.value.filter(
    (inv) => inv.invoice_number.toLowerCase().includes(kw) || (inv.seller_name ?? '').toLowerCase().includes(kw),
  );
});

/** 表格单选配置:radio 行选,选中即写入发票摘要 */
const rowSelection = computed(() => ({
  type: 'radio' as const,
  selectedRowKeys: selectedInvoiceId.value ? [selectedInvoiceId.value] : [],
  onChange: (keys: (string | number)[]) => {
    const invoiceId = String(keys[0] ?? '');
    selectedInvoiceId.value = invoiceId;
    const record = unboundInvoices.value.find((inv) => inv.invoice_id === invoiceId);
    if (record) {
      // 列表选择的发票映射为统一摘要结构(新选用,非重复入库)
      invoice.value = {
        invoice_id: record.invoice_id,
        invoice_number: record.invoice_number,
        sub_type_desc: record.sub_type_desc,
        total_amount: record.total_amount,
        is_duplicate: false,
      };
    }
  },
}));

/** 加载未绑定费用单的实开发票列表 */
const loadUnboundInvoices = async () => {
  unboundLoading.value = true;
  try {
    const res = await invoiceApi.listUnbound();
    unboundInvoices.value = res.datas.items || [];
  } catch {
    // 错误已由全局拦截器提示
  } finally {
    unboundLoading.value = false;
  }
};

// ============ 上传识别 ============
/** 单个发票识别弹窗可见性 */
const invoiceUploadOpen = ref(false);
/** 待关联发票摘要(两条路径共用) */
const invoice = ref<InvoiceBrief | null>(null);

/**
 * 单个发票识别完成回调:选取新入库/已存在的第一张作为待关联发票
 * 发票性质固定实开,发票用途在识别弹窗内选择
 */
const handleInvoiceUploaded = (result: InvoiceUploadResult) => {
  const brief = result.invoices[0] || result.existed[0];
  if (!brief) {
    return;
  }
  invoice.value = brief;
  message.success(brief.is_duplicate ? '发票已存在,已选用该发票' : '发票识别入库成功');
};

// ============ 确认关联 ============
/** 确认关联:调 bindInvoice 回填发票 ID */
const handleSubmit = async () => {
  if (!props.expense) return;
  if (!invoice.value) {
    message.warning('请先选择已有发票或上传发票识别');
    return;
  }
  loading.value = true;
  try {
    const res = await expenseApi.bindInvoice({
      expense_id: props.expense.expense_id,
      invoice_id: invoice.value.invoice_id,
    });
    if (res.result === 0) {
      message.success('发票关联成功');
      emit('update:open', false);
      emit('success');
    }
  } catch {
    // 失败已由全局拦截器提示(如该发票已被其他费用单关联)
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

/** 开票日期仅展示日期部分 */
const formatDatePart = (date: string | null): string => {
  if (!date) return '-';
  return date.slice(0, 10);
};

watch(
  () => props.open,
  (val) => {
    if (val) {
      // 打开时重置选择状态并加载未绑定发票列表
      activeTab.value = 'select';
      keyword.value = '';
      selectedInvoiceId.value = '';
      invoice.value = null;
      invoiceUploadOpen.value = false;
      loadUnboundInvoices();
    }
  },
);
</script>

<style scoped lang="scss">
.bind-tip {
  margin-bottom: 16px;
}

/* 未绑定发票列表搜索框 */
.list-search {
  margin-bottom: 12px;
}

.invoice-summary {
  margin-top: 16px;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
