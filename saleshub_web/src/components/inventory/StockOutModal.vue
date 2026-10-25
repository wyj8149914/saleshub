<template>
  <a-modal
    :open="visible"
    title="出库"
    :confirm-loading="loading"
    :mask-closable="false"
    width="1000px"
    ok-text="提交出库"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item>
        <a-radio-group v-model:value="mode" button-style="solid">
          <a-radio-button value="item">按零件出库</a-radio-button>
          <a-radio-button value="product">按产品出库</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 仓库选择（仅产品出库模式） -->
      <a-form-item
        v-if="mode === 'product'"
        label="仓库"
        name="warehouse_id"
        :rules="[{ required: true, message: '请选择仓库' }]"
      >
        <WarehouseSelect v-model="form.warehouse_id" @change="handleWarehouseChange" />
      </a-form-item>

      <!-- 按零件出库：自动分配仓库 -->
      <template v-if="mode === 'item'">
        <div class="batch-header">
          <span class="batch-label">出库明细{{ batchRows.length > 1 ? '（同一批次共用单号）' : '' }}</span>
          <a-button type="link" size="small" @click="addRow">
            <PlusOutlined />
            添加一行
          </a-button>
        </div>

        <div v-for="(row, idx) in batchRows" :key="idx" class="batch-row-wrapper">
          <div class="batch-row">
            <a-select
              class="row-type"
              :value="row.parentTypeId"
              placeholder="一级类型"
              allow-clear
              :loading="typesLoading"
              @change="(v: string) => handleRowParentTypeChange(idx, v)"
            >
              <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
                {{ t.type_name }}
              </a-select-option>
            </a-select>

            <a-select
              class="row-type"
              :value="row.childTypeId"
              placeholder="二级类型"
              allow-clear
              :loading="typesLoading"
              @change="(v: string) => handleRowChildTypeChange(idx, v)"
            >
              <a-select-option v-for="t in row.childTypes" :key="t.type_id" :value="t.type_id">
                {{ t.type_name }}
              </a-select-option>
            </a-select>

            <a-select
              class="row-item"
              :value="row.item_id"
              placeholder="选择零件"
              show-search
              :filter-option="filterOption"
              :loading="itemsLoading"
              :options="getFilteredItemOptions(row)"
              @change="(v: string) => handleRowItemChange(idx, v)"
            />

            <a-select
              v-if="needsSpec(row)"
              class="row-spec"
              :value="row.spec_id"
              placeholder="规格"
              :options="specOptionsFor(row)"
              @change="(v: string) => handleRowSpecChange(idx, v)"
            />

            <a-input-number
              class="row-qty"
              :value="row.totalQuantity"
              placeholder="数量"
              :min="1"
              :precision="0"
              @change="(v: number | null) => handleRowQuantityChange(idx, v ?? 1)"
            />

            <a-button class="row-del" type="link" danger :disabled="batchRows.length === 1" @click="removeRow(idx)">
              <DeleteOutlined />
            </a-button>
          </div>

          <!-- 仓库分配表 -->
          <div v-if="row.spec_id && row.allocations.length > 0" class="allocation-table">
            <a-spin :spinning="row.allocationsLoading">
              <table>
                <thead>
                  <tr>
                    <th>仓库</th>
                    <th>可用库存</th>
                    <th>出库数量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(alloc, aIdx) in row.allocations" :key="alloc.warehouse_id">
                    <td>{{ alloc.warehouse_name }}</td>
                    <td>{{ alloc.availableStock }}</td>
                    <td>
                      <a-input-number
                        :value="alloc.quantity"
                        :min="0"
                        :max="alloc.availableStock"
                        :precision="0"
                        size="small"
                        style="width: 80px"
                        @change="(v: number | null) => handleAllocationChange(idx, aIdx, v ?? 0)"
                      />
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>合计</strong></td>
                    <td :class="{ 'text-warn': row.totalAvailable < row.totalQuantity }">
                      {{ row.totalAvailable }}
                    </td>
                    <td :class="{ 'text-warn': getAllocationTotal(row) !== row.totalQuantity }">
                      {{ getAllocationTotal(row) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </a-spin>
            <div v-if="row.totalAvailable < row.totalQuantity" class="stock-warning">
              库存不足，缺少 {{ row.totalQuantity - row.totalAvailable }} 件
            </div>
            <div v-else-if="getAllocationTotal(row) !== row.totalQuantity" class="stock-warning">
              出库数量与分配合计不一致
            </div>
          </div>
        </div>
      </template>

      <!-- 按产品出库 -->
      <template v-else>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="产品" name="product_id" :rules="[{ required: true, message: '请选择产品' }]">
              <a-select
                v-model:value="form.product_id"
                placeholder="请选择产品"
                show-search
                :filter-option="filterOption"
                :loading="productsLoading"
                :options="productOptions"
                @change="handleProductChange"
              />
            </a-form-item>
          </a-col>

          <a-col :span="12">
            <a-form-item
              label="出库台数"
              name="quantity"
              :rules="[
                { required: true, message: '请输入台数' },
                { type: 'number', min: 1, message: '台数必须大于0' },
              ]"
            >
              <a-input-number
                v-model:value="form.quantity"
                placeholder="台数"
                :min="1"
                :precision="0"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- BOM 预览 -->
        <div v-if="bomItems.length" class="bom-block">
          <div class="bom-title">产品零件清单（按 {{ form.quantity || 0 }} 台计算）</div>
          <a-table
            :columns="bomColumns"
            :data-source="bomView"
            :pagination="false"
            size="small"
            bordered
            row-key="relation_id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'item'">
                <div class="cell-item">
                  <span class="item-name">{{ record.item_name }}</span>
                  <span class="item-code">{{ record.item_code }}</span>
                </div>
              </template>

              <template v-else-if="column.key === 'spec'">
                <span v-if="record.spec">{{ record.spec }}</span>
                <span v-else class="cell-muted">-</span>
              </template>

              <template v-else-if="column.key === 'per'"> × {{ record.quantity_per_product }} </template>

              <template v-else-if="column.key === 'needed'">
                <span class="needed-num">{{ record.needed }}</span>
              </template>

              <template v-else-if="column.key === 'stock'">
                <span :class="{ 'text-warn': record.needed > record.warehouseStock }">{{
                  record.warehouseStock ?? '-'
                }}</span>
              </template>
            </template>
          </a-table>
        </div>
      </template>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="出库日期" name="date" :rules="[{ required: true, message: '请选择出库日期' }]">
            <a-date-picker
              v-model:value="form.date"
              placeholder="请选择日期"
              style="width: 100%"
              :format="'YYYY-MM-DD'"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注" name="remark">
        <a-textarea
          v-model:value="form.remark"
          placeholder="请输入备注（可选，本批次共用）"
          :rows="3"
          :maxlength="500"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 出库弹窗组件
 *
 * 支持两种出库模式：
 * 1. 按零件出库：用户选择零件、规格、总数量，系统自动从各仓库分配库存（按库存降序），用户可手动调整
 * 2. 按产品出库：用户选择产品、仓库、台数，系统根据 BOM 自动扣减零件库存
 */
import { ref, reactive, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { inventoryApi } from '@/api/inventory';
import type { InventoryItem, Product, ProductItemRelation, ItemTypeNode } from '@/types/inventory';
import type { SpecWarehouseStock } from '@/types/warehouse';
import WarehouseSelect from './WarehouseSelect.vue';

interface Props {
  visible: boolean;
}
const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}
const emit = defineEmits<Emits>();

// ==================== 公共状态 ====================
const formRef = ref();
const loading = ref(false);
const productsLoading = ref(false);

// 出库模式：item=按零件，product=按产品
const mode = ref<'item' | 'product'>('item');

// 产品列表（产品出库模式用）
const products = ref<Product[]>([]);
// BOM 零件列表（产品出库模式用）
const bomItems = ref<ProductItemRelation[]>([]);

// 仓库库存缓存：Map<spec_id, Map<warehouse_id, stock>>（产品出库模式用）
const warehousesWithStock = ref<Map<string, Map<string, number>>>(new Map());

// 表单数据
const form = reactive({
  warehouse_id: '', // 仓库ID（产品出库模式必填）
  product_id: '', // 产品ID（产品出库模式必填）
  quantity: 1 as number, // 出库台数（产品出库模式用）
  date: dayjs() as Dayjs,
  remark: '',
});

// ==================== 零件类型数据 ====================
const typesLoading = ref(false);
const allTypes = ref<ItemTypeNode[]>([]);
const parentTypes = ref<ItemTypeNode[]>([]);
const itemsLoading = ref(false);
const allItems = ref<InventoryItem[]>([]);

// 加载零件类型列表
const loadTypes = async () => {
  typesLoading.value = true;
  try {
    const res = await inventoryApi.listItemTypes();
    allTypes.value = (res.datas || res) as ItemTypeNode[];
    parentTypes.value = allTypes.value;
  } catch {
    // 错误由拦截器处理
  } finally {
    typesLoading.value = false;
  }
};

// 加载所有零件
const loadAllItems = async () => {
  itemsLoading.value = true;
  try {
    const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 });
    allItems.value = res.datas.items || [];
  } catch {
    allItems.value = [];
  } finally {
    itemsLoading.value = false;
  }
};

