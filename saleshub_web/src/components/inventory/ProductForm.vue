<template>
  <a-modal
    :visible="visible"
    :title="isEditMode ? '编辑产品' : '创建产品'"
    :confirm-loading="loading"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item label="产品名称" name="name">
        <a-input
          v-model:value="form.name"
          placeholder="请输入产品名称"
          :maxlength="100"
          show-count
        />
      </a-form-item>

      <a-form-item label="产品代码" name="code">
        <a-input
          v-model:value="form.code"
          placeholder="请输入产品代码"
          :maxlength="50"
          show-count
        />
      </a-form-item>

      <a-form-item label="产品描述" name="description">
        <a-textarea
          v-model:value="form.description"
          placeholder="请输入产品描述"
          :rows="4"
          :maxlength="500"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '@/api/inventory';
import type { Product } from '@/api/inventory';

// Props 定义
interface Props {
  visible: boolean;
  product?: Product | null;
}

const props = defineProps<Props>();

// Emits 定义
interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

// 表单引用
const formRef = ref();

// 加载状态
const loading = ref(false);

// 表单数据
const form = ref({
  name: '',
  code: '',
  description: ''
});

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入产品名称', trigger: 'blur' },
    { max: 100, message: '产品名称最多100个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入产品代码', trigger: 'blur' },
    { max: 50, message: '产品代码最多50个字符', trigger: 'blur' }
  ],
  description: [
    { max: 500, message: '产品描述最多500个字符', trigger: 'blur' }
  ]
};

// 计算是否为编辑模式
const isEditMode = computed(() => !!props.product);

// 重置表单
const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    description: ''
  };
  formRef.value?.clearValidate();
};

// 填充表单数据（编辑模式）
const populateForm = () => {
  if (props.product) {
    form.value = {
      name: props.product.name || '',
      code: props.product.code || '',
      description: props.product.description || ''
    };
  }
};

// 监听 visible 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Modal 打开时
    if (props.product) {
      populateForm();
    } else {
      resetForm();
    }
  } else {
    // Modal 关闭时重置表单
    resetForm();
  }
});

// 提交表单
const handleSubmit = async () => {
  try {
    // 验证表单
    await formRef.value?.validate();

    loading.value = true;

    if (isEditMode.value) {
      // 编辑模式：更新产品
      const response = await inventoryApi.updateProduct(
        props.product!.productId,
        {
          name: form.value.name,
          code: form.value.code,
          description: form.value.description
        }
      );

      if (response.result === 0) {
        message.success('产品更新成功');
        emit('success');
        emit('update:visible', false);
      } else {
        message.error(response.msg || '产品更新失败');
      }
    } else {
      // 创建模式：新建产品
      const response = await inventoryApi.createProduct({
        name: form.value.name,
        code: form.value.code,
        description: form.value.description
      });

      if (response.result === 0) {
        message.success('产品创建成功');
        emit('success');
        emit('update:visible', false);
      } else {
        message.error(response.msg || '产品创建失败');
      }
    }
  } catch (error) {
    // 表单验证失败或API调用失败
    if (error && typeof error === 'object' && 'errorFields' in error) {
      // 表单验证失败，不显示消息（ant-design-vue会显示错误）
      console.log('表单验证失败:', error);
    } else {
      // API调用失败
      console.error('提交失败:', error);
      message.error('操作失败，请稍后重试');
    }
  } finally {
    loading.value = false;
  }
};

// 取消操作
const handleCancel = () => {
  emit('update:visible', false);
};
</script>

<style scoped lang="scss">
:deep(.ant-modal) {
  width: 600px;
}

:deep(.ant-form-item) {
  margin-bottom: 24px;
}

:deep(.ant-input-textarea-show-count::after) {
  float: right;
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
