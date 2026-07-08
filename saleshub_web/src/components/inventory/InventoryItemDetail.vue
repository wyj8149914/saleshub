<template>
  <!-- 零件详情弹窗 -->
  <a-modal :open="visible" title="零件详情" :footer="null" :width="720" :mask-closable="true" wrap-class-name="item-detail-modal"
    @cancel="handleClose">
    <div v-if="item" class="detail-content">
        <!-- 基本信息 -->
        <div class="section">
          <div class="section-title">基本信息</div>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="零件名称">{{ item.name }}</a-descriptions-item>
            <a-descriptions-item label="编码">{{ item.code }}</a-descriptions-item>
            <a-descriptions-item label="零件类型">{{ item.type_full_name || item.type_name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="是否定制">{{ item.is_custom === 2 ? '是' : '否' }}</a-descriptions-item>
            <a-descriptions-item label="预警库存">{{ item.warn_stock }}</a-descriptions-item>
            <a-descriptions-item label="备注">{{ item.remark || '-' }}</a-descriptions-item>
          </a-descriptions>
        </div>

        <!-- 规格信息 -->
        <div class="section">
          <div class="section-title">规格信息</div>
          <a-table :columns="specColumns" :data-source="item.specs" :pagination="false" row-key="spec_id" size="small" bordered>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'spec'">
                <span>{{ record.spec || '默认' }}</span>
              </template>
              <template v-if="column.key === 'price'">
                <span v-if="record.price !== null && record.price !== undefined">¥{{ record.price }}</span>
                <span v-else class="text-muted">-</span>
              </template>
              <template v-if="column.key === 'current_stock'">
                <span class="stock-num" :class="{ 'text-danger': record.current_stock <= item.warn_stock }">
                  {{ record.current_stock }}
                </span>
              </template>
            </template>
          </a-table>
        </div>

        <!-- 库存分布 -->
        <div class="section">
          <div class="section-title">库存分布</div>
          <div v-for="spec in item.specs" :key="spec.spec_id" class="spec-distribution">
            <div class="spec-header" @click="toggleSpec(spec.spec_id)">
              <span class="spec-name">{{ spec.spec || '默认' }}</span>
              <span class="spec-total">总库存: {{ spec.current_stock }}</span>
              <DownOutlined :class="{ 'expanded': expandedSpecs[spec.spec_id] }" />
            </div>
            <div v-if="expandedSpecs[spec.spec_id]" class="warehouse-list">
              <a-spin :spinning="stockLoading[spec.spec_id]">
                <a-table v-if="specStockData[spec.spec_id]?.length" :columns="warehouseColumns"
                  :data-source="specStockData[spec.spec_id]" :pagination="false" size="small" bordered />
                <a-empty v-else description="暂无库存分布" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
              </a-spin>
            </div>
          </div>
        </div>

        <!-- 总库存 -->
        <div class="total-stock">
          总库存: <span class="total-num">{{ totalStock }}</span>
        </div>
      </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, watch, reactive } from 'vue'
import { Empty } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'
import { inventoryApi } from '@/api/inventory'
import type { InventoryItem } from '@/types/inventory'
import type { SpecWarehouseStock } from '@/types/warehouse'

interface Props {
  visible: boolean
  item: InventoryItem | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const emit = defineEmits<Emits>()

// 使用 reactive 对象而非 Set，因为 Vue 的响应式系统不会追踪 Set/Map 的变更
const expandedSpecs = reactive<Record<string, boolean>>({})

const specStockData = reactive<Record<string, SpecWarehouseStock[]>>({})
const stockLoading = reactive<Record<string, boolean>>({})

// 规格表格列
const specColumns = [
  {
    title: '规格名称',
    key: 'spec',
    dataIndex: 'spec',
    width: 150
  },
  {
    title: '价格',
    key: 'price',
    dataIndex: 'price',
    width: 120
  },
  {
    title: '当前库存',
    key: 'current_stock',
    dataIndex: 'current_stock',
    width: 100
  }
]

// 仓库库存分布表格列
const warehouseColumns = [
  {
    title: '仓库名称',
    dataIndex: 'warehouse_name',
    key: 'warehouse_name',
    width: 150
  },
  {
    title: '仓库位置',
    dataIndex: 'warehouse_location',
    key: 'warehouse_location',
    width: 150,
    customRender: ({ text }: { text: string | null }) => text || '-'
  },
  {
    title: '当前库存',
    dataIndex: 'current_stock',
    key: 'current_stock',
    width: 100
  }
]

// 计算总库存
const totalStock = computed(() => {
  if (!props.item?.specs) return 0
  return props.item.specs.reduce((sum, spec) => sum + (spec.current_stock || 0), 0)
})

// 切换规格展开/折叠
const toggleSpec = async (specId: string) => {
  if (expandedSpecs[specId]) {
    delete expandedSpecs[specId]
  } else {
    expandedSpecs[specId] = true
    // 如果还没有加载过该规格的仓库分布数据，则加载
    if (!specStockData[specId]) {
      await loadSpecWarehouseStock(specId)
    }
  }
}

// 加载规格在各仓库的库存分布
const loadSpecWarehouseStock = async (specId: string) => {
  stockLoading[specId] = true
  try {
    const res = await inventoryApi.listSpecWarehouseStock(specId)
    specStockData[specId] = (res.datas || res) as SpecWarehouseStock[]
  } catch (error) {
    console.error('加载规格仓库库存分布失败:', error)
    specStockData[specId] = []
  } finally {
    stockLoading[specId] = false
  }
}

// 关闭弹窗
const handleClose = () => {
  emit('update:visible', false)
}

// 监听弹窗关闭，清空数据
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      // 清空展开状态和缓存数据
      Object.keys(expandedSpecs).forEach(key => {
        delete expandedSpecs[key]
      })
      Object.keys(specStockData).forEach(key => {
        delete specStockData[key]
      })
      Object.keys(stockLoading).forEach(key => {
        delete stockLoading[key]
      })
    }
  }
)
</script>

