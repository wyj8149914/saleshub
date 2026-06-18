<template>
  <a-card title="库存历史" :bordered="false">
    <template #extra>
      <a-select v-model:value="selectedItemId" placeholder="选择零件" show-search :filter-option="filterItemOption"
        :loading="itemsLoading" :options="itemOptions" style="width: 300px" @change="handleItemChange" />
    </template>

    <a-table :columns="columns" :data-source="historyRecords" :loading="loading" :pagination="{ pageSize: 20 }"
      row-key="recordId">
      <template #bodyCell="{ column, record }">
        <!-- 类型列 -->
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">
            {{ getTypeText(record.type) }}
          </a-tag>
        </template>

        <!-- 数量列 -->
        <template v-else-if="column.key === 'quantity'">
          <span :style="{ color: record.type === 'in' ? '#52c41a' : '#ff4d4f', fontWeight: 500 }">
            {{ record.type === 'in' ? '+' : '-' }}{{ record.quantity }}
          </span>
        </template>

        <!-- 盘点差异列 -->
        <template v-else-if="column.key === 'checkDiff'">
          <span v-if="record.type === 'check' && record.checkDiff">
            {{ record.beforeQuantity }} → {{ record.afterQuantity }}
            <a-tag :color="record.checkDiff > 0 ? 'green' : record.checkDiff < 0 ? 'red' : 'default'"
              style="margin-left: 8px">
              {{ record.checkDiff > 0 ? '+' : '' }}{{ record.checkDiff }}
            </a-tag>
          </span>
          <span v-else>-</span>
        </template>

        <!-- 日期列 -->
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { message } from 'ant-design-vue';
  import { inventoryApi } from '@/api/inventory';
  import type { InventoryItem, StockRecord } from '@/api/inventory';

  // 扩展库存记录类型以支持盘点差异
  interface StockHistoryRecord extends StockRecord {
    itemName?: string;
    checkDiff?: number;
    beforeQuantity?: number;
    afterQuantity?: number;
  }

  // 表格列定义
  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100
    },
    {
      title: '零件名称',
      dataIndex: 'itemName',
      key: 'itemName'
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120
    },
    {
      title: '盘点差异',
      key: 'checkDiff',
      width: 180
    },
    {
      title: '日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes'
    }
  ];

  // 状态管理
  const loading = ref(false);
  const itemsLoading = ref(false);
  const inventoryItems = ref<InventoryItem[]>([]);
  const selectedItemId = ref<string>('');
  const historyRecords = ref<StockHistoryRecord[]>([]);

  // 零件选项
  const itemOptions = computed(() =>
    inventoryItems.value
      .filter(item => item.status === 1)
      .map(item => ({
        label: `${item.name} (${item.code})`,
        value: item.itemId
      }))
  );

  // 零件搜索过滤
  const filterItemOption = (input: string, option: { label: string; value: string }) => {
    return option.label.toLowerCase().includes(input.toLowerCase());
  };

  // 获取类型颜色
  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'in':
        return 'green';
      case 'out':
        return 'red';
      case 'check':
        return 'blue';
      default:
        return 'default';
    }
  };

  // 获取类型文本
  const getTypeText = (type: string): string => {
    switch (type) {
      case 'in':
        return '入库';
      case 'out':
        return '出库';
      case 'check':
        return '盘点';
      default:
        return '未知';
    }
  };

  // 格式化日期
  const formatDate = (date: Date | string): string => {
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

  // 加载零件列表
  const loadInventoryItems = async () => {
    itemsLoading.value = true;
    try {
      const response = await inventoryApi.getInventoryItems();
      if (response.result === 0) {
        inventoryItems.value = response.datas;
      } else {
        message.error(response.msg || '加载零件列表失败');
      }
    } catch (error) {
      console.error('加载零件列表失败:', error);
      message.error('加载零件列表失败');
    } finally {
      itemsLoading.value = false;
    }
  };

  // 加载库存历史记录
  const loadHistory = async (itemId: string) => {
    if (!itemId) {
      historyRecords.value = [];
      return;
    }

    loading.value = true;
    try {
      const response = await inventoryApi.getStockHistory(itemId);
      if (response.result === 0) {
        const item = inventoryItems.value.find(i => i.itemId === itemId);

        // 处理历史记录，添加零件名称
        historyRecords.value = response.datas.map((record: StockRecord) => ({
          ...record,
          itemName: item?.name || '-',
          // 盘点记录的模拟数据（实际应从API获取）
          checkDiff: record.type === 'check' ? (Math.random() > 0.5 ? Math.floor(Math.random() * 10) - 5 : 0) : undefined,
          beforeQuantity: record.type === 'check' ? Math.floor(Math.random() * 50) : undefined,
          afterQuantity: record.type === 'check' ? Math.floor(Math.random() * 50) : undefined
        }));
      } else {
        message.error(response.msg || '加载库存历史失败');
      }
    } catch (error) {
      console.error('加载库存历史失败:', error);
      message.error('加载库存历史失败');
    } finally {
      loading.value = false;
    }
  };

  // 处理零件选择变化
  const handleItemChange = (itemId: string) => {
    loadHistory(itemId);
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
    .ant-table-tbody>tr:hover {
      background-color: #fafafa;
    }
  }
</style>
