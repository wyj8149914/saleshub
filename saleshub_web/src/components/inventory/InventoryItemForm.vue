<template>
  <a-modal
    :visible="visible"
    :title="isEditMode ? '编辑库存件' : '创建库存件'"
    :confirm-loading="loading"
    @ok="handleSubmit"
    @cancel="handleCancel"
    width="600px"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item label="类型" name="type">
        <a-radio-group v-model:value="form.type" button-style="solid">
          <a-radio-button value="device">设备</a-radio-button>
          <a-radio-button value="common">普通物品</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="名称" name="name">
        <a-input
          v-model:value="form.name"
          placeholder="请输入名称"
          :maxlength="100"
          show-count
        />
      </a-form-item>

      <a-form-item label="代码" name="code">
        <a-input
          v-model:value="form.code"
          placeholder="请输入代码"
          :maxlength="50"
          show-count
        />
      </a-form-item>

      <!-- 设备类型：显示产品选择 -->
      <a-form-item
        v-if="form.type === 'device'"
        label="关联产品"
        name="productId"
      >
        <a-select
          v-model:value="form.productId"
          placeholder="请选择关联产品"
          :loading="productsLoading"
          :options="productOptions"
          show-search
          :filter-option="filterProductOption"
        />
      </a-form-item>

      <!-- 普通物品类型：显示规格编辑器 -->
      <a-form-item
        v-if="form.type === 'common'"
        label="规格"
        name="specifications"
      >
        <spec-editor v-model:value="form.specifications" />
      </a-form-item>

      <a-form-item label="预警库存" name="warnStock">
        <a-input-number
          v-model:value="form.warnStock"
          placeholder="请输入预警库存"
          :min="0"
          :precision="0"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '@/api/inventory';
import type { InventoryItem, Product, ItemType } from '@/api/inventory';
import SpecEditor from './SpecEditor.vue';

// Props 定义
interface Props {
  visible: boolean;
  item?: InventoryItem | null;
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
const productsLoading = ref(false);

// 产品列表
const products = ref<Product[]>([]);

// 表单数据
interface FormData {
  type: ItemType;
  name: string;
  code: string;
  productId?: string;
  specifications?: string[];
  warnStock?: number;
}

const form = ref<FormData>({
  type: 'device',
  name: '',
  code: '',
  productId: undefined,
  specifications: [],
  warnStock: undefined
});

// 表单验证规则
const rules = computed(() => ({
  type: [
    { required: true, message: '请选择类型', trigger: 'change' }
  ],
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { max: 100, message: '名称最多100个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入代码', trigger: 'blur' },
    { max: 50, message: '代码最多50个字符', trigger: 'blur' }
  ],
  productId: [
    {
      required: form.value.type === 'device',
      message: '请选择关联产品',
      trigger: 'change'
    }
  ]
}));

// 计算是否为编辑模式
const isEditMode = computed(() => !!props.item);

// 产品选项
const productOptions = computed(() =>
  products.value.map(product => ({
    label: `${product.name} (${product.code})`,
    value: product.productId
  }))
);

// 产品搜索过滤
const filterProductOption = (input: string, option: { label: string; value: string }) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

// 加载产品列表
const loadProducts = async () => {
  productsLoading.value = true;
  try {
    const response = await inventoryApi.getProducts();
    if (response.result === 0) {
      products.value = response.datas.filter(p => p.status === 1); // 只显示启用的产品
    } else {
      message.error(response.msg || '加载产品列表失败');
    }
  } catch (error) {
    console.error('加载产品列表失败:', error);
    message.error('加载产品列表失败');
  } finally {
    productsLoading.value = false;
  }
};

// 重置表单
const resetForm = () => {
  form.value = {
    type: 'device',
    name: '',
    code: '',
    productId: undefined,
    specifications: [],
    warnStock: undefined
  };
  formRef.value?.clearValidate();
};

// 填充表单数据（编辑模式）
const populateForm = () => {
  if (props.item) {
    form.value = {
      type: props.item.type,
      name: props.item.name,
      code: props.item.code,
      productId: props.item.productId,
      specifications: props.item.specifications ? Object.values(props.item.specifications) : [],
      warnStock: props.item.warnStock
    };
  }
};

// 监听 visible 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Modal 打开时
    if (props.item) {
      populateForm();
    } else {
      resetForm();
    }
    // 加载产品列表
    loadProducts();
  } else {
    // Modal 关闭时重置表单
    resetForm();
  }
});

// 监听类型变化，清空相关字段
watch(() => form.value.type, (newType) => {
  if (newType === 'device') {
    form.value.specifications = [];
  } else {
    form.value.productId = undefined;
  }
  // 重新验证
  formRef.value?.validateFields(['productId']);
});

// 提交表单
const handleSubmit = async () => {
  try {
    // 验证表单
    await formRef.value?.validate();

    loading.value = true;

    // 准备提交数据
    const submitData: any = {
      type: form.value.type,
      name: form.value.name,
      code: form.value.code,
      warnStock: form.value.warnStock || 0
    };

    if (form.value.type === 'device') {
      submitData.productId = form.value.productId;
    } else {
      // 将规格数组转换为对象
      if (form.value.specifications && form.value.specifications.length > 0) {
        submitData.specifications = form.value.specifications.reduce((acc, spec, index) => {
          acc[`spec_${index}`] = spec;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    if (isEditMode.value) {
      // 编辑模式：更新库存件
      const response = await inventoryApi.updateInventoryItem(
        props.item!.itemId,
        submitData
      );

      if (response.result === 0) {
        message.success('库存件更新成功');
        emit('success');
        emit('update:visible', false);
      } else {
        message.error(response.msg || '库存件更新失败');
      }
    } else {
      // 创建模式：新建库存件
      const response = await inventoryApi.createInventoryItem(submitData);

      if (response.result === 0) {
        message.success('库存件创建成功');
        emit('success');
        emit('update:visible', false);
      } else {
        message.error(response.msg || '库存件创建失败');
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

// 组件挂载时加载产品列表
onMounted(() => {
  if (props.visible) {
    loadProducts();
  }
});
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

:deep(.ant-radio-group) {
  width: 100%;
}

:deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
}
</style>
