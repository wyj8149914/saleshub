<template>
  <a-card title="库存预警" :bordered="false">
    <template #extra>
      <a-button type="primary" @click="loadWarnings">
        <template #icon>
          <ReloadOutlined />
        </template>
        刷新
      </a-button>
    </template>

    <!-- 预警提示信息 -->
    <a-alert v-if="warnings.length > 0" message="库存预警提示" :description="`当前有 ${warnings.length} 个零件库存量低于预警阈值，请及时补货！`"
      type="warning" show-icon style="margin-bottom: 16px">
      <template #icon>
        <WarningOutlined />
      </template>
    </a-alert>

    <a-alert v-else message="暂无库存预警" description="所有零件库存量正常" type="success" show-icon style="margin-bottom: 16px" />

    <a-table :columns="columns" :data-source="warnings" :loading="loading" :pagination="{ pageSize: 10 }"
      row-key="itemId">
      <template #bodyCell="{ column, record }">
        <!-- 类型列 -->
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">
            {{ getTypeText(record.type) }}
          </a-tag>
        </template>

        <!-- 预警等级列 -->
        <template v-else-if="column.key === 'warningLevel'">
          <a-tag :color="record.warningLevel === 'critical' ? 'red' : 'orange'">
            {{ record.warningLevel === 'critical' ? '严重' : '低' }}
          </a-tag>
        </template>

        <!-- 库存状态列 -->
        <template v-else-if="column.key === 'stockStatus'">
          <div class="stock-status">
            <a-progress :percent="getStockPercent(record)"
              :status="getStockPercent(record) <= 20 ? 'exception' : 'normal'"
              :format="(percent: number) => `${record.currentQuantity} / ${record.threshold}`"
              :stroke-color="getStockPercent(record) <= 20 ? '#ff4d4f' : '#52c41a'" />
          </div>
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="handleStockIn(record)">
              补货
            </a-button>

            <a-button type="link" size="small" @click="handleViewHistory(record)">
              查看历史
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { message } from 'ant-design-vue';
  import { WarningOutlined, ReloadOutlined } from '@ant-design/icons-vue';
  import { inventoryApi } from '@/api/inventory';
  import type { InventoryWarning } from '@/api/inventory';
  import { ItemType } from '@/api/inventory';

  // 扩展 InventoryWarning 类型以包含 type 字段
  interface StockWarningItem extends InventoryWarning {
    type?: ItemType;
  }

  // 表格列定义
  const columns = [
    {
      title: '类型',
      key: 'type',
      width: 100
    },
    {
      title: '零件名称',
      dataIndex: 'itemName',
      key: 'itemName'
    },
    {
      title: '零件代码',
      key: 'code',
      width: 150
    },
    {
      title: '所属产品',
      key: 'productName',
      width: 150
    },
    {
      title: '预警等级',
      key: 'warningLevel',
      width: 100
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      width: 250
    },
    {
      title: '操作',
      key: 'actions',
      width: 150
    }
  ];

  // 状态管理
  const loading = ref(false);
  const warnings = ref<StockWarningItem[]>([]);

  // 获取类型颜色
  const getTypeColor = (type?: ItemType) => {
    switch (type) {
      case ItemType.DEVICE:
        return 'blue';
      case ItemType.COMMON:
        return 'green';
      default:
        return 'default';
    }
  };

  // 获取类型文本
  const getTypeText = (type?: ItemType) => {
    switch (type) {
      case ItemType.DEVICE:
        return '设备';
      case ItemType.COMMON:
        return '普通物品';
      default:
        return '-';
    }
  };

  // 计算库存百分比
  const getStockPercent = (item: InventoryWarning): number => {
    if (item.threshold <= 0) return 0;
    const percent = Math.round((item.currentQuantity / item.threshold) * 100);
    return Math.max(0, Math.min(100, percent));
  };

  // 加载库存预警列表
  const loadWarnings = async () => {
    loading.value = true;
    try {
      const response = await inventoryApi.getWarnings();
      if (response.result === 0) {
        // 扩展返回的数据以包含 type 字段（模拟数据，实际项目中应该从 API 返回）
        warnings.value = response.datas.map(item => ({
          ...item,
          type: Math.random() > 0.5 ? ItemType.DEVICE : ItemType.COMMON,
          code: `ITEM-${item.itemId.slice(-6).toUpperCase()}`,
          productName: `产品-${Math.floor(Math.random() * 100)}`
        } as StockWarningItem));
      } else {
        message.error(response.msg || '加载库存预警失败');
      }
    } catch (error) {
      console.error('加载库存预警失败:', error);
      message.error('加载库存预警失败');
    } finally {
      loading.value = false;
    }
  };

  // 补货操作
  const handleStockIn = (item: StockWarningItem) => {
    // TODO: Navigate to stock in page or open stock in modal
    message.info(`为零件 "${item.itemName}" 进行补货操作`);
  };

  // 查看历史
  const handleViewHistory = (item: StockWarningItem) => {
    // TODO: Navigate to stock history view
    message.info(`查看零件 "${item.itemName}" 的历史记录`);
  };

  // 组件挂载时加载数据
  onMounted(() => {
    loadWarnings();
  });
</script>

<style scoped lang="scss">
  :deep(.ant-card) {
    .ant-card-head-title {
      font-weight: 600;
    }
  }

  :deep(.ant-table) {
    .ant-table-tbody>tr {
      cursor: pointer;
    }
  }

  .stock-status {
    padding: 4px 0;
  }

  :deep(.ant-progress) {
    .ant-progress-text {
      font-size: 12px;
    }
  }
</style>
