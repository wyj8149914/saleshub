<template>
  <a-modal
    :open="open"
    :title="isEdit ? '修改用户' : '新建用户'"
    :confirm-loading="loading"
    :mask-closable="false"
    ok-text="提交"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <!-- 用户名:唯一标识,仅新建时可填,修改不允许(与后端一致) -->
      <a-form-item
        label="用户名"
        name="username"
        :rules="[{ required: true, message: '请输入用户名' }, { max: 50, message: '用户名最长50字符' }]"
      >
        <a-input v-model:value="form.username" placeholder="请输入登录用户名" :disabled="isEdit" />
      </a-form-item>

      <!-- 密码:仅新建时填写,强度校验与后端一致 -->
      <a-form-item v-if="!isEdit" label="密码" name="password" :rules="[{ validator: validatePasswordStrength }]">
        <a-input-password v-model:value="form.password" placeholder="至少8位,含大写/小写/数字/特殊符号至少三种" />
      </a-form-item>

      <a-form-item
        label="姓名"
        name="name"
        :rules="[{ required: true, message: '请输入姓名' }, { max: 100, message: '姓名最长100字符' }]"
      >
        <a-input v-model:value="form.name" placeholder="请输入姓名/昵称" />
      </a-form-item>

      <a-form-item label="手机号" name="phone" :rules="[{ max: 20, message: '手机号最长20字符' }]">
        <a-input v-model:value="form.phone" placeholder="请输入手机号(可选)" />
      </a-form-item>

      <a-form-item label="角色" name="role" :rules="[{ required: true, message: '请选择角色' }]">
        <a-select v-model:value="form.role" :options="roleOptions" placeholder="请选择角色" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 新建/修改用户弹窗(props.user 为 null 表示新建)
 * - 新建:username/name/password 必填,密码强度校验与后端一致
 * - 修改:仅更新 name(必填)/phone/role,username 与 password 不可改
 * 失败提示由全局拦截器统一处理
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { userApi } from '@/api/user';
import { USER_ROLE_LABELS } from '@/types/user';
import type { UserListItem } from '@/types/user';
import type { UserRole } from '@/types/auth';
import { validatePasswordStrength } from '@/utils/user';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 编辑目标用户,null 表示新建 */
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

/** 表单数据(phone 用空串表示未填,提交时转 undefined 语义) */
const form = ref<{
  username: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
}>({
  username: '',
  password: '',
  name: '',
  phone: '',
  role: 'user',
});

/** 是否编辑模式 */
const isEdit = computed(() => !!props.user);

/** 角色下拉选项 */
const roleOptions = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({
  label,
  value,
}));

/** 重置表单:编辑时回填目标用户,新建时清空并恢复默认值 */
const resetForm = () => {
  form.value = {
    username: props.user?.username ?? '',
    password: '',
    name: props.user?.name ?? '',
    phone: props.user?.phone ?? '',
    role: props.user?.role ?? 'user',
  };
};

/** 提交:校验通过后按模式调用 create/update */
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    if (isEdit.value && props.user) {
      await userApi.updateUser({
        user_id: props.user.user_id,
        name: form.value.name,
        phone: form.value.phone || undefined,
        role: form.value.role,
      });
      message.success('用户修改成功');
    } else {
      await userApi.createUser({
        username: form.value.username,
        password: form.value.password,
        name: form.value.name,
        phone: form.value.phone || undefined,
        role: form.value.role,
      });
      message.success('用户创建成功');
    }
    emit('update:open', false);
    emit('success');
  } catch {
    // 失败已由全局拦截器提示(如用户名已存在)
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

// 打开弹窗时重置表单并清除校验状态
watch(
  () => props.open,
  (val) => {
    if (!val) return;
    resetForm();
    formRef.value?.clearValidate();
  },
);
</script>
