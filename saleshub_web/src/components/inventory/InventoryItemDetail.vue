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
          <a-spin :spinning="stockLoading">
            <a-table :columns="distributionColumns" :data-source="distributionData" :pagination="false" size="small"
              bordered row-key="key">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'spec'">
                  <span class="spec-tag">{{ record.spec || '默认' }}</span>
                </template>
                <template v-if="column.key === 'warehouse_location'">
                  <span>{{ record.warehouse_location || '-' }}</span>
                </template>
              </template>
            </a-table>
          </a-spin>
        </div>

        <!-- 总库存 -->
        <div class="total-stock">
          总库存: <span class="total-num">{{ totalStock }}</span>
        </div>
      </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
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

const stockLoading = ref(false)
const specStockData = ref<Record<string, SpecWarehouseStock[]>>({})

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

// 库存分布表格列
const distributionColumns = [
  {
    title: '规格',
    key: 'spec',
    width: 120
  },
  {
    title: '仓库',
    dataIndex: 'warehouse_name',
    key: 'warehouse_name',
    width: 150
  },
  {
    title: '位置',
    key: 'warehouse_location',
    width: 120
  },
  {
    title: '库存',
    dataIndex: 'current_stock',
    key: 'current_stock',
    width: 80,
    align: 'center' as const
  }
]

// 计算总库存
const totalStock = computed(() => {
  if (!props.item?.specs) return 0
  return props.item.specs.reduce((sum, spec) => sum + (spec.current_stock || 0), 0)
})

// 计算分布表格数据
const distributionData = computed(() => {
  const data: Array<SpecWarehouseStock & { key: string; spec: string }> = []
  if (!props.item?.specs) return data

  for (const spec of props.item.specs) {
    const warehouseList = specStockData.value[spec.spec_id] || []
    if (warehouseList.length > 0) {
      for (const wh of warehouseList) {
        data.push({
          ...wh,
          key: `${spec.spec_id}-${wh.warehouse_id}`,
          spec: spec.spec || '默认'
        })
      }
    } else {
      // 即使没有仓库数据也显示规格行
      data.push({
        id: '',
        warehouse_id: '',
        warehouse_name: '-',
        warehouse_location: null,
        current_stock: 0,
        key: `${spec.spec_id}-empty`,
        spec: spec.spec || '默认'
      })
    }
  }
  return data
})

// 加载所有规格的仓库库存分布
const loadAllSpecWarehouseStock = async () => {
  if (!props.item?.specs?.length) return

  stockLoading.value = true
  try {
    const results = await Promise.all(
      props.item.specs.map(spec =>
        inventoryApi.listSpecWarehouseStock(spec.spec_id).then(res => ({
          spec_id: spec.spec_id,
          data: res.datas || []
        })).catch(() => ({
          spec_id: spec.spec_id,
          data: []
        }))
      )
    )

    const newData: Record<string, SpecWarehouseStock[]> = {}
    for (const result of results) {
      newData[result.spec_id] = result.data
    }
    specStockData.value = newData
  } catch (error) {
    console.error('加载库存分布失败:', error)
  } finally {
    stockLoading.value = false
  }
}

// 关闭弹窗
const handleClose = () => {
  emit('update:visible', false)
}

// 监听弹窗打开，加载数据
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.item) {
      specStockData.value = {}
      loadAllSpecWarehouseStock()
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

.spec-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #f4f4f5;
  border-radius: 4px;
  font-size: 13px;
  color: #52525b;
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
