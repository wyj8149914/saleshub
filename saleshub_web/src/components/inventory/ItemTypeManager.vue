<template>
  <a-modal :open="visible" title="零件类型管理" :width="800" :footer="null" :mask-closable="false"
    wrap-class-name="item-type-manager-modal" @cancel="handleClose">
    <div class="type-manager">
      <!-- 操作栏 -->
      <div class="action-bar">
        <a-button type="primary" @click="handleAddParent">
          <template #icon>
            <PlusOutlined />
          </template>
          新增一级类型
        </a-button>
      </div>

      <!-- 类型列表 -->
      <a-table :columns="columns" :data-source="flatList" :loading="loading" :pagination="false" bordered
        row-key="type_id" size="middle" :indent-size="20" default-expand-all-rows>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type_name'">
            <span :class="record._isChild ? 'child-name' : 'parent-name'">{{ record.type_name }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space :size="4">
              <a-button v-if="!record.parent_id" type="link" size="small" @click="handleAddChild(record)">
                新增子类型
              </a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm title="确定要删除此类型吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <a-modal :open="formVisible" :title="formTitle" :confirm-loading="formLoading" :width="440" :mask-closable="false"
      @ok="handleFormSubmit" @cancel="formVisible = false">
      <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical">
        <a-form-item v-if="form.parent_id && !isEditMode" label="父类型">
          <a-input :value="parentTypeName" disabled />
        </a-form-item>

        <a-form-item label="类型名称" name="type_name">
          <a-input v-model:value="form.type_name" placeholder="请输入类型名称" :maxlength="100" show-count />
        </a-form-item>

        <a-form-item label="排序号" name="sort_order">
          <a-input-number v-model:value="form.sort_order" placeholder="默认 0" :precision="0" style="width: 100%" />
        </a-form-item>

        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-modal>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { ItemTypeNode } from '@/types/inventory'

  interface Props {
    visible: boolean
  }

  const props = defineProps<Props>()

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const emit = defineEmits<Emits>()

  const loading = ref(false)
  const typeList = ref<ItemTypeNode[]>([])

  const columns = [
    { title: '类型名称', key: 'type_name', dataIndex: 'type_name', width: 200 },
    { title: '排序', key: 'sort_order', dataIndex: 'sort_order', width: 80, align: 'center' as const },
    { title: '备注', key: 'remark', dataIndex: 'remark', width: 200, ellipsis: true },
    { title: '操作', key: 'actions', width: 220, align: 'center' as const }
  ]

  // 将树形数据展平为带层级的列表
  const flatList = computed(() => {
    const result: (ItemTypeNode & { _isChild?: boolean })[] = []
    for (const parent of typeList.value) {
      result.push(parent)
      if (parent.children?.length) {
        for (const child of parent.children) {
          result.push({ ...child, _isChild: true })
        }
      }
    }
    return result
  })

  const loadTypes = async () => {
    loading.value = true
    try {
      const res = await inventoryApi.listItemTypes()
      typeList.value = (res.datas || res) as ItemTypeNode[]
    } catch {
      // 错误由拦截器处理
    } finally {
      loading.value = false
    }
  }

  // ---- 表单 ----
  const formVisible = ref(false)
  const formLoading = ref(false)
  const formRef = ref()
  const isEditMode = ref(false)
  const editingTypeId = ref<string>('')
  const parentTypeName = ref('')

  const form = reactive({
    parent_id: '' as string | undefined,
    type_name: '',
    sort_order: 0,
    remark: ''
  })

  const formRules = {
    type_name: [
      { required: true, message: '请输入类型名称', trigger: 'blur' },
      { max: 100, message: '名称最多 100 个字符', trigger: 'blur' }
    ]
  }

  const formTitle = computed(() => {
    if (isEditMode.value) return '编辑类型'
    return form.parent_id ? '新增子类型' : '新增一级类型'
  })

  const resetForm = () => {
    form.parent_id = undefined
    form.type_name = ''
    form.sort_order = 0
    form.remark = ''
    editingTypeId.value = ''
    isEditMode.value = false
    parentTypeName.value = ''
    formRef.value?.clearValidate()
  }

  const handleAddParent = () => {
    resetForm()
    formVisible.value = true
  }

  const handleAddChild = (parent: ItemTypeNode) => {
    resetForm()
    form.parent_id = parent.type_id
    parentTypeName.value = parent.type_name
    formVisible.value = true
  }

  const handleEdit = (record: ItemTypeNode) => {
    resetForm()
    isEditMode.value = true
    editingTypeId.value = record.type_id
    form.type_name = record.type_name
    form.sort_order = record.sort_order
    form.remark = record.remark || ''
    form.parent_id = record.parent_id || undefined
    if (record.parent_id) {
      const parent = typeList.value.find(p => p.type_id === record.parent_id)
      parentTypeName.value = parent?.type_name || ''
    }
    formVisible.value = true
  }

  const handleFormSubmit = async () => {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }

    formLoading.value = true
    try {
      if (isEditMode.value) {
        await inventoryApi.updateItemType({
          type_id: editingTypeId.value,
          type_name: form.type_name,
          sort_order: form.sort_order,
          remark: form.remark || undefined
        })
        message.success('类型更新成功')
      } else {
        await inventoryApi.createItemType({
          parent_id: form.parent_id,
          type_name: form.type_name,
          sort_order: form.sort_order,
          remark: form.remark || undefined
        })
        message.success('类型创建成功')
      }
      formVisible.value = false
      await loadTypes()
      emit('success')
    } catch {
      // 错误由拦截器处理
    } finally {
      formLoading.value = false
    }
  }

  const handleDelete = async (record: ItemTypeNode) => {
    try {
      await inventoryApi.deleteItemType(record.type_id)
      message.success('类型删除成功')
      await loadTypes()
      emit('success')
    } catch {
      // 错误由拦截器处理
    }
  }

  const handleClose = () => {
    emit('update:visible', false)
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        loadTypes()
      } else {
        typeList.value = []
      }
    }
  )
</script>

<style scoped>
  .type-manager {
    min-height: 200px;
  }

  .action-bar {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .action-bar .ant-btn {
    border-radius: 8px;
    background: #2563eb;
    border-color: #2563eb;
    font-weight: 500;
  }

  .parent-name {
    font-weight: 600;
    color: #18181b;
  }

  .child-name {
    padding-left: 20px;
    color: #52525b;
  }

  .type-manager :deep(.ant-table-thead > tr > th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 14px;
    color: #52525b;
  }

  .type-manager :deep(.ant-table-tbody > tr > td) {
    font-size: 14px;
  }

  .type-manager :deep(.ant-btn-link) {
    padding: 4px 8px;
    height: auto;
    font-size: 13px;
  }
</style>
