<template>
  <!-- 产品零件关联管理弹窗：确定保存全量覆盖，取消不保存 -->
  <a-modal :open="visible" title="管理产品零件" :width="960" :confirm-loading="saving" :mask-closable="false"
    wrap-class-name="product-items-modal" @ok="handleSave" @cancel="handleCancel">
    <!-- 当前操作的产品摘要 -->
    <div v-if="product" class="product-info">
      <div class="product-name">{{ product.name }}</div>
      <span class="product-code">{{ product.code }}</span>
    </div>

    <!-- 添加面板：搜索未关联的「零件+规格」，设置单台数量与备注后加入列表 -->
    <div class="add-panel">
      <a-select v-model:value="addForm.selectedKey" placeholder="搜索零件或规格" show-search allow-clear
        :filter-option="filterItem" :options="availableOptions" :loading="loadingAvailable"
        :field-names="{ label: 'label', value: 'value' }" class="add-select" />
      <a-input-number v-model:value="addForm.quantity_per_product" :min="1" :precision="0" :max="9999"
        class="add-quantity">
        <template #addonBefore>单台数量</template>
      </a-input-number>
      <a-input v-model:value="addForm.remark" placeholder="备注（可选，最长 100 字符）" :maxlength="100" class="add-remark" />
      <a-button type="primary" class="add-btn" :disabled="!addForm.selectedKey" @click="handleAdd">
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
  import type { Product, InventoryItem } from '@/types/inventory'

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

  /** 顶部「添加」面板的表单状态 */
  const addForm = reactive<{
    /** 下拉选中项，格式 item_id_spec_id，唯一标识「零件+规格」 */
    selectedKey: string | undefined
    quantity_per_product: number
    remark: string
  }>({
    selectedKey: undefined,
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
   * 下拉选项结构
   * value 为 item_id + spec_id 复合键，保证同零件不同规格选项唯一
   */
  interface SelectOption {
    label: string
    value: string
    itemId: string
    specId: string
    specName: string
  }

  /**
   * 可添加的下拉选项（计算属性）
   *
   * 逻辑：遍历全库零件及其规格，排除已在 selectedItems 中的 item_id+spec_id 组合，
   * 生成「名称 - 规格（编码）」格式的 label 供搜索选择。
   */
  const availableOptions = computed<SelectOption[]>(() => {
    const selectedKeys = new Set(
      selectedItems.value.map(i => `${i.item_id}_${i.spec_id}`)
    )
    const options: SelectOption[] = []

    for (const item of availableItems.value) {
      for (const spec of item.specs) {
        const key = `${item.item_id}_${spec.spec_id}`
        if (!selectedKeys.has(key)) {
          const displaySpec = spec.spec ? ` - ${spec.spec}` : ''
          options.push({
            label: `${item.name}${displaySpec}（${item.code}）`,
            value: key,
            itemId: item.item_id,
            specId: spec.spec_id,
            specName: spec.spec
          })
        }
      }
    }

    return options
  })

  /**
   * 下拉框本地搜索过滤
   * 按选项 label 做不区分大小写的子串匹配
   */
  const filterItem = (input: string, option: SelectOption) => {
    return option.label.toLowerCase().includes(input.toLowerCase())
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
   *
   * 流程：
   * 1. 校验 item_id、spec_id 均已选择
   * 2. 从 availableOptions / availableItems 中查找对应记录
   * 3. 组装 SelectedItem 推入 selectedItems
   * 4. 重置添加表单
   */
  const handleAdd = () => {
    if (!addForm.selectedKey) {
      message.error('请选择零件和规格')
      return
    }

    const option = availableOptions.value.find(opt => opt.value === addForm.selectedKey)
    if (!option) return

    const item = availableItems.value.find(i => i.item_id === option.itemId)
    if (!item) return

    const spec = item.specs?.find(s => s.spec_id === option.specId)

    selectedItems.value.push({
      item_id: item.item_id,
      spec_id: option.specId,
      spec: option.specName,
      item_name: item.name,
      item_code: item.code,
      type_id: item.type_id,
      type_name: item.type_name || item.type_id,
      current_stock: spec?.current_stock || 0,
      warn_stock: item.warn_stock,
      quantity_per_product: addForm.quantity_per_product,
      remark: addForm.remark
    })

    addForm.selectedKey = undefined
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
   * - 打开：并行加载已关联列表和全库零件，并重置添加表单
   * - 关闭：清空 selectedItems、availableItems，释放内存
   */
  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.product) {
        loadCurrentItems()
        loadAvailableItems()
        addForm.selectedKey = undefined
        addForm.quantity_per_product = 1
        addForm.remark = ''
      } else {
        selectedItems.value = []
        availableItems.value = []
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
  }

  .add-select {
    flex: 1;
    min-width: 220px;
  }

  .add-remark {
    flex: 1;
    min-width: 200px;
  }

  .add-quantity {
    width: 160px;
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
