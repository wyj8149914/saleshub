<template>
  <a-modal
    :open="open"
    :title="`修改密码 - ${user?.username || ''}`"
    :confirm-loading="loading"
    :mask-closable="false"
    width="480px"
    ok-text="确认修改"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="新密码" name="password" :rules="[{ validator: validatePasswordStrength }]">
        <a-input-password
          v-model:value="form.password"
          placeholder="至少8位,含大写/小写/数字/特殊符号至少三种"
        />
      </a-form-item>

      <a-form-item
        label="确认新密码"
        name="confirmPassword"
        :rules="[{ required: true, message: '请再次输入新密码' }, { validator: validateConfirm }]"
      >
        <a-input-password v-model:value="form.confirmPassword" placeholder="请再次输入新密码" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 修改用户密码弹窗
 * 密码强度校验与后端一致(至少8位且含大写/小写/数字/特殊符号至少三种)
 * 成功后用户需使用新密码重新登录,失败提示由全局拦截器统一处理
 */
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { userApi } from '@/api/user';
import type { UserListItem } from '@/types/user';
import { validatePasswordStrength } from '@/utils/user';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 目标用户 */
  user: UserListItem | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formRef = ref();
const loading = ref(false);
const form = ref({ password: '', confirmPassword: '' });

/** 两次输入一致性校验 */
const validateConfirm = (_rule: unknown, value: string) => {
  if (!value) {
    return Promise.resolve();
  }
  return value === form.value.password ? Promise.resolve() : Promise.reject('两次输入的密码不一致');
};

/** 提交:调 updateUserPassword 重置目标用户密码 */
const handleSubmit = async () => {
  if (!props.user) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    await userApi.updateUserPassword({
      user_id: props.user.user_id,
      password: form.value.password,
    });
    message.success('密码修改成功');
    emit('update:open', false);
    emit('success');
  } catch {
    // 失败已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

// 打开弹窗时清空表单并清除校验状态
watch(
  () => props.open,
  (val) => {
    if (!val) return;
    form.value = { password: '', confirmPassword: '' };
    formRef.value?.clearValidate();
  },
);
</script>
