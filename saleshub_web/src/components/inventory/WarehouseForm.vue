<template>
  <!-- 仓库新建/编辑弹窗 -->
  <a-modal
    :open="visible"
    :title="isEditMode ? '编辑仓库' : '新建仓库'"
    :confirm-loading="loading"
    :width="520"
    :mask-closable="false"
    wrap-class-name="warehouse-form-modal"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="horizontal" class="warehouse-form" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
      <a-form-item label="仓库名称" name="name">
        <a-input v-model:value="form.name" placeholder="请输入仓库名称" :maxlength="100" show-count />
      </a-form-item>

      <a-form-item label="位置" name="location">
        <a-input v-model:value="form.location" placeholder="请输入位置（可选）" :maxlength="200" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * WarehouseForm — 仓库新建/编辑弹窗
 *
 * 职责：维护仓库名称、位置等基础信息。
 */
import { ref, reactive, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '@/api/inventory';
import type { Warehouse, WarehouseCreatePayload, WarehouseUpdatePayload } from '@/types/warehouse';

interface Props {
  /** 弹窗显隐，由父组件 v-model:visible 控制 */
  visible: boolean;
  /** 传入则为编辑模式；不传或为 null 则为新建 */
  warehouse?: Warehouse | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  /** 创建或更新成功后通知父组件刷新列表 */
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

/** Ant Design Form 实例，用于校验与清除错误状态 */
const formRef = ref();
/** 提交保存时的 loading，会禁用弹窗确认按钮 */
const loading = ref(false);

/** 表单数据模型 */
interface FormData {
  name: string;
  location: string;
}

const form = reactive<FormData>({
  name: '',
  location: '',
});

/** 表单校验规则 */
const rules = {
  name: [
    { required: true, message: '请输入仓库名称', trigger: 'blur' },
    { max: 100, message: '仓库名称最多 100 个字符', trigger: 'blur' },
  ],
  location: [{ max: 200, message: '位置最多 200 个字符', trigger: 'blur' }],
};

/** 是否编辑模式：由是否传入 warehouse 决定 */
const isEditMode = computed(() => !!props.warehouse);

/** 重置表单为新建默认值，并清除校验状态 */
function resetForm() {
  form.name = '';
  form.location = '';
  formRef.value?.clearValidate();
}

/** 编辑模式下，用 props.warehouse 回填表单 */
function populateForm() {
  if (props.warehouse) {
    form.name = props.warehouse.name || '';
    form.location = props.warehouse.location || '';
  }
}

/**
 * 监听弹窗显隐，负责表单初始化与清理
 * - 打开：编辑则回填，新建则重置
 * - 关闭：始终重置，避免下次打开残留数据
 */
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.warehouse) populateForm();
      else resetForm();
    } else {
      resetForm();
    }
  },
);

/**
 * 提交表单
 * 先校验，再按模式调用 createWarehouse / updateWarehouse，成功后通知父组件并关闭弹窗
 */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    if (isEditMode.value) {
      const payload: WarehouseUpdatePayload = {
        warehouse_id: props.warehouse!.warehouse_id,
        name: form.name,
        location: form.location || undefined,
      };
      await inventoryApi.updateWarehouse(payload);
      message.success('仓库更新成功');
    } else {
      const payload: WarehouseCreatePayload = {
        name: form.name,
        location: form.location || undefined,
      };
      await inventoryApi.createWarehouse(payload);
      message.success('仓库创建成功');
    }
    emit('success');
    emit('update:visible', false);
  } catch {
    // 业务错误由 request 拦截器统一弹窗
  } finally {
    loading.value = false;
  }
}

/** 取消编辑，关闭弹窗（不保存） */
function handleCancel() {
  emit('update:visible', false);
}
</script>

<style scoped>
.warehouse-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  font-weight: 500;
}

.warehouse-form :deep(.ant-input),
.warehouse-form :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
}

.warehouse-form :deep(.ant-input-affix-wrapper-focused),
.warehouse-form :deep(.ant-input:focus) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}
</style>
