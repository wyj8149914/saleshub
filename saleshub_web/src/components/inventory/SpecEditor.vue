<template>
  <!-- 常用件规格列表编辑器：v-model 绑定规格名称字符串数组 -->
  <div class="spec-editor">
    <div v-for="(_spec, index) in value" :key="index" class="spec-row">
      <a-input :value="value[index]" placeholder="请输入规格（如：不锈钢、M8×20）" :maxlength="100" allow-clear
        @update:value="(v: string) => updateSpec(index, v)" />
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
/**
 * SpecEditor — 常用件规格选项编辑器
 *
 * 职责：维护规格名称列表，通过 v-model:value 与父表单同步 string[]。
 * 提交时由父组件过滤空串后作为 specs 传给后端。
 */
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'

interface Props {
  /** 规格名称列表 */
  value: string[]
}

const props = withDefaults(defineProps<Props>(), {
  value: () => []
})

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void
}>()

function updateSpec(index: number, spec: string) {
  const next = [...props.value]
  next[index] = spec
  emit('update:value', next)
}

function addSpec() {
  emit('update:value', [...props.value, ''])
}

function removeSpec(index: number) {
  const next = [...props.value]
  next.splice(index, 1)
  emit('update:value', next)
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
