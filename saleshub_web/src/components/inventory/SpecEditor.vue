<template>
  <a-space direction="vertical" style="width: 100%" :size="8">
    <div
      v-for="(spec, index) in localSpecs"
      :key="index"
      style="display: flex; gap: 8px; width: 100%;"
    >
      <a-input
        v-model:value="localSpecs[index]"
        placeholder="Enter specification"
        style="flex: 1;"
      />
      <a-button
        danger
        @click="removeSpec(index)"
      >
        Delete
      </a-button>
    </div>
    <a-button
      type="dashed"
      block
      @click="addSpec"
      style="border-style: dashed;"
    >
      Add Spec
    </a-button>
  </a-space>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  value: string[];
}

const props = withDefaults(defineProps<Props>(), {
  value: () => []
});

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void;
}>();

const localSpecs = ref<string[]>([...props.value]);

// Watch prop value to sync local specs
watch(() => props.value, (newValue) => {
  localSpecs.value = [...newValue];
}, { deep: true });

// Watch local specs to emit updates
watch(localSpecs, (newValue) => {
  emit('update:value', [...newValue]);
}, { deep: true });

// Add empty spec to array
const addSpec = () => {
  localSpecs.value.push('');
};

// Remove spec at index
const removeSpec = (index: number) => {
  localSpecs.value.splice(index, 1);
};
</script>

<style scoped>
/* Additional styles if needed */
</style>
