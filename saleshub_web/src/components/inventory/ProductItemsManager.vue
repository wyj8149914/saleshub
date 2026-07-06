<template>
  <!-- 产品零件关联管理弹窗：确定保存全量覆盖，取消不保存 -->
  <a-modal :open="visible" title="管理产品零件" :width="960" :confirm-loading="saving" :mask-closable="false"
    wrap-class-name="product-items-modal" @ok="handleSave" @cancel="handleCancel">
    <!-- 当前操作的产品摘要 -->
    <div v-if="product" class="product-info">
      <div class="product-name">{{ product.name }}</div>
      <span class="product-code">{{ product.code }}</span>
    </div>

    <!-- 添加面板：一级类型 -> 二级类型 -> 零件 -> 规格联动选择 -->
    <div class="add-panel">
      <a-select v-model:value="addForm.parentTypeId" placeholder="一级类型" allow-clear :loading="typesLoading"
        class="add-type" @change="handleParentTypeChange">
        <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
          {{ t.type_name }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="addForm.childTypeId" placeholder="二级类型" allow-clear :loading="typesLoading"
        class="add-type" @change="handleChildTypeChange">
        <a-select-option v-for="t in childTypes" :key="t.type_id" :value="t.type_id">
          {{ t.type_name }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="addForm.selectedItemKey" placeholder="选择零件" show-search :filter-option="filterOption"
        :loading="loadingAvailable" :options="itemOptions" class="add-item" @change="handleItemChange" />

      <a-select v-if="showSpecSelect" v-model:value="addForm.selectedSpecId" placeholder="选择规格" :options="specOptions"
        class="add-spec" />

      <a-input-number v-model:value="addForm.quantity_per_product" :min="1" :precision="0" :max="9999"
        class="add-quantity">
        <template #addonBefore>单台数量</template>
      </a-input-number>

      <a-input v-model:value="addForm.remark" placeholder="备注（可选，最长 100 字符）" :maxlength="100" class="add-remark" />

      <a-button type="primary" class="add-btn" :disabled="!canAdd" @click="handleAdd">
        添加
      </a-button>
    </div>

    <!-- 已关联零件列表；row-key 使用 item_id+spec_id 保证同零件不同规格行唯一 -->
    <a-table :columns="columns" :data-source="selectedItems" :loading="loading" :pagination="false"
      :row-key="(record: SelectedItem) => `${record.item_id}_${record.spec_id}`" size="middle" class="items-table"
      :locale="{ emptyText: '暂未关联任何零件，使用上方搜索框添加' }">
      <template #bodyCell="{ column, record }">
        <!-- 零件类型标签 -->
        <template v-if="column.key === 'item_type'">
          <span class="cell-type">{{ record.type_name || '-' }}</span>
        </template>

        <template v-else-if="column.key === 'item_name'">
          <span class="cell-name">{{ record.item_name }}</span>
        </template>

        <template v-else-if="column.key === 'item_code'">
          <span class="cell-code">{{ record.item_code }}</span>
        </template>

        <template v-else-if="column.key === 'spec'">
          <span class="cell-spec">{{ record.spec || '-' }}</span>
        </template>

        <!-- 库存低于预警值时标红 -->
        <template v-else-if="column.key === 'stock'">
          <span class="stock-num" :class="{ 'text-danger': record.current_stock <= record.warn_stock }">
            {{ record.current_stock }}
          </span>
        </template>

        <template v-else-if="column.key === 'quantity_per_product'">
          <a-input-number v-model:value="record.quantity_per_product" :min="1" :precision="0" :max="9999" size="small"
            class="qty-input" />
        </template>

        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" placeholder="可选备注" :maxlength="100" size="small"
            class="remark-input" />
        </template>

        <template v-else-if="column.key === 'actions'">
          <a-button type="link" size="small" danger @click="handleRemove(record)">
            移除
          </a-button>
        </template>
      </template>
    </a-table>

    <div class="footer-hint">
      共 {{ selectedItems.length }} 个零件关联；保存时将全量覆盖该产品的关联列表
    </div>
  </a-modal>
</template>

<script setup lang="ts">
  /**
   * ProductItemsManager — 产品零件关联管理弹窗
   *
   * 职责：为指定产品维护「零件 + 规格」关联列表，支持增删改单台用量与备注，
   * 保存时以全量覆盖方式提交到后端（非增量 PATCH）。
   *
   * 唯一性：同一产品下，item_id + spec_id 组合唯一，不可重复关联。
   */
  import { ref, reactive, computed, watch } from 'vue'
  import { message } from 'ant-design-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { Product, InventoryItem, ItemTypeNode } from '@/types/inventory'

  /** 弹窗显隐，由父组件 v-model:visible 控制 */
  interface Props {
    visible: boolean
    /** 当前要管理零件关联的产品；为 null 时不加载数据 */
    product: Product | null
  }

  const props = defineProps<Props>()

  interface Emits {
    /** 关闭弹窗时同步更新父组件的 visible 状态 */
    (e: 'update:visible', value: boolean): void
  }

  const emit = defineEmits<Emits>()

  /**
   * 已关联零件行数据（表格数据源）
   * 数量与备注可在表格内直接编辑，保存时一并提交
   */
  interface SelectedItem {
    item_id: string
    spec_id: string
    spec: string
    item_name: string
    item_code: string
    type_id: string
    type_name: string
    current_stock: number
    warn_stock: number
    /** 组装一台产品所需该零件的数量 */
    quantity_per_product: number
    remark: string
  }

  /** 表格加载已有关联列表时的 loading 状态 */
  const loading = ref(false)
  /** 点击「确定」保存时的 loading，会禁用弹窗确认按钮 */
  const saving = ref(false)
  /** 顶部搜索下拉框加载可选零件时的 loading */
  const loadingAvailable = ref(false)

  /** 当前产品已关联的零件列表（本地编辑态，保存前未落库） */
  const selectedItems = ref<SelectedItem[]>([])
  /** 全库零件原始数据，用于添加时补全名称、编码、库存等展示字段 */
  const availableItems = ref<InventoryItem[]>([])

  /** 类型相关状态 */
  const typesLoading = ref(false)
  const allTypes = ref<ItemTypeNode[]>([])
  const parentTypes = ref<ItemTypeNode[]>([])
  const childTypes = ref<ItemTypeNode[]>([])

  /** 顶部「添加」面板的表单状态 */
  const addForm = reactive<{
    parentTypeId: string | undefined
    childTypeId: string | undefined
    /** 选中的零件 item_id */
    selectedItemKey: string | undefined
    /** 选中的规格 spec_id */
    selectedSpecId: string | undefined
    quantity_per_product: number
    remark: string
  }>({
    parentTypeId: undefined,
    childTypeId: undefined,
    selectedItemKey: undefined,
    selectedSpecId: undefined,
    quantity_per_product: 1,
    remark: ''
  })

  /** 关联列表表格列定义，key 与模板 #bodyCell 中的 column.key 对应 */
  const columns = [
    { title: '类型', key: 'item_type', width: 90, align: 'center' },
    { title: '名称', key: 'item_name', width: 100, },
    { title: '编码', key: 'item_code', width: 130, align: 'center' },
    { title: '规格', key: 'spec', width: 120, align: 'center' },
    { title: '库存', key: 'stock', width: 120, align: 'right' },
    { title: '单台数量', key: 'quantity_per_product', width: 130, align: 'center' },
    { title: '备注', key: 'remark', width: 180 },
    { title: '操作', key: 'actions', width: 80, align: 'center' }
  ]

  /**
   * 根据类型筛选后的零件列表
   */
  const filteredItems = computed(() => {
    const typeId = addForm.childTypeId || addForm.parentTypeId
    let items = availableItems.value

    if (typeId) {
      items = items.filter(item => {
        if (item.type_id === typeId) return true
        const parent = allTypes.value.find(t => t.type_id === typeId)
        if (parent?.children?.some(c => c.type_id === item.type_id)) return true
        return false
      })
    }

    // 排除已添加的零件+规格组合
    const selectedKeys = new Set(
      selectedItems.value.map(i => `${i.item_id}_${i.spec_id}`)
    )

    return items
  })

  /**
   * 零件下拉选项（根据类型筛选，排除已添加的）
   */
  const itemOptions = computed(() => {
    const selectedKeys = new Set(
      selectedItems.value.map(i => `${i.item_id}`)
    )
    return filteredItems.value
      .filter(item => !selectedKeys.has(item.item_id) || item.specs.some(s => !selectedKeys.has(`${item.item_id}_${s.spec_id}`)))
      .map(item => ({
        label: `${item.name} (${item.code})`,
        value: item.item_id
      }))
  })

  /**
   * 当前选中的零件对象
   */
  const selectedItem = computed(() =>
    availableItems.value.find(i => i.item_id === addForm.selectedItemKey)
  )

  /**
   * 是否显示规格选择
   */
  const showSpecSelect = computed(() => {
    const item = selectedItem.value
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
  })

  /**
   * 规格下拉选项
   */
  const specOptions = computed(() => {
    const item = selectedItem.value
    if (!item?.specs) return []

    // 排除已添加的规格
    const selectedKeys = new Set(
      selectedItems.value
        .filter(i => i.item_id === addForm.selectedItemKey)
        .map(i => i.spec_id)
    )

    return item.specs
      .filter(s => !selectedKeys.has(s.spec_id))
      .map(s => ({
        label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
        value: s.spec_id
      }))
  })

  /**
   * 是否可以添加（必须选择零件，且如果需要规格则必须选择规格）
   */
  const canAdd = computed(() => {
    if (!addForm.selectedItemKey) return false
    if (showSpecSelect.value && !addForm.selectedSpecId) return false
    return true
  })

  /**
   * 下拉框本地搜索过滤
   */
  const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

  /**
   * 加载零件类型列表
   */
  const loadTypes = async () => {
    typesLoading.value = true
    try {
      const res = await inventoryApi.listItemTypes()
      allTypes.value = (res.datas || res) as ItemTypeNode[]
      parentTypes.value = allTypes.value
    } catch {
      // 错误由拦截器处理
    } finally {
      typesLoading.value = false
    }
  }

  /**
   * 一级类型变更
   */
  const handleParentTypeChange = (value: string | undefined) => {
    addForm.childTypeId = undefined
    addForm.selectedItemKey = undefined
    addForm.selectedSpecId = undefined

    if (value) {
      const parent = allTypes.value.find(t => t.type_id === value)
      childTypes.value = parent?.children || []
    } else {
      childTypes.value = []
    }
  }

  /**
   * 二级类型变更
   */
  const handleChildTypeChange = () => {
    addForm.selectedItemKey = undefined
    addForm.selectedSpecId = undefined
  }

  /**
   * 零件变更
   */
  const handleItemChange = () => {
    addForm.selectedSpecId = undefined
    // 如果只有一个默认规格，自动选中
    const defaultSpec = selectedItem.value?.specs?.[0]
    if (selectedItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
      addForm.selectedSpecId = defaultSpec.spec_id
    }
  }

  /**
   * 加载当前产品已关联的零件列表
   * 将 API 返回数据映射为 SelectedItem，并补全 quantity、remark 默认值
   */
  const loadCurrentItems = async () => {
    if (!props.product) return
    loading.value = true
    try {
      const res = await inventoryApi.listProductItems(props.product.product_id)
      selectedItems.value = res.datas.items.map((i) => ({
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
        remark: i.remark || ''
      }))
    } catch {
      // 错误由 request 拦截器统一处理
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载全库可选零件
   * 一次性拉取较大分页（999 条），供添加面板搜索使用
   */
  const loadAvailableItems = async () => {
    loadingAvailable.value = true
    try {
      const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 999 })
      availableItems.value = res.datas.items
    } catch {
      // 错误由 request 拦截器统一处理
    } finally {
      loadingAvailable.value = false
    }
  }

  /**
   * 将选中的零件规格加入关联列表
   */
  const handleAdd = () => {
    if (!addForm.selectedItemKey) {
      message.error('请选择零件')
      return
    }

    const item = selectedItem.value
    if (!item) return

    // 确定规格 ID 和名称
    let specId = addForm.selectedSpecId
    let specName = ''

    if (item.specs?.length === 1 && item.specs[0]?.spec === '') {
      // 只有一个默认规格的情况
      specId = item.specs[0].spec_id
      specName = ''
    } else if (!specId && showSpecSelect.value) {
      message.error('请选择规格')
      return
    }

    if (specId) {
      const spec = item.specs?.find(s => s.spec_id === specId)
      specName = spec?.spec || ''
    }

    // 检查是否已存在
    const exists = selectedItems.value.some(
      i => i.item_id === item.item_id && i.spec_id === specId
    )
    if (exists) {
      message.warning('该零件规格已添加')
      return
    }

    selectedItems.value.push({
      item_id: item.item_id,
      spec_id: specId || '',
      spec: specName,
      item_name: item.name,
      item_code: item.code,
      type_id: item.type_id,
      type_name: item.type_name || item.type_id,
      current_stock: item.specs?.find(s => s.spec_id === specId)?.current_stock || 0,
      warn_stock: item.warn_stock,
      quantity_per_product: addForm.quantity_per_product,
      remark: addForm.remark
    })

    // 重置选择（保留类型选择，方便连续添加同类型零件）
    addForm.selectedItemKey = undefined
    addForm.selectedSpecId = undefined
    addForm.quantity_per_product = 1
    addForm.remark = ''
  }

  /**
   * 从关联列表中移除一行
   * 按 item_id + spec_id 定位，移除后该规格会重新出现在下拉选项中
   */
  const handleRemove = (record: SelectedItem) => {
    const idx = selectedItems.value.findIndex(
      i => i.item_id === record.item_id && i.spec_id === record.spec_id
    )
    if (idx >= 0) {
      selectedItems.value.splice(idx, 1)
    }
  }

  /**
   * 保存关联列表（全量覆盖）
   *
   * 将 selectedItems 映射为 API 所需字段后调用 setProductItems，
   * 成功后提示并关闭弹窗。空 remark 传 undefined 以省略字段。
   */
  const handleSave = async () => {
    if (!props.product) return
    saving.value = true
    try {
      await inventoryApi.setProductItems(
        props.product.product_id,
        selectedItems.value.map((i) => ({
          item_id: i.item_id,
          spec_id: i.spec_id,
          quantity_per_product: i.quantity_per_product,
          remark: i.remark || undefined
        }))
      )
      message.success('关联已更新')
      emit('update:visible', false)
    } catch {
      // 错误由 request 拦截器统一处理
    } finally {
      saving.value = false
    }
  }

  /** 取消编辑，直接关闭弹窗（不保存本地修改） */
  const handleCancel = () => {
    emit('update:visible', false)
  }

  /**
   * 监听弹窗显隐，负责数据加载与清理
   *
   * - 打开：并行加载类型、已关联列表和全库零件，并重置添加表单
   * - 关闭：清空 selectedItems、availableItems，释放内存
   */
  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.product) {
        loadTypes()
        loadCurrentItems()
        loadAvailableItems()
        // 重置添加表单
        addForm.parentTypeId = undefined
        addForm.childTypeId = undefined
        addForm.selectedItemKey = undefined
        addForm.selectedSpecId = undefined
        addForm.quantity_per_product = 1
        addForm.remark = ''
        childTypes.value = []
      } else {
        selectedItems.value = []
        availableItems.value = []
        allTypes.value = []
        parentTypes.value = []
        childTypes.value = []
      }
    }
  )
