<template>
  <a-card title="出库操作" :bordered="false">
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-form-item label="产品" name="productId">
        <a-select
          v-model:value="form.productId"
          placeholder="请选择产品"
          show-search
          :filter-option="filterProductOption"
          :loading="productsLoading"
          :options="productOptions"
          @change="handleProductChange"
        />
      </a-form-item>

      <a-form-item label="设备件" name="itemId">
        <a-select
          v-model:value="form.itemId"
          placeholder="请先选择产品"
          show-search
          :filter-option="filterItemOption"
          :loading="itemsLoading"
          :disabled="!form.productId"
          :options="itemOptions"
        />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="数量" name="quantity">
            <a-input-number
              v-model:value="form.quantity"
              placeholder="请输入数量"
              :min="1"
              :precision="0"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="出库日期" name="date">
            <a-date-picker
              v-model:value="form.date"
              placeholder="请选择出库日期"
              style="width: 100%"
              :format="'YYYY-MM-DD'"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注" name="remark">
        <a-textarea
          v-model:value="form.remark"
          placeholder="请输入备注"
          :rows="4"
          :maxlength="500"
          show-count
        />
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="loading">
            提交出库
          </a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { inventoryApi } from '@/api/inventory';
import type { Product, InventoryItem } from '@/api/inventory';

// 表单引用
const formRef = ref();

// 加载状态
const loading = ref(false);
const productsLoading = ref(false);
const itemsLoading = ref(false);

// 产品列表
const products = ref<Product[]>([]);

// 设备件列表
const deviceItems = ref<InventoryItem[]>([]);

// 表单数据接口
interface FormData {
  productId: string;
  itemId: string;
  quantity: number;
  date: Dayjs;
  remark?: string;
}

// 表单数据
const form = ref<FormData>({
  productId: '',
  itemId: '',
  quantity: 1,
  date: dayjs(),
  remark: ''
});

// 表单验证规则
const rules = computed(() => ({
  productId: [
    { required: true, message: '请选择产品', trigger: 'change' }
  ],
  itemId: [
    { required: true, message: '请选择设备件', trigger: 'change' }
  ],
  quantity: [
    { required: true, message: '请输入数量', trigger: 'blur' },
    { type: 'number', min: 1, message: '数量必须大于0', trigger: 'blur' },
    {
      validator: (_rule: any, value: number) => {
        if (!value || !form.value.itemId) return Promise.resolve();

        const selectedItem = deviceItems.value.find(item => item.itemId === form.value.itemId);
        if (selectedItem && selectedItem.currentStock !== undefined && value > selectedItem.currentStock) {
          return Promise.reject(`出库数量不能超过当前库存 (${selectedItem.currentStock})`);
        }
        return Promise.resolve();
      },
      trigger: 'blur'
    }
  ],
  date: [
    { required: true, message: '请选择出库日期', trigger: 'change' }
  ]
}));

// 产品选项
const productOptions = computed(() =>
  products.value
    .filter(product => product.status === 1) // 只显示启用的产品
    .map(product => ({
      label: `${product.name} (${product.code})`,
      value: product.productId
    }))
);

// 设备件选项
const itemOptions = computed(() =>
  deviceItems.value
    .filter(item => item.status === 1) // 只显示启用的设备件
    .map(item => ({
      label: `${item.name} (${item.code}) - 库存: ${item.currentStock ?? 0}`,
      value: item.itemId
    }))
);

// 产品搜索过滤
const filterProductOption = (input: string, option: { label: string; value: string }) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

// 设备件搜索过滤
const filterItemOption = (input: string, option: { label: string; value: string }) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

// 加载产品列表
const loadProducts = async () => {
  productsLoading.value = true;
  try {
    const response = await inventoryApi.getProducts();
    if (response.result === 0) {
      products.value = response.datas;
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

// 处理产品变更
const handleProductChange = async (productId: string) => {
  // 清空设备件选择
  form.value.itemId = '';
  deviceItems.value = [];

  if (!productId) return;

  // 加载该产品的设备件
  itemsLoading.value = true;
  try {
    const response = await inventoryApi.getInventoryItems('device' as any, productId);
    if (response.result === 0) {
      deviceItems.value = response.datas;
    } else {
      message.error(response.msg || '加载设备件列表失败');
    }
  } catch (error) {
    console.error('加载设备件列表失败:', error);
    message.error('加载设备件列表失败');
  } finally {
    itemsLoading.value = false;
  }
};

// 提交表单
const handleSubmit = async () => {
  try {
    loading.value = true;

    // 准备提交数据
    const submitData = {
      itemId: form.value.itemId,
      quantity: form.value.quantity,
      notes: form.value.remark || undefined
    };

    const response = await inventoryApi.stockOut(submitData);

    if (response.result === 0) {
      message.success('出库操作成功');
      handleReset();
      // 重新加载设备件列表以更新库存显示
      if (form.value.productId) {
        await handleProductChange(form.value.productId);
      }
    } else {
      message.error(response.msg || '出库操作失败');
    }
  } catch (error) {
    console.error('提交失败:', error);
    message.error('操作失败，请稍后重试');
  } finally {
    loading.value = false;
  }
};

// 重置表单
const handleReset = () => {
  form.value = {
    productId: '',
    itemId: '',
    quantity: 1,
    date: dayjs(),
    remark: ''
  };
  deviceItems.value = [];
  formRef.value?.clearValidate();
};

// 组件挂载时加载数据
onMounted(() => {
  loadProducts();
});
</script>

<style scoped lang="scss">
:deep(.ant-card) {
  max-width: 800px;
  margin: 0 auto;

  .ant-card-head-title {
    font-weight: 600;
  }
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
