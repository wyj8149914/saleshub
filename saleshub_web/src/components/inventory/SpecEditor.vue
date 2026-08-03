<template>
  <!-- 常用件规格列表编辑器：v-model 绑定规格对象数组（含规格名称和价格） -->
  <!-- 内部多个输入框不参与父级 Form.Item 字段收集，避免 ant-design-vue 告警 -->
  <a-form-item-rest>
    <div class="spec-editor">
      <div v-for="(specItem, index) in value" :key="index" class="spec-row">
        <a-input :value="specItem.spec" placeholder="请输入规格（如：不锈钢、M8×20）" :maxlength="100" allow-clear
          @update:value="(v: string) => updateSpec(index, v)" />
        <a-input-number :value="specItem.price" placeholder="价格（可选）" :min="0" :precision="2"
          style="width: 120px; margin-left: 8px" @update:value="(v: number) => updatePrice(index, v)" />
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
  </a-form-item-rest>
</template>

<script setup lang="ts">
  /**
   * SpecEditor — 常用件规格选项编辑器
   *
   * 职责：维护规格列表（包含规格名称和价格），通过 v-model:value 与父表单同步 SpecPayload[]。
   * 提交时由父组件过滤空规格后作为 specs 传给后端。
   */
  import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
  import type { SpecPayload } from '@/types/inventory'

  interface Props {
    /** 规格列表 */
    value: SpecPayload[]
  }

  const props = withDefaults(defineProps<Props>(), {
    value: () => []
  })

  const emit = defineEmits<{
    (e: 'update:value', value: SpecPayload[]): void
  }>()

  function updateSpec(index: number, spec: string) {
    const next = [...props.value]
    next[index] = { ...next[index], spec }
    emit('update:value', next)
  }

  function updatePrice(index: number, price: number | undefined) {
    const next = [...props.value]
    const current = next[index]
    if (current) {
      // 使用展开保留 spec_id 等额外字段,避免编辑价格时丢失已有规格标识
      next[index] = { ...current, price }
      emit('update:value', next)
    }
  }

  function addSpec() {
    emit('update:value', [...props.value, { spec: '' }])
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

  .spec-row :deep(.ant-input-number) {
    border-radius: 8px;
  }

  .spec-row :deep(.ant-input-affix-wrapper-focused),
  .spec-row :deep(.ant-input:focus),
  .spec-row :deep(.ant-input-number-focused) {
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
