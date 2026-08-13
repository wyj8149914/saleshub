<template>
  <a-select
    :value="modelValue"
    :placeholder="placeholder"
    :loading="loading"
    :disabled="disabled"
    allow-clear
    show-search
    :filter-option="filterOption"
    @update:value="$emit('update:modelValue', $event)"
    @change="handleChange"
  >
    <a-select-option v-for="w in warehouses" :key="w.warehouse_id" :value="w.warehouse_id">
      {{ w.name }}{{ w.location ? ` (${w.location})` : '' }}
    </a-select-option>
  </a-select>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { inventoryApi } from '@/api/inventory';
import type { Warehouse } from '@/types/warehouse';

interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  status?: 1 | 2;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '请选择仓库',
  disabled: false,
  status: 1,
});

interface Emits {
  (e: 'update:modelValue', value: string | undefined): void;
  (e: 'change', value: string | undefined, warehouse: Warehouse | undefined): void;
}

const emit = defineEmits<Emits>();

const loading = ref(false);
const warehouses = ref<Warehouse[]>([]);

const filterOption = (input: string, option: { children: string }) => {
  return option.children.toLowerCase().includes(input.toLowerCase());
};

const loadWarehouses = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.listWarehouses({ pageIndex: 1, pageSize: 1000, status: 1 });
    warehouses.value = res.datas || [];
  } catch {
    warehouses.value = [];
  } finally {
    loading.value = false;
  }
};

const handleChange = (value: string | undefined) => {
  const warehouse = warehouses.value.find((w) => w.warehouse_id === value);
  emit('change', value, warehouse);
};

watch(
  () => props.status,
  () => {
    loadWarehouses();
  },
);

onMounted(() => {
  loadWarehouses();
});

defineExpose({ refresh: loadWarehouses });
</script>