// ==================== 按零件出库：数据结构 ====================

// 仓库分配项：表示从某个仓库出库的数量
interface WarehouseAllocation {
  warehouse_id: string;
  warehouse_name: string;
  availableStock: number; // 该仓库可用库存
  quantity: number; // 从该仓库出库数量（可编辑）
}

// 批量出库行
interface BatchRow {
  parentTypeId: string | undefined; // 一级类型ID
  childTypeId: string | undefined; // 二级类型ID
  childTypes: ItemTypeNode[]; // 二级类型选项列表
  item_id: string; // 零件ID
  spec_id: string; // 规格ID
  totalQuantity: number; // 用户输入的总出库数量
  allocations: WarehouseAllocation[]; // 各仓库分配明细
  totalAvailable: number; // 所有仓库库存合计
  allocationsLoading: boolean; // 加载中状态
}

// 创建空行
function createEmptyRow(): BatchRow {
  return {
    parentTypeId: undefined,
    childTypeId: undefined,
    childTypes: [],
    item_id: '',
    spec_id: '',
    totalQuantity: 1,
    allocations: [],
    totalAvailable: 0,
    allocationsLoading: false,
  };
}

const batchRows = ref<BatchRow[]>([createEmptyRow()]);

// ==================== 按零件出库：工具函数 ====================

