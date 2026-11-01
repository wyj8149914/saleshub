<template>
  <a-modal
    :open="open"
    title="变更订单状态"
    :confirm-loading="loading"
    :mask-closable="false"
    width="440px"
    ok-text="确认变更"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-alert
      message="已取消为终态,变更后不可再修改订单状态"
      type="warning"
      show-icon
      class="status-tip"
    />

    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="目标状态" name="order_status" :rules="[{ required: true, message: '请选择目标状态' }]">
        <a-select v-model:value="form.order_status" :options="statusOptions" placeholder="请选择目标状态" />
      </a-form-item>

      <!-- 选择与当前相同的状态时提示幂等 -->
      <a-alert
        v-if="form.order_status === order?.order_status"
        message="目标状态与当前状态相同,确认后将直接返回成功"
        type="info"
        show-icon
        class="status-tip"
      />
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 销售订单状态变更弹窗
 * 1-待交货/2-已交货/3-已完成 可自由设置;4-已取消为终态(选定时确认弹窗二次提示)
 * 同状态提交为幂等操作直接成功;失败提示由全局拦截器统一处理
 */
import { ref, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { salesOrderApi } from '@/api/salesOrder';
import { ORDER_STATUS_LABELS, OrderStatus } from '@/types/salesOrder';
import type { SalesOrder } from '@/types/salesOrder';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 目标订单(列表行,含当前订单状态) */
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
const form = ref<{ order_status?: number }>({ order_status: undefined });

/** 目标状态下拉选项(1/2/3/4 全量,已取消由二次确认兜底) */
const statusOptions = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 提交:选「已取消」终态时二次确认,其余直接调 updateStatus */
const handleSubmit = async () => {
  if (!props.order) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const targetStatus = form.value.order_status!;
  const doUpdate = async () => {
    loading.value = true;
    try {
      await salesOrderApi.updateStatus({
        order_id: props.order!.order_id,
        order_status: targetStatus,
      });
      message.success('订单状态变更成功');
      emit('update:open', false);
      emit('success');
    } catch {
      // 失败已由全局拦截器提示
    } finally {
      loading.value = false;
    }
  };

  if (targetStatus === OrderStatus.CANCELLED) {
    // 已取消为终态:二次确认避免误操作
    Modal.confirm({
      title: '确认取消该订单？',
      content: '已取消为终态,取消后订单状态不可再变更,且无法继续收款。',
      okText: '确认取消订单',
      okButtonProps: { danger: true },
      cancelText: '再想想',
      onOk: doUpdate,
    });
    return;
  }
  doUpdate();
};

const handleCancel = () => {
  emit('update:open', false);
};

// 打开弹窗时清空选择并清除校验状态
watch(
  () => props.open,
  (val) => {
    if (!val) return;
    form.value = { order_status: undefined };
    formRef.value?.clearValidate();
  },
);
</script>

<style scoped lang="scss">
.status-tip {
  margin-bottom: 16px;
}
</style>
