<template>
  <a-modal
    :open="open"
    title="待办延期"
    :confirm-loading="loading"
    :mask-closable="false"
    width="520px"
    ok-text="提交"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="emit('update:open', false)"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="当前截止日期">
        <span class="deadline-text">{{ todo?.deadline || '-' }}</span>
      </a-form-item>

      <a-form-item
        label="延期后截止日期"
        name="new_deadline"
        :rules="[{ required: true, message: '请选择延期后截止日期' }]"
      >
        <a-date-picker
          v-model:value="form.new_deadline"
          placeholder="请选择延期后截止日期"
          style="width: 100%"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDeadline"
          :allow-clear="false"
        />
      </a-form-item>

      <a-form-item label="延期原因" name="reason" :rules="reasonRules">
        <a-textarea
          v-model:value="form.reason"
          placeholder="请输入延期原因（2~200 字符）"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 待办延期弹窗
 * 新截止日期必须晚于当前截止日期(前端禁选,后端二次校验)
 * 操作人取当前登录用户,提交后事务内更新截止日期并写入延期记录
 */
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { todoApi } from '@/api/todo';
import { useAuthStore } from '@/stores/auth';
import type { Todo } from '@/types/todo';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 延期目标待办 */
  todo: Todo | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

const formRef = ref();
const loading = ref(false);
const form = ref({
  new_deadline: '' as string,
  reason: '',
});

/** 延期原因校验:2~200 字符 */
const reasonRules = [
  { required: true, message: '请输入延期原因' },
  { min: 2, message: '延期原因至少 2 个字符' },
];

/** 禁选当前截止日期及之前的日期 */
const disabledDeadline = (current: dayjs.Dayjs) => {
  if (!props.todo?.deadline) return false;
  return dayjs(current).isBefore(props.todo.deadline, 'day') || dayjs(current).isSame(props.todo.deadline, 'day');
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const operatorId = authStore.user?.user_id;
  if (!operatorId || !props.todo) {
    message.error('用户信息缺失,请重新登录后再试');
    return;
  }

  loading.value = true;
  try {
    const res = await todoApi.postpone({
      todo_id: props.todo.todo_id,
      new_deadline: form.value.new_deadline,
      reason: form.value.reason.trim(),
      operator_id: operatorId,
    });
    if (res.result === 0) {
      message.success('延期成功');
      emit('update:open', false);
      emit('success');
    }
  } catch {
    // 失败已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

// 每次打开时重置表单
watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = { new_deadline: '', reason: '' };
      formRef.value?.clearValidate();
    }
  },
);
</script>

<style scoped lang="scss">
.deadline-text {
  color: #52525b;
  font-weight: 500;
}
</style>