// 根据类型筛选零件选项
const getFilteredItemOptions = (row: BatchRow) => {
  const typeId = row.childTypeId || row.parentTypeId;
  let items = allItems.value;
  if (typeId) {
    items = items.filter((item) => {
      if (item.type_id === typeId) return true;
      const parent = allTypes.value.find((t) => t.type_id === typeId);
      if (parent?.children?.some((c) => c.type_id === item.type_id)) return true;
      return false;
    });
  }
  return items.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }));
};

// 获取当前行的零件列表（用于规格选择）
const getRowItems = (row: BatchRow) => {
  const typeId = row.childTypeId || row.parentTypeId;
  let items = allItems.value;
  if (typeId) {
    items = items.filter((item) => {
      if (item.type_id === typeId) return true;
      const parent = allTypes.value.find((t) => t.type_id === typeId);
      if (parent?.children?.some((c) => c.type_id === item.type_id)) return true;
      return false;
    });
  }
  return items;
};

/**
 * 自动分配仓库库存
 * 策略：按库存降序排列，优先从库存多的仓库出库
 */
function autoAllocate(allocations: WarehouseAllocation[], totalQuantity: number) {
  let remaining = totalQuantity;
  for (const alloc of allocations) {
    alloc.quantity = Math.min(alloc.availableStock, remaining);
    remaining -= alloc.quantity;
  }
}

// 计算分配合计
function getAllocationTotal(row: BatchRow): number {
  return row.allocations.reduce((sum, a) => sum + a.quantity, 0);
}

/**
 * 加载规格在各仓库的库存分布
 * 并自动按库存降序分配出库数量
 */
