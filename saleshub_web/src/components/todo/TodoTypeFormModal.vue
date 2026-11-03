<template>
  <a-modal
    :open="open"
    title="新建待办类型"
    :confirm-loading="loading"
    :mask-closable="false"
    width="460px"
    ok-text="提交"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="emit('update:open', false)"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="类型名称" name="type_name" :rules="[{ required: true, message: '请输入类型名称' }]">
        <a-input v-model:value="form.type_name" placeholder="请输入类型名称（全局唯一）" :maxlength="50" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 新建待办类型弹窗
 * 类型名称全局唯一,重名时后端返回「类型名称已存在」(由全局拦截器提示)
 */
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { todoTypeApi } from '@/api/todo';
import { useAuthStore } from '@/stores/auth';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
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
const form = ref({ type_name: '' });

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const userId = authStore.user?.user_id;
  if (!userId) {
    message.error('用户信息缺失,请重新登录后再试');
    return;
  }

  loading.value = true;
  try {
    const res = await todoTypeApi.create({
      user_id: userId,
      type_name: form.value.type_name.trim(),
    });
    if (res.result === 0) {
      message.success('创建成功');
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
      form.value.type_name = '';
      formRef.value?.clearValidate();
    }
  },
);
</script>