</script>

<style scoped>

  /* 产品信息条 */
  .product-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 16px;
    background: #f9fafb;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .product-name {
    font-size: 16px;
    font-weight: 600;
    color: #18181b;
  }

  .product-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 13px;
    color: #52525b;
    background: #ffffff;
    padding: 2px 8px;
    border-radius: 4px;
  }

  /* 添加面板 */
  .add-panel {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .add-type {
    width: 140px;
    flex-shrink: 0;
  }

  .add-item {
    flex: 1;
    min-width: 150px;
  }

  .add-spec {
    width: 180px;
    flex-shrink: 0;
  }

  .add-remark {
    flex: 1;
    min-width: 160px;
  }

  .add-quantity {
    width: 140px;
    flex-shrink: 0;
  }

  .add-quantity :deep(.ant-input-number) {
    border-radius: 8px;
  }

  .add-quantity :deep(.ant-input-number-focused) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  .add-quantity :deep(.ant-input-number-handler-wrap) {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .add-quantity :deep(.ant-input-group-addon) {
    background: #f4f4f5;
    border-color: #e4e4e7;
    color: #52525b;
    font-size: 13px;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }

  .add-btn {
    border-radius: 8px;
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff !important;
    font-weight: 500;
  }

  .add-btn:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1d4ed8;
    color: #ffffff !important;
  }

  /* 禁用态保持蓝底白字可见，仅用透明度表达不可点击 */
  .add-btn[disabled],
  .add-btn[disabled]:hover {
    background: #2563eb !important;
    border-color: #2563eb !important;
    color: #ffffff !important;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-panel :deep(.ant-select-selector),
  .add-panel :deep(.ant-input) {
    border-radius: 8px;
  }

  .add-panel :deep(.ant-select-focused .ant-select-selector) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  /* 关联表格 */
  .items-table :deep(.ant-table-thead > tr > th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 14px;
    color: #52525b;
    border-bottom: 1px solid #e4e4e7;
  }

  .items-table :deep(.ant-table-tbody > tr > td) {
    font-size: 14px;
  }

  .items-table :deep(.ant-table-tbody > tr:nth-child(even) > td) {
    background: #f9fafb;
  }

  .items-table :deep(.ant-table-tbody > tr:hover > td) {
    background: #eff6ff;
  }

  /* 类型标签 */
  .cell-type {
    font-size: 13px;
    color: #52525b;
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .cell-name {
    font-weight: 500;
    color: #18181b;
  }

  .cell-code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 13px;
    color: #52525b;
  }

  .cell-spec {
    font-size: 13px;
    color: #52525b;
    font-style: italic;
  }

  .stock-num {
    font-weight: 600;
    color: #18181b;
    font-variant-numeric: tabular-nums;
    margin-right: 4px;
  }

  .stock-num.text-danger {
    color: #dc2626;
  }

  .stock-warn {
    font-size: 12px;
    color: #a1a1aa;
    font-variant-numeric: tabular-nums;
  }

  /* 备注输入框 */
  .remark-input {
    border-radius: 6px;
  }

  /* 行内单台数量输入 */
  .qty-input {
    width: 100%;
    border-radius: 6px;
  }

  .qty-input :deep(.ant-input-number-focused) {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }

  .remark-input :deep(.ant-input:focus),
  .remark-input :deep(.ant-input:hover) {
    border-color: #2563eb;
  }

  /* 移除按钮 */
  .items-table :deep(.ant-btn-link) {
    padding: 4px 8px;
    height: auto;
    font-size: 13px;
  }

  .items-table :deep(.ant-btn-link:hover) {
    color: #dc2626;
  }

  /* 底部提示 */
  .footer-hint {
    margin-top: 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: #71717a;
    background: #f4f4f5;
    border-radius: 6px;
    line-height: 1.5;
  }
</style>