const loadWarehouseAllocations = async (row: BatchRow) => {
  if (!row.spec_id) {
    row.allocations = [];
    row.totalAvailable = 0;
    return;
  }
  row.allocationsLoading = true;
  try {
    const res = await inventoryApi.listSpecWarehouseStock(row.spec_id);
    if (res.result === 0) {
      const data = res.datas || [];
      // 构建仓库分配列表
      row.allocations = data.map((item: SpecWarehouseStock) => ({
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse_name,
        availableStock: item.current_stock,
        quantity: 0,
      }));
      // 计算总库存
      row.totalAvailable = data.reduce((sum: number, item: SpecWarehouseStock) => sum + item.current_stock, 0);
      // 自动分配
      autoAllocate(row.allocations, row.totalQuantity);
    }
  } catch {
    row.allocations = [];
    row.totalAvailable = 0;
  } finally {
    row.allocationsLoading = false;
  }
};

// ==================== 按零件出库：事件处理 ====================

// 一级类型变更：清空下游选择
const handleRowParentTypeChange = (idx: number, value: string | undefined) => {
  const row = batchRows.value[idx];
  if (!row) return;
  row.parentTypeId = value;
  row.childTypeId = undefined;
  row.item_id = '';
  row.spec_id = '';
  row.allocations = [];
  row.totalAvailable = 0;

  if (value) {
    const parent = allTypes.value.find((t) => t.type_id === value);
    row.childTypes = parent?.children || [];
  } else {
    row.childTypes = [];
  }
};

// 二级类型变更：清空下游选择
const handleRowChildTypeChange = (idx: number, value: string | undefined) => {
  const row = batchRows.value[idx];
  if (!row) return;
  row.childTypeId = value;
  row.item_id = '';
  row.spec_id = '';
  row.allocations = [];
  row.totalAvailable = 0;
};

// 零件变更：清空下游选择，自动选择唯一默认规格
const handleRowItemChange = (idx: number, value: string) => {
  const row = batchRows.value[idx];
  if (!row) return;
  row.item_id = value;
  row.spec_id = '';
  row.allocations = [];
  row.totalAvailable = 0;

  const items = getRowItems(row);
  const item = items.find((i) => i.item_id === value);
  // 如果只有一个默认规格（spec 为空），自动选择并加载库存
  if (item?.specs?.length === 1 && item.specs[0]?.spec === '') {
    row.spec_id = item.specs[0].spec_id;
    loadWarehouseAllocations(row);
  }
};

// 规格变更：加载仓库库存分布
const handleRowSpecChange = (idx: number, value: string) => {
  const row = batchRows.value[idx];
  if (!row) return;
  row.spec_id = value;
  loadWarehouseAllocations(row);
};

// 总数量变更：重新自动分配
const handleRowQuantityChange = (idx: number, value: number) => {
  const row = batchRows.value[idx];
  if (!row) return;
  row.totalQuantity = value;
  if (row.allocations.length > 0) {
    autoAllocate(row.allocations, value);
  }
};

// 手动调整某仓库出库数量
const handleAllocationChange = (rowIdx: number, allocIdx: number, value: number) => {
  const row = batchRows.value[rowIdx];
  if (!row || !row.allocations[allocIdx]) return;
  row.allocations[allocIdx].quantity = value;
};

// 添加行
const addRow = () => {
  batchRows.value.push(createEmptyRow());
};

// 删除行
const removeRow = (idx: number) => {
  batchRows.value.splice(idx, 1);
};

// 下拉框搜索过滤
const filterOption = (input: string, option: { label: string }) =>
  option.label.toLowerCase().includes(input.toLowerCase());

// 判断是否需要显示规格选择（多规格或非默认规格时显示）
function needsSpec(row: BatchRow) {
  const items = getRowItems(row);
  const item = items.find((i) => i.item_id === row.item_id);
  if (!item?.specs?.length) return false;
  return !(item.specs.length === 1 && item.specs[0]?.spec === '');
}

// 构建规格选项（显示总库存）
function specOptionsFor(row: BatchRow) {
  const items = getRowItems(row);
  const item = items.find((i) => i.item_id === row.item_id);
  if (!item?.specs) return [];
  return item.specs.map((s) => ({
    label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
    value: s.spec_id,
  }));
}

