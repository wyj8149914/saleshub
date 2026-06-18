<template>
  <div class="spec-editor">
    <div v-for="(spec, index) in localSpecs" :key="index" class="spec-row">
      <a-input
        v-model:value="localSpecs[index]"
        placeholder="请输入规格（如：不锈钢、M8×20）"
        :maxlength="100"
        allow-clear
      />
      <a-button type="text" danger @click="removeSpec(index)">
        <template #icon>
          <DeleteOutlined />
        </template>
      </a-button>
    </div>

    <a-button type="dashed" block class="spec-add" @click="addSpec">
      <template #icon>
        <PlusOutlined />
      </template>
      添加规格
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'

interface Props {
  value: string[]
}

const props = withDefaults(defineProps<Props>(), {
  value: () => []
})

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void
}>()

const localSpecs = ref<string[]>([...props.value])

watch(
  () => props.value,
  (newValue) => {
    localSpecs.value = [...newValue]
  },
  { deep: true }
)

watch(
  localSpecs,
  (newValue) => {
    emit('update:value', [...newValue])
  },
  { deep: true }
)

function addSpec() {
  localSpecs.value.push('')
}

function removeSpec(index: number) {
  localSpecs.value.splice(index, 1)
}
</script>

<style scoped>
.spec-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.spec-row :deep(.ant-input),
.spec-row :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  flex: 1;
}

.spec-row :deep(.ant-input-affix-wrapper-focused),
.spec-row :deep(.ant-input:focus) {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.spec-add {
  border-radius: 8px;
  border-color: #e4e4e7;
  color: #52525b;
  transition: all 0.18s ease;
}

.spec-add:hover {
  border-color: #2563eb;
  color: #2563eb;
}
</style>