<style scoped>
.detail-content {
  padding: 8px 0;
}

.section {
  margin-bottom: 20px;
}

.section:last-of-type {
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #18181b;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #2563eb;
}

.text-muted {
  color: #a1a1aa;
}

.text-danger {
  color: #ef4444;
  font-weight: 500;
}

.stock-num {
  font-weight: 500;
}

.spec-distribution {
  border: 1px solid #e4e4e7;
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.spec-distribution:last-child {
  margin-bottom: 0;
}

.spec-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #fafafa;
  cursor: pointer;
  transition: background-color 0.2s;
}

.spec-header:hover {
  background: #f4f4f5;
}

.spec-name {
  font-weight: 500;
  color: #18181b;
  margin-right: 12px;
}

.spec-total {
  font-size: 13px;
  color: #71717a;
  margin-right: auto;
}

.spec-header :deep(.anticon-down) {
  color: #a1a1aa;
  transition: transform 0.2s;
}

.spec-header :deep(.anticon-down.expanded) {
  transform: rotate(180deg);
}

.warehouse-list {
  padding: 12px;
  background: #fff;
  border-top: 1px solid #e4e4e7;
}

.total-stock {
  text-align: right;
  font-size: 14px;
  color: #52525b;
  padding: 12px 0;
  border-top: 1px solid #e4e4e7;
}

.total-num {
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
  margin-left: 4px;
}

/* 弹窗内表格样式 */
:deep(.ant-descriptions-item-label) {
  font-weight: 500;
  background-color: #fafafa;
}

:deep(.ant-table-small) {
  font-size: 13px;
}

:deep(.ant-table-small .ant-table-thead > tr > th) {
  padding: 8px 12px;
  background: #fafafa;
}

:deep(.ant-table-small .ant-table-tbody > tr > td) {
  padding: 8px 12px;
}
</style>