// ==================== 按产品出库 ====================

const productOptions = computed(() =>
  products.value.map((p) => ({ label: `${p.name} (${p.code})`, value: p.product_id })),
);

// 产品变更：加载 BOM
const handleProductChange = async (productId: string) => {
  bomItems.value = [];
  if (!productId) return;
  try {
    const res = await inventoryApi.listProductItems(productId);
    if (res.result === 0) {
      bomItems.value = res.datas.items || [];
      if (form.warehouse_id) {
        await loadBomWarehouseStock();
      }
    }
  } catch (error) {
    console.error('加载产品零件清单失败:', error);
  }
};

// 加载 BOM 中各规格在指定仓库的库存
const loadBomWarehouseStock = async () => {
  if (!form.warehouse_id || !bomItems.value.length) return;
  const specIds = bomItems.value.map((item) => item.spec_id).filter(Boolean);
  await Promise.all(specIds.map((specId) => loadSpecWarehouseStock(specId)));
};

// 加载单个规格的仓库库存分布（用于产品出库 BOM 预览）
const loadSpecWarehouseStock = async (specId: string) => {
  if (!specId || warehousesWithStock.value.has(specId)) return;
  try {
    const res = await inventoryApi.listSpecWarehouseStock(specId);
    if (res.result === 0) {
      const stockMap = new Map<string, number>();
      for (const item of res.datas || []) {
        stockMap.set(item.warehouse_id, item.current_stock);
      }
      warehousesWithStock.value.set(specId, stockMap);
    }
  } catch {
    // ignore
  }
};

// 仓库变更：更新 BOM 预览中的库存数据
const handleWarehouseChange = async () => {
  if (mode.value === 'product' && form.product_id) {
    await loadBomWarehouseStock();
  }
};

// BOM 表格列定义
const bomColumns = [
  { title: '零件', key: 'item', ellipsis: true },
  { title: '规格', key: 'spec', width: 110 },
  { title: '单台用量', key: 'per', width: 100, align: 'center' as const },
  { title: '需求量', key: 'needed', width: 90, align: 'center' as const },
  { title: '当前库存', key: 'stock', width: 100, align: 'center' as const },
];

// BOM 视图计算：计算每个零件的需求量和库存
const bomView = computed(() =>
  bomItems.value.map((r) => {
    let warehouseStock: number | null = null;
    if (form.warehouse_id && r.spec_id) {
      const stockMap = warehousesWithStock.value.get(r.spec_id);
      warehouseStock = stockMap?.get(form.warehouse_id) ?? 0;
    } else {
      warehouseStock = r.current_stock;
    }
    return {
      ...r,
      needed: (form.quantity || 0) * r.quantity_per_product,
      warehouseStock,
    };
  }),
);

// 加载产品列表
const loadProducts = async () => {
  productsLoading.value = true;
  try {
    const res = await inventoryApi.listProducts({ pageIndex: 1, pageSize: 1000 });
    if (res.result === 0) {
      products.value = res.datas.items;
    }
  } catch (error) {
    console.error('加载产品列表失败:', error);
  } finally {
    productsLoading.value = false;
  }
};

// ==================== 校验与提交 ====================

// 校验按零件出库
const validateBatch = (): string | null => {
  const rows = batchRows.value;
  if (rows.length === 0) return '请至少添加一条出库明细';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (!row.item_id) return `第 ${i + 1} 行未选择零件`;
    if (needsSpec(row) && !row.spec_id) return `第 ${i + 1} 行未选择规格`;
    if (!row.totalQuantity || row.totalQuantity < 1) return `第 ${i + 1} 行数量无效`;
    if (row.allocations.length === 0) return `第 ${i + 1} 行无可用库存`;
    const allocTotal = getAllocationTotal(row);
    if (allocTotal !== row.totalQuantity) return `第 ${i + 1} 行出库数量与分配合计不一致`;
    // 检查是否超出库存
    for (const alloc of row.allocations) {
      if (alloc.quantity > alloc.availableStock) {
        return `第 ${i + 1} 行 ${alloc.warehouse_name} 出库数量超出库存`;
      }
    }
  }
  return null;
};

