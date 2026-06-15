<template>
  <a-card title="库存管理" :bordered="false">
    <template #extra>
      <a-space>
        <!-- 类型筛选 -->
        <a-select
          v-model:value="typeFilter"
          placeholder="筛选类型"
          style="width: 120px"
          @change="handleTypeFilterChange"
        >
          <a-select-option value="">全部</a-select-option>
          <a-select-option value="device">设备</a-select-option>
          <a-select-option value="common">普通物品</a-select-option>
        </a-select>

        <!-- 新建按钮 -->
        <a-button type="primary" @click="handleCreate">
          <template #icon>
            <PlusOutlined />
          </template>
          新建库存件
        </a-button>
      </a-space>
    </template>

    <a-table
      :columns="columns"
      :data-source="inventoryItems"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      row-key="itemId"
    >
      <template #bodyCell="{ column, record }">
        <!-- 类型列 -->
        <template v-if="column.key === 'type'">
          <a-tag :color="record.type === 'device' ? 'blue' : 'green'">
            {{ record.type === 'device' ? '设备' : '普通物品' }}
          </a-tag>
        </template>

        <!-- 关联产品列 -->
        <template v-else-if="column.key === 'productName'">
          {{ record.productName || '-' }}
        </template>

        <!-- 规格列 -->
        <template v-else-if="column.key === 'specifications'">
          <a-space v-if="record.specifications && Object.keys(record.specifications).length > 0" direction="vertical" :size="4">
            <a-tag
              v-for="(value, key) in record.specifications"
              :key="key"
              color="default"
            >
              {{ value }}
            </a-tag>
          </a-space>
          <span v-else>-</span>
        </template>

        <!-- 库存列 -->
        <template v-else-if="column.key === 'stock'">
          <span :style="{ color: isStockLow(record) ? '#ff4d4f' : 'inherit' }">
            {{ record.currentStock || 0 }}
            <template v-if="record.warnStock && record.warnStock > 0 && isStockLow(record)">
              (预警: {{ record.warnStock }})
            </template>
          </span>
        </template>

        <!-- 状态列 -->
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? '启用' : '禁用' }}
          </a-tag>
        </template>

        <!-- 创建时间列 -->
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>

        <!-- 操作列 -->
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
              @click="handleViewHistory(record)"
            >
              查看历史
            </a-button>

            <a-button
              type="link"
              size="small"
              @click="handleInventoryCheck(record)"
            >
              盘点
            </a-button>

            <a-button
              type="link"
              size="small"
              @click="handleToggleStatus(record)"
            >
              {{ record.status === 1 ? '禁用' : '启用' }}
            </a-button>

            <a-popconfirm
              title="确定要删除此库存件吗？"
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

    <!-- 库存件表单弹窗 -->
    <InventoryItemForm
      v-model:visible="formVisible"
      :item="currentItem"
      @success="handleFormSuccess"
    />

    <!-- 盘点弹窗 -->
    <a-modal
      v-model:open="checkModalVisible"
      title="库存盘点"
      :confirm-loading="checkLoading"
      @ok="handleInventoryCheckSubmit"
      @cancel="handleCheckModalCancel"
    >
      <a-form
        ref="checkFormRef"
        :model="checkForm"
        layout="vertical"
      >
        <a-form-item label="库存件名称">
          <a-input :value="currentCheckItem?.name" disabled />
        </a-form-item>

        <a-form-item label="当前库存">
          <a-input :value="currentCheckItem?.currentStock || 0" disabled />
        </a-form-item>

        <a-form-item
          label="实际数量"
          name="actualQuantity"
          :rules="[{ required: true, message: '请输入实际数量' }]"
        >
          <a-input-number
            v-model:value="checkForm.actualQuantity"
            :min="0"
            :precision="0"
            style="width: 100%"
            placeholder="请输入实际盘点的数量"
          />
        </a-form-item>

        <a-form-item label="备注" name="notes">
          <a-textarea
            v-model:value="checkForm.notes"
            :rows="4"
            placeholder="请输入盘点备注信息"
            :maxlength="500"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { inventoryApi } from '@/api/inventory';
import type { InventoryItem, ItemType } from '@/api/inventory';
import InventoryItemForm from '@/components/inventory/InventoryItemForm.vue';

// 表格列定义
const columns = [
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100
  },
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name'
  },
  {
    title: '代码',
    dataIndex: 'code',
    key: 'code'
  },
  {
    title: '关联产品',
    dataIndex: 'productName',
    key: 'productName'
  },
  {
    title: '规格',
    dataIndex: 'specifications',
    key: 'specifications',
    width: 150
  },
  {
    title: '库存',
    key: 'stock',
    width: 120
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
    width: 300
  }
];

