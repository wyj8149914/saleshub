<template>
  <div class="module-items-editor">
    <!-- 添加面板 -->
    <div class="add-panel">
      <a-select
        v-model:value="addForm.parentTypeId"
        placeholder="一级类型"
        allow-clear
        :loading="typesLoading"
        class="add-type"
        @change="handleParentTypeChange"
      >
        <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
          {{ t.type_name }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="addForm.childTypeId" placeholder="二级类型" allow-clear :loading="typesLoading" class="add-type" @change="handleChildTypeChange">
        <a-select-option v-for="t in childTypes" :key="t.type_id" :value="t.type_id">
          {{ t.type_name }}
        </a-select-option>
      </a-select>

      <a-select
        v-model:value="addForm.selectedItemKey"
        placeholder="选择零件"
        show-search
        :filter-option="filterOption"
        :loading="loadingAvailable"
        :options="itemOptions"
        class="add-item"
        @change="handleItemChange"
      />

      <a-select v-if="showSpecSelect" v-model:value="addForm.selectedSpecId" placeholder="选择规格" :options="specOptions" class="add-spec" />

      <a-input-number v-model:value="addForm.quantity_per_product" :min="1" :precision="0" :max="9999" class="add-quantity">
        <template #addonBefore>数量</template>
      </a-input-number>

      <a-input v-model:value="addForm.remark" placeholder="备注（可选）" :maxlength="100" class="add-remark" />

      <a-button type="primary" class="add-btn" :disabled="!canAdd" @click="handleAdd"> 添加 </a-button>

      <a-button type="primary" class="save-btn" :loading="saving" :disabled="!hasChanges" @click="handleSave"> 保存 </a-button>
    </div>

    <!-- 零件列表 -->
    <a-table
      :columns="columns"
      :data-source="localItems"
      :pagination="false"
      :row-key="(record: ItemRow) => `${record.item_id}_${record.spec_id}`"
      size="small"
      class="items-table"
      :locale="{ emptyText: '暂无零件，使用上方添加' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'item_type'">
          <span class="cell-type">{{ record.type_name || '-' }}</span>
        </template>
        <template v-else-if="column.key === 'item_name'">
          <span class="cell-name">{{ record.item_name }}</span>
        </template>
        <template v-else-if="column.key === 'spec'">
          <span class="cell-spec">{{ record.spec || '-' }}</span>
        </template>
        <template v-else-if="column.key === 'stock'">
          <span class="stock-num" :class="{ 'text-danger': record.current_stock <= record.warn_stock }">
            {{ record.current_stock }}
          </span>
        </template>
        <template v-else-if="column.key === 'quantity_per_product'">
          <a-input-number v-model:value="record.quantity_per_product" :min="1" :precision="0" :max="9999" size="small" class="qty-input" />
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" placeholder="备注" :maxlength="100" size="small" class="remark-input" />
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button type="link" size="small" danger @click="handleRemove(record)"> 移除 </a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
/**
 * ModuleItemsEditor — 模块零件编辑器
 *
 * 用于管理单个模块内的零件列表
 */
import { ref, reactive, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '@/api/inventory';
import type { InventoryItem, ItemTypeNode, ProductItemRelation } from '@/types/inventory';

interface Props {
  moduleId: string;
  initialItems: ProductItemRelation[];
  availableItems: InventoryItem[];
  allTypes: ItemTypeNode[];
}

const props = defineProps<Props>();

interface ItemRow {
  item_id: string;
  spec_id: string;
  spec: string;
  item_name: string;
  item_code: string;
  type_id: string;
  type_name: string;
  current_stock: number;
  warn_stock: number;
  quantity_per_product: number;
  remark: string;
}

const loadingAvailable = ref(false);
const typesLoading = ref(false);
const saving = ref(false);

const localItems = ref<ItemRow[]>([]);
const originalItems = ref<ItemRow[]>([]);

const parentTypes = computed(() => props.allTypes);
const childTypes = ref<ItemTypeNode[]>([]);

const addForm = reactive({
  parentTypeId: undefined as string | undefined,
  childTypeId: undefined as string | undefined,
  selectedItemKey: undefined as string | undefined,
  selectedSpecId: undefined as string | undefined,
  quantity_per_product: 1,
  remark: '',
});

const columns = [
  { title: '类型', key: 'item_type', width: 80, align: 'center' },
  { title: '名称', key: 'item_name', width: 100 },
  { title: '规格', key: 'spec', width: 100, align: 'center' },
  { title: '库存', key: 'stock', width: 80, align: 'right' },
  { title: '数量', key: 'quantity_per_product', width: 100, align: 'center' },
  { title: '备注', key: 'remark', width: 120 },
  { title: '操作', key: 'actions', width: 70, align: 'center' },
];

const filteredItems = computed(() => {
  const typeId = addForm.childTypeId || addForm.parentTypeId;
  let items = props.availableItems;

  if (typeId) {
    items = items.filter((item) => {
      if (item.type_id === typeId) return true;
      const parent = props.allTypes.find((t) => t.type_id === typeId);
      if (parent?.children?.some((c) => c.type_id === item.type_id)) return true;
      return false;
    });
  }

  return items;
});

const itemOptions = computed(() => {
  const selectedKeys = new Set(localItems.value.map((i) => i.item_id));
  return filteredItems.value
    .filter((item) => !selectedKeys.has(item.item_id) || item.specs.some((s) => !selectedKeys.has(`${item.item_id}_${s.spec_id}`)))
    .map((item) => ({
      label: `${item.name} (${item.code})`,
      value: item.item_id,
    }));
});

const selectedItem = computed(() => props.availableItems.find((i) => i.item_id === addForm.selectedItemKey));

const showSpecSelect = computed(() => {
  const item = selectedItem.value;
  if (!item?.specs?.length) return false;
  return !(item.specs.length === 1 && item.specs[0]?.spec === '');
});

const specOptions = computed(() => {
  const item = selectedItem.value;
  if (!item?.specs) return [];

  const selectedKeys = new Set(localItems.value.filter((i) => i.item_id === addForm.selectedItemKey).map((i) => i.spec_id));

  return item.specs
    .filter((s) => !selectedKeys.has(s.spec_id))
    .map((s) => ({
      label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
      value: s.spec_id,
    }));
});

const canAdd = computed(() => {
  if (!addForm.selectedItemKey) return false;
  if (showSpecSelect.value && !addForm.selectedSpecId) return false;
  return true;
});

const hasChanges = computed(() => {
  if (localItems.value.length !== originalItems.value.length) return true;
  return JSON.stringify(localItems.value) !== JSON.stringify(originalItems.value);
});

const filterOption = (input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase());

const handleParentTypeChange = (value: string | undefined) => {
  addForm.childTypeId = undefined;
  addForm.selectedItemKey = undefined;
  addForm.selectedSpecId = undefined;

  if (value) {
    const parent = props.allTypes.find((t) => t.type_id === value);
    childTypes.value = parent?.children || [];
  } else {
    childTypes.value = [];
  }
};

const handleChildTypeChange = () => {
  addForm.selectedItemKey = undefined;
  addForm.selectedSpecId = undefined;
};

const handleItemChange = () => {
  addForm.selectedSpecId = undefined;
  const defaultSpec = selectedItem.value?.specs?.[0];
  if (selectedItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
    addForm.selectedSpecId = defaultSpec.spec_id;
  }
};

const handleAdd = () => {
  if (!addForm.selectedItemKey) {
    message.error('请选择零件');
    return;
  }

  const item = selectedItem.value;
  if (!item) return;

  let specId = addForm.selectedSpecId;
  let specName = '';

  if (item.specs?.length === 1 && item.specs[0]?.spec === '') {
    specId = item.specs[0].spec_id;
    specName = '';
  } else if (!specId && showSpecSelect.value) {
    message.error('请选择规格');
    return;
  }

  if (specId) {
    const spec = item.specs?.find((s) => s.spec_id === specId);
    specName = spec?.spec || '';
  }

  const exists = localItems.value.some((i) => i.item_id === item.item_id && i.spec_id === specId);
  if (exists) {
    message.warning('该零件规格已添加');
    return;
  }

  const newItem: ItemRow = {
    item_id: item.item_id,
    spec_id: specId || '',
    spec: specName,
    item_name: item.name,
    item_code: item.code,
    type_id: item.type_id,
    type_name: item.type_name || item.type_id,
    current_stock: item.specs?.find((s) => s.spec_id === specId)?.current_stock || 0,
    warn_stock: item.warn_stock,
    quantity_per_product: addForm.quantity_per_product,
    remark: addForm.remark,
  };

  localItems.value.push(newItem);

  addForm.selectedItemKey = undefined;
  addForm.selectedSpecId = undefined;
  addForm.quantity_per_product = 1;
  addForm.remark = '';
};

const handleRemove = (record: ItemRow) => {
  const idx = localItems.value.findIndex((i) => i.item_id === record.item_id && i.spec_id === record.spec_id);
  if (idx >= 0) {
    localItems.value.splice(idx, 1);
  }
};

const saveModuleItems = async () => {
  try {
    await inventoryApi.setModuleItems(
      props.moduleId,
      localItems.value.map((i) => ({
        item_id: i.item_id,
        spec_id: i.spec_id,
        quantity_per_product: i.quantity_per_product,
        remark: i.remark || undefined,
      })),
    );
    // 保存成功后更新原始数据
    originalItems.value = JSON.parse(JSON.stringify(localItems.value));
    message.success('保存成功');
  } catch {
    // 错误由拦截器处理
  }
};

const handleSave = async () => {
  saving.value = true;
  try {
    await saveModuleItems();
  } finally {
    saving.value = false;
  }
};

// 初始化数据
const initItems = (items: ProductItemRelation[]) => {
  const mapped = items.map((i) => ({
    item_id: i.item_id,
    spec_id: i.spec_id,
    spec: i.spec,
    item_name: i.item_name,
    item_code: i.item_code,
    type_id: i.type_id,
    type_name: i.type_name,
    current_stock: i.current_stock,
    warn_stock: i.warn_stock,
    quantity_per_product: i.quantity_per_product || 1,
    remark: i.remark || '',
  }));
  localItems.value = mapped;
  originalItems.value = JSON.parse(JSON.stringify(mapped));
};

// 只在 moduleId 变化时初始化，避免 emitUpdate 触发重置
watch(
  () => props.moduleId,
  () => {
    initItems(props.initialItems);
  },
  { immediate: true },
);
</script>

<style scoped>
.module-items-editor {
  background: #fff;
}

.add-panel {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.add-type {
  width: 120px;
  flex-shrink: 0;
}

.add-item {
  flex: 1;
  min-width: 140px;
}

.add-spec {
  width: 160px;
  flex-shrink: 0;
}

.add-remark {
  flex: 1;
  min-width: 100px;
}

.add-quantity {
  width: 120px;
  flex-shrink: 0;
}

.add-quantity :deep(.ant-input-number) {
  border-radius: 6px;
}

.add-quantity :deep(.ant-input-group-addon) {
  background: #f4f4f5;
  border-color: #e4e4e7;
  color: #52525b;
  font-size: 12px;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}

.add-btn {
  border-radius: 6px;
}

.save-btn {
  border-radius: 6px;
  /* border-color: #2563eb;
    color: white; */
}

.add-panel :deep(.ant-select-selector),
.add-panel :deep(.ant-input) {
  border-radius: 6px;
}

.items-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  font-size: 13px;
  color: #52525b;
  padding: 8px;
}

.items-table :deep(.ant-table-tbody > tr > td) {
  padding: 8px;
}

.items-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #eff6ff;
}

.cell-type {
  font-size: 12px;
  color: #52525b;
  background: #f4f4f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.cell-name {
  font-weight: 500;
  color: #18181b;
  font-size: 13px;
}

.cell-spec {
  font-size: 12px;
  color: #52525b;
  font-style: italic;
}

.stock-num {
  font-weight: 600;
  font-size: 13px;
  color: #18181b;
  font-variant-numeric: tabular-nums;
}

.stock-num.text-danger {
  color: #dc2626;
}

.qty-input,
.remark-input {
  border-radius: 4px;
}
</style>