// 提交出库
const handleSubmit = async () => {
  const dateStr = form.date.format('YYYY-MM-DD');

  // 按零件出库
  if (mode.value === 'item') {
    const err = validateBatch();
    if (err) {
      message.warning(err);
      return;
    }
    loading.value = true;
    try {
      // 展开分配为多条记录（每个仓库+零件+规格组合为一条）
      const items = batchRows.value.flatMap((row) =>
        row.allocations
          .filter((a) => a.quantity > 0)
          .map((a) => ({
            warehouse_id: a.warehouse_id,
            item_id: row.item_id,
            spec_id: row.spec_id,
            quantity: a.quantity,
          })),
      );
      const res = await inventoryApi.stockOutBatch({
        items,
        date: dateStr,
        remark: form.remark || undefined,
      });
      if (res.result === 0) {
        message.success('出库成功');
        emit('update:visible', false);
        emit('success');
      } else {
        message.error(res.msg || '出库失败');
      }
    } catch (error) {
      console.error('出库失败:', error);
    } finally {
      loading.value = false;
    }
    return;
  }

  // 按产品出库
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!form.warehouse_id) {
    message.warning('请选择仓库');
    return;
  }
  if (!bomItems.value.length) {
    message.warning('该产品未配置零件');
    return;
  }
  loading.value = true;
  try {
    const res = await inventoryApi.stockOutByProduct({
      warehouse_id: form.warehouse_id,
      product_id: form.product_id,
      quantity: form.quantity,
      date: dateStr,
      remark: form.remark || undefined,
    });
    if (res.result === 0) {
      message.success('出库成功');
      emit('update:visible', false);
      emit('success');
    } else {
      message.error(res.msg || '出库失败');
    }
  } catch (error) {
    console.error('按产品出库失败:', error);
  } finally {
    loading.value = false;
  }
};

// 取消
const handleCancel = () => {
  emit('update:visible', false);
};

// 重置表单
const resetForm = () => {
  mode.value = 'item';
  form.warehouse_id = '';
  form.product_id = '';
  form.quantity = 1;
  form.date = dayjs();
  form.remark = '';
  batchRows.value = [createEmptyRow()];
  bomItems.value = [];
  allItems.value = [];
  warehousesWithStock.value.clear();
  formRef.value?.clearValidate();
};

// 弹窗打开时初始化
watch(
  () => props.visible,
  (val) => {
    if (val) {
      resetForm();
      loadTypes();
      loadProducts();
      loadAllItems();
    }
  },
);
</script>

<style scoped>
.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.batch-label {
  font-size: 14px;
  font-weight: 500;
  color: #52525b;
}

.batch-row-wrapper {
  margin-bottom: 12px;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-type {
  width: 130px;
  flex-shrink: 0;
}

.row-item {
  flex: 1;
  min-width: 0;
}

.row-spec {
  width: 180px;
  flex-shrink: 0;
}

.row-qty {
  width: 100px;
  flex-shrink: 0;
}

.row-del {
  flex-shrink: 0;
  padding: 0 8px;
}

.allocation-table {
  margin-top: 8px;
  margin-left: 0;
}

.allocation-table table {
  width: auto;
  min-width: 360px;
  border-collapse: collapse;
  font-size: 13px;
}

.allocation-table th,
.allocation-table td {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.allocation-table th {
  background: #f9fafb;
  font-weight: 500;
  color: #374151;
}

.allocation-table tfoot td {
  background: #f9fafb;
}

.stock-warning {
  margin-top: 4px;
  font-size: 12px;
  color: #dc2626;
}

.text-warn {
  color: #dc2626;
  font-weight: 600;
}

.bom-block {
  margin-bottom: 16px;
}

.bom-title {
  font-size: 13px;
  font-weight: 500;
  color: #52525b;
  margin-bottom: 8px;
}

.cell-item {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.item-name {
  font-weight: 500;
  color: #18181b;
}

.item-code {
  font-size: 12px;
  color: #a1a1aa;
}

.cell-muted {
  color: #a1a1aa;
}

.needed-num {
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
</style>
