<template>
  <a-card title="产品管理" :bordered="false">
    <template #extra>
      <a-button type="primary" @click="handleCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新建产品
      </a-button>
    </template>

    <a-table
      :columns="columns"
      :data-source="products"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      row-key="productId"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? '启用' : '禁用' }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>

        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button
              type="link"
              size="small"
              @click="handleEdit(record)"
            >
              编辑
            </a-button>

            <a-button
              type="link"
              size="small"
              @click="handleViewParts(record)"
            >
              设备部件
            </a-button>

            <a-button
              type="link"
              size="small"
              @click="handleToggleStatus(record)"
            >
              {{ record.status === 1 ? '禁用' : '启用' }}
            </a-button>

            <a-popconfirm
              title="确定要删除此产品吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 产品表单弹窗 -->
    <ProductForm
      v-model:visible="formVisible"
      :product="currentProduct"
      @success="handleFormSuccess"
    />
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { inventoryApi } from '@/api/inventory';
import type { Product } from '@/api/inventory';
import ProductForm from '@/components/inventory/ProductForm.vue';

// 表格列定义
const columns = [
  {
    title: '产品名称',
    dataIndex: 'name',
    key: 'name'
  },
  {
    title: '产品代码',
    dataIndex: 'code',
    key: 'code'
  },
  {
    title: '产品描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180
  },
  {
    title: '操作',
    key: 'actions',
    width: 280
  }
];

// 状态管理
const loading = ref(false);
const products = ref<Product[]>([]);
const formVisible = ref(false);
const currentProduct = ref<Product | null>(null);

// 加载产品列表
const loadProducts = async () => {
  loading.value = true;
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
    loading.value = false;
  }
};

// 新建产品
const handleCreate = () => {
  currentProduct.value = null;
  formVisible.value = true;
};

// 编辑产品
const handleEdit = (product: Product) => {
  currentProduct.value = product;
  formVisible.value = true;
};

// 删除产品
const handleDelete = async (product: Product) => {
  try {
    const response = await inventoryApi.deleteProduct(product.productId);
    if (response.result === 0) {
      message.success('删除成功');
      await loadProducts();
    } else {
      message.error(response.msg || '删除失败');
    }
  } catch (error) {
    console.error('删除产品失败:', error);
    message.error('删除产品失败');
  }
};

// 切换状态
const handleToggleStatus = async (product: Product) => {
  const newStatus = product.status === 1 ? 2 : 1;
  const statusText = newStatus === 1 ? '启用' : '禁用';

  try {
    const response = await inventoryApi.updateProductStatus(product.productId, newStatus);
    if (response.result === 0) {
      message.success(`${statusText}成功`);
      await loadProducts();
    } else {
      message.error(response.msg || `${statusText}失败`);
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    message.error('更新状态失败');
  }
};

// 查看设备部件
const handleViewParts = (product: Product) => {
  // TODO: Navigate to device parts list for this product
  message.info(`查看产品 "${product.name}" 的设备部件`);
};

// 表单提交成功回调
const handleFormSuccess = () => {
  formVisible.value = false;
  loadProducts();
};

// 格式化日期
const formatDate = (date: Date | string) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 组件挂载时加载数据
onMounted(() => {
  loadProducts();
});
</script>

<style scoped lang="scss">
:deep(.ant-card) {
  .ant-card-head-title {
    font-weight: 600;
  }
}

:deep(.ant-table) {
  .ant-table-tbody > tr {
    cursor: pointer;
  }
}
</style>
