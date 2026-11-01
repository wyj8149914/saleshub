<template>
  <a-modal
    :open="open"
    title="订单收款"
    :confirm-loading="loading"
    :mask-closable="false"
    width="480px"
    ok-text="确认收款"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <!-- 订单金额信息:未收金额 = 订单金额 - 已收金额 -->
    <a-descriptions :column="3" size="small" bordered class="receive-info">
      <a-descriptions-item label="订单金额">
        <span class="amount-text">¥{{ order?.amount ?? '-' }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="已收金额">
        <span class="amount-text">¥{{ order?.received_amount ?? '-' }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="未收金额">
        <span class="amount-text unreceived">¥{{ unreceivedAmount }}</span>
      </a-descriptions-item>
    </a-descriptions>

    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item
        label="本次收款金额"
        name="received_amount"
        :rules="[{ required: true, message: '请输入本次收款金额' }, { validator: validateAmount }]"
      >
        <a-input-number
          v-model:value="form.received_amount"
          placeholder="请输入本次收款金额"
          :min="0.01"
          :precision="2"
          :step="100"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 销售订单收款弹窗
 * 展示订单金额/已收/未收,输入本次收款金额后调 /saleshub/order/receive 累加
 * 前端预校验:金额 >0 且不大于未收金额(两位小数);服务端仍兜底校验(并发收款超额)
 * 失败提示由全局拦截器统一处理
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { salesOrderApi } from '@/api/salesOrder';
import type { SalesOrder } from '@/types/salesOrder';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 目标订单(列表行,含金额与已收金额) */
  order: SalesOrder | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formRef = ref();
const loading = ref(false);
const form = ref<{ received_amount?: number }>({ received_amount: undefined });

/** 未收金额(以分为单位计算避免浮点误差,两位小数展示) */
const unreceivedAmount = computed(() => {
  if (!props.order) return '-';
  const total = Math.round(Number(props.order.amount) * 100);
  const received = Math.round(Number(props.order.received_amount) * 100);
  return ((total - received) / 100).toFixed(2);
});

/** 金额校验:大于 0 且不大于未收金额 */
const validateAmount = (_rule: unknown, value?: number) => {
  if (value === undefined || value === null) {
    return Promise.resolve();
  }
  if (value <= 0) {
    return Promise.reject('收款金额必须大于0');
  }
  if (!props.order) {
    return Promise.resolve();
  }
  const unreceived =
    Math.round(Number(props.order.amount) * 100) - Math.round(Number(props.order.received_amount) * 100);
  if (Math.round(value * 100) > unreceived) {
    return Promise.reject('收款金额不能超过未收金额');
  }
  return Promise.resolve();
};

/** 提交:调 receive 登记收款,成功后提示累加后的已收金额 */
const handleSubmit = async () => {
  if (!props.order) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    const res = await salesOrderApi.receive({
      order_id: props.order.order_id,
      received_amount: form.value.received_amount!,
    });
    message.success(`收款成功,已收金额 ¥${res.datas.received_amount}`);
    emit('update:open', false);
    emit('success');
  } catch {
    // 失败已由全局拦截器提示(如收款超额、已取消订单)
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

// 打开弹窗时清空金额并清除校验状态
watch(
  () => props.open,
  (val) => {
    if (!val) return;
    form.value = { received_amount: undefined };
    formRef.value?.clearValidate();
  },
);
</script>

<style scoped lang="scss">
.receive-info {
  margin-bottom: 16px;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.unreceived {
  color: #dc2626;
}
</style>
