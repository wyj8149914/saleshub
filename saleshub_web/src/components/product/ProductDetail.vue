<template>
  <a-modal :open="visible" title="产品详情" :width="1000" :footer="null" :mask-closable="true" wrap-class-name="product-detail-modal" @cancel="handleClose">
    <a-spin :spinning="loading">
      <div v-if="detail" class="product-detail">
        <!-- 产品基本信息 -->
        <div class="info-card">
          <div class="info-header">
            <div class="info-title">{{ detail.product.name }}</div>
            <span class="info-code">{{ detail.product.code }}</span>
          </div>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="产品描述" :span="2">
              {{ detail.product.description || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="价格">
              <span v-if="detail.product.price !== null" class="info-price">¥{{ detail.product.price }}</span>
              <span v-else>-</span>
            </a-descriptions-item>
            <a-descriptions-item label="备注">
              {{ detail.product.remark || '-' }}
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <!-- 模块和零件表格 -->
        <div v-if="detail.mode !== 'none'" class="bom-section">
          <div class="section-title">BOM 清单</div>
          <table class="bom-table">
            <thead>
              <tr>
                <th class="col-product">产品</th>
                <th v-if="detail.mode === 'module'" class="col-module">模块</th>
                <th class="col-item">零件名称</th>
                <th class="col-code">零件编码</th>
                <th class="col-spec">规格</th>
                <th class="col-qty">数量</th>
                <th class="col-price">单价</th>
                <th class="col-stock">库存</th>
                <th class="col-remark">备注</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="detail.mode === 'module' && detail.modules">
                <template v-for="(module, mIndex) in detail.modules" :key="module.module_id">
                  <tr v-for="(item, iIndex) in module.items" :key="`${module.module_id}_${item.item_id}_${item.spec_id}`">
                    <td v-if="mIndex === 0 && iIndex === 0" :rowspan="totalRows" class="cell-product">
                      {{ detail.product.name }}
                    </td>
                    <td v-if="iIndex === 0" :rowspan="module.items.length" class="cell-module">
                      {{ module.name }}
                    </td>
                    <td class="cell-item">{{ item.item_name }}</td>
                    <td class="cell-code">{{ item.item_code }}</td>
                    <td class="cell-spec">{{ item.spec || '-' }}</td>
                    <td class="cell-qty">{{ item.quantity_per_product }}</td>
                    <td class="cell-price">
                      <span v-if="item.price !== null">¥{{ item.price }}</span>
                      <span v-else>-</span>
                    </td>
                    <td class="cell-stock">{{ item.current_stock ?? '-' }}</td>
                    <td class="cell-remark">{{ item.remark || '-' }}</td>
                  </tr>
                </template>
              </template>
              <template v-else-if="detail.mode === 'direct' && detail.items">
                <tr v-for="(item, index) in detail.items" :key="`${item.item_id}_${item.spec_id}`">
                  <td v-if="index === 0" :rowspan="detail.items.length" class="cell-product">
                    {{ detail.product.name }}
                  </td>
                  <td class="cell-item">{{ item.item_name }}</td>
                  <td class="cell-code">{{ item.item_code }}</td>
                  <td class="cell-spec">{{ item.spec || '-' }}</td>
                  <td class="cell-qty">{{ item.quantity_per_product }}</td>
                  <td class="cell-price">
                    <span v-if="item.price !== null">¥{{ item.price }}</span>
                    <span v-else>-</span>
                  </td>
                  <td class="cell-stock">{{ item.current_stock ?? '-' }}</td>
                  <td class="cell-remark">{{ item.remark || '-' }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <a-empty v-else description="暂未配置零件" />
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { inventoryApi } from '@/api/inventory';
import type { ProductDetailResponse } from '@/types/inventory';

interface Props {
  visible: boolean;
  productId: string | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
}

const emit = defineEmits<Emits>();

const loading = ref(false);
const detail = ref<ProductDetailResponse | null>(null);

const totalRows = computed(() => {
  if (!detail.value || detail.value.mode !== 'module' || !detail.value.modules) return 0;
  return detail.value.modules.reduce((sum, m) => sum + m.items.length, 0);
});

const loadDetail = async () => {
  if (!props.productId) return;
  loading.value = true;
  try {
    const res = await inventoryApi.getProductDetail(props.productId);
    detail.value = res.datas;
  } catch {
    // 错误由拦截器处理
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  emit('update:visible', false);
};

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.productId) {
      loadDetail();
    } else {
      detail.value = null;
    }
  },
);
</script>

<style scoped>
.product-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.info-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.info-title {
  font-size: 18px;
  font-weight: 600;
  color: #18181b;
}

.info-code {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  color: #52525b;
  background: #fff;
  padding: 2px 8px;
  border-radius: 4px;
}

.info-price {
  color: #dc2626;
  font-weight: 600;
}

.bom-section {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e4e7;
  overflow: hidden;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181b;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e4e4e7;
}

.bom-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.bom-table th {
  background: #f4f4f5;
  color: #52525b;
  font-weight: 600;
  padding: 10px 8px;
  text-align: center;
  border: 1px solid #000000;
}

.bom-table td {
  padding: 10px 8px;
  border: 1px solid #000000;
  vertical-align: middle;
}

.bom-table tr:hover td {
  background: #eff6ff;
}

.col-product,
.col-module {
  width: 100px;
  text-align: center;
  background: #fafafa;
  font-weight: 500;
  color: #18181b;
}

.col-item {
  min-width: 120px;
}

.col-code {
  width: 100px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  color: #52525b;
}

.col-spec {
  width: 120px;
  text-align: center;
}

.col-qty {
  width: 60px;
  text-align: center;
}

.col-price {
  width: 80px;
  text-align: right;
}

.col-stock {
  width: 60px;
  text-align: right;
}

.col-remark {
  min-width: 100px;
}

.cell-product,
.cell-module {
  background: #fafafa;
  font-weight: 500;
  color: #18181b;
  text-align: center;
  vertical-align: middle;
  border-right: 1px solid #e4e4e7;
}

.cell-item {
  text-align: center;
  font-weight: 500;
  color: #18181b;
}

.cell-code {
  text-align: center;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  color: #1f1f21;
}

.cell-spec {
  text-align: center;
  color: #1f1f21;
  font-style: italic;
}

.cell-qty {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.cell-price {
  text-align: center;
  color: #dc2626;
  font-weight: 500;
}

.cell-stock {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.cell-remark {
  color: #1f1f21;
}
</style>