// 状态管理
const loading = ref(false);
const inventoryItems = ref<InventoryItem[]>([]);
const formVisible = ref(false);
const currentItem = ref<InventoryItem | null>(null);
const typeFilter = ref<ItemType | ''>('');

// 盘点相关状态
const checkModalVisible = ref(false);
const checkLoading = ref(false);
const checkFormRef = ref();
const currentCheckItem = ref<InventoryItem | null>(null);
const checkForm = ref({
  actualQuantity: 0,
  notes: ''
});

// 判断库存是否过低
const isStockLow = (item: InventoryItem) => {
  if (!item.warnStock || !item.currentStock) return false;
  return item.currentStock <= item.warnStock;
};

// 加载库存列表
const loadInventoryItems = async () => {
  loading.value = true;
  try {
    const type = typeFilter.value || undefined;
    const response = await inventoryApi.getInventoryItems(type);

    if (response.result === 0) {
      // 模拟添加库存信息（实际项目中应该从API获取）
      inventoryItems.value = response.datas.map(item => ({
        ...item,
        currentStock: Math.floor(Math.random() * 100), // 模拟库存数量
        isWarning: false // 模拟预警状态
      }));
    } else {
      message.error(response.msg || '加载库存列表失败');
    }
  } catch (error) {
    console.error('加载库存列表失败:', error);
    message.error('加载库存列表失败');
  } finally {
    loading.value = false;
  }
};

// 类型筛选变化
const handleTypeFilterChange = () => {
  loadInventoryItems();
};

// 新建库存件
const handleCreate = () => {
  currentItem.value = null;
  formVisible.value = true;
};

// 编辑库存件
const handleEdit = (item: InventoryItem) => {
  currentItem.value = item;
  formVisible.value = true;
};

// 删除库存件
const handleDelete = async (item: InventoryItem) => {
  try {
    const response = await inventoryApi.deleteInventoryItem(item.itemId);
    if (response.result === 0) {
      message.success('删除成功');
      await loadInventoryItems();
    } else {
      message.error(response.msg || '删除失败');
    }
  } catch (error) {
    console.error('删除库存件失败:', error);
    message.error('删除库存件失败');
  }
};

// 切换状态
const handleToggleStatus = async (item: InventoryItem) => {
  const newStatus = item.status === 1 ? 2 : 1;
  const statusText = newStatus === 1 ? '启用' : '禁用';

  try {
    const response = await inventoryApi.updateInventoryItemStatus(item.itemId, newStatus);
    if (response.result === 0) {
      message.success(`${statusText}成功`);
      await loadInventoryItems();
    } else {
      message.error(response.msg || `${statusText}失败`);
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    message.error('更新状态失败');
  }
};

// 查看历史
const handleViewHistory = (item: InventoryItem) => {
  // TODO: Navigate to stock history view
  message.info(`查看库存件 "${item.name}" 的历史记录`);
};

// 库存盘点
const handleInventoryCheck = (item: InventoryItem) => {
  currentCheckItem.value = item;
  checkForm.value = {
    actualQuantity: item.currentStock || 0,
    notes: ''
  };
  checkModalVisible.value = true;
};

// 提交盘点
const handleInventoryCheckSubmit = async () => {
  if (!currentCheckItem.value) return;

  try {
    await checkFormRef.value?.validate();

    checkLoading.value = true;

    const response = await inventoryApi.inventoryCheck({
      itemId: currentCheckItem.value.itemId,
      actualQuantity: checkForm.value.actualQuantity,
      notes: checkForm.value.notes
    });

    if (response.result === 0) {
      message.success('盘点成功');
      checkModalVisible.value = false;
      await loadInventoryItems();
    } else {
      message.error(response.msg || '盘点失败');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      console.log('表单验证失败:', error);
    } else {
      console.error('盘点失败:', error);
      message.error('盘点失败');
    }
  } finally {
    checkLoading.value = false;
  }
};

// 取消盘点
const handleCheckModalCancel = () => {
  checkModalVisible.value = false;
  checkFormRef.value?.clearValidate();
};

// 表单提交成功回调
const handleFormSuccess = () => {
  formVisible.value = false;
  loadInventoryItems();
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
  loadInventoryItems();
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

:deep(.ant-space-item) {
  display: flex;
  align-items: center;
}
</style>
