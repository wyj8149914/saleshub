<template>
  <a-modal :open="open" title="关联发票" :confirm-loading="loading" :mask-closable="false" width="520px" ok-text="确认关联"
    cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-alert :type="expense?.invoice_id ? 'warning' : 'info'" show-icon class="bind-tip" :message="expense?.invoice_id
      ? `费用单 ${expense?.expense_no} 已关联发票 ${expense?.invoice_number || '-'},上传新发票确认后将直接换绑(旧发票自动释放)`
      : `为费用单 ${expense?.expense_no || ''} 上传发票并识别入库后完成关联`
      " />

    <!-- 上传入口:复用单个发票识别弹窗,性质固定实开,用途在弹窗内选择 -->
    <a-button type="primary" @click="invoiceUploadOpen = true">
      <UploadOutlined />
      {{ invoice ? '重新上传识别' : '上传发票识别(单个)' }}
    </a-button>

    <!-- 识别结果摘要 -->
    <a-descriptions v-if="invoice" :column="1" size="small" bordered class="invoice-summary">
      <a-descriptions-item label="发票号码">{{ invoice.invoice_number }}</a-descriptions-item>
      <a-descriptions-item label="发票类型">{{ invoice.sub_type_desc || '-' }}</a-descriptions-item>
      <a-descriptions-item label="价税合计">{{ invoice.total_amount ? `¥${invoice.total_amount}` : '-'
      }}</a-descriptions-item>
      <a-descriptions-item v-if="invoice.is_duplicate" label="提示">
        <a-tag color="orange">该发票已入库,将直接选用</a-tag>
      </a-descriptions-item>
    </a-descriptions>

    <!-- 单个发票识别弹窗(与发票列表的单个识别保持一致) -->
    <InvoiceUploadModal v-model:open="invoiceUploadOpen" mode="single" :fixed-nature="InvoiceNature.ACTUAL"
      @uploaded="handleInvoiceUploaded" />
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 支出费用单关联/换绑发票弹窗
 * 流程:单个发票识别弹窗(上传 → /saleshub/invoice/upload 识别入库) → 确认后调 /saleshub/expense/bindInvoice 回填
 * 发票与费用单 1:1,已被其他费用单关联时后端拒绝并提示;重复关联同一发票幂等成功
 */
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import { expenseApi } from '@/api/expense';
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal.vue';
import { InvoiceNature } from '@/types/invoice';
import type { InvoiceBrief, InvoiceUploadResult } from '@/types/invoice';
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
/** 单个发票识别弹窗可见性 */
const invoiceUploadOpen = ref(false);
/** 识别入库后的发票摘要 */
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

/** 确认关联:调 bindInvoice 回填发票 ID */
const handleSubmit = async () => {
  if (!props.expense) return;
  if (!invoice.value) {
    message.warning('请先上传发票并完成识别');
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

watch(
  () => props.open,
  (val) => {
    if (val) {
      invoice.value = null;
      invoiceUploadOpen.value = false;
    }
  },
);
</script>

<style scoped lang="scss">
.bind-tip {
  margin-bottom: 16px;
}

.invoice-summary {
  margin-top: 16px;
}
</style>
