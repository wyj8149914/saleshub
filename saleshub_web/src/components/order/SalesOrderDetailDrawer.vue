<template>
  <a-drawer
    :open="open"
    title="销售订单详情"
    width="720px"
    :mask-closable="!loading"
    @close="emit('update:open', false)"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="订单编号" :span="1">{{ detail.order_no }}</a-descriptions-item>
          <a-descriptions-item label="订单名称" :span="1">{{ detail.order_title }}</a-descriptions-item>

          <a-descriptions-item label="客户名称">{{ detail.customer_name }}</a-descriptions-item>
          <a-descriptions-item label="客户联系方式">{{ detail.customer_phone }}</a-descriptions-item>

          <a-descriptions-item label="收货地址" :span="2">{{ detail.address || '-' }}</a-descriptions-item>

          <a-descriptions-item label="订单金额">
            <span class="amount-text">¥{{ detail.amount }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="已收金额">
            <span class="amount-text">¥{{ detail.received_amount }}</span>
          </a-descriptions-item>

          <a-descriptions-item label="收款状态">
            <a-tag :color="PAY_STATUS_COLORS[detail.pay_status] || 'default'">
              {{ PAY_STATUS_LABELS[detail.pay_status] || '-' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="订单状态">
            <a-tag :color="ORDER_STATUS_COLORS[detail.order_status] || 'default'">
              {{ ORDER_STATUS_LABELS[detail.order_status] || '-' }}
            </a-tag>
          </a-descriptions-item>

          <a-descriptions-item label="交货日期">{{ formatDatePart(detail.delivery_date) }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ detail.create_time }}</a-descriptions-item>

          <a-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>

          <a-descriptions-item label="合同文件" :span="2">
            <a v-if="detail.contract_url" :href="detail.contract_url" target="_blank" rel="noopener">
              查看合同文件
            </a>
            <span v-else>-</span>
          </a-descriptions-item>
        </a-descriptions>
      </template>
      <a-empty v-else-if="!loading" description="订单不存在或已删除" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 销售订单详情抽屉
 * 打开时按 order_id 拉取详情(含合同文件预览地址 contract_url),错误由全局拦截器提示
 */
import { ref, watch } from 'vue';
import { salesOrderApi } from '@/api/salesOrder';
import {
  ORDER_STATUS_LABELS,
  PAY_STATUS_LABELS,
} from '@/types/salesOrder';
import type { SalesOrderDetail } from '@/types/salesOrder';

/** 订单状态标签颜色 */
const ORDER_STATUS_COLORS: Record<number, string> = {
  1: 'blue',
  2: 'cyan',
  3: 'success',
  4: 'error',
};

/** 收款状态标签颜色 */
const PAY_STATUS_COLORS: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'success',
};

interface Props {
  /** 抽屉可见性(v-model:open) */
  open: boolean;
  /** 目标订单 ID */
  orderId: string;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const detail = ref<SalesOrderDetail | null>(null);

/** 加载订单详情 */
const loadDetail = async () => {
  loading.value = true;
  try {
    const res = await salesOrderApi.detail(props.orderId);
    detail.value = res.datas;
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
};

/** 交货日期仅展示日期部分 */
const formatDatePart = (date: string): string => {
  return date ? date.slice(0, 10) : '-';
};

watch(
  () => [props.open, props.orderId],
  ([open]) => {
    if (open && props.orderId) {
      detail.value = null;
      loadDetail();
    }
  },
);
</script>

<style scoped lang="scss">
.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
