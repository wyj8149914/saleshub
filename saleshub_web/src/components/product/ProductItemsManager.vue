<template>
  <!-- 产品零件关联管理弹窗 -->
  <a-modal :open="visible" title="管理产品模块和零件" :width="1080" :confirm-loading="saving" :mask-closable="false"
    wrap-class-name="product-items-modal" @ok="handleSave" @cancel="handleCancel">
    <!-- 当前操作的产品摘要 -->
    <div v-if="product" class="product-info">
      <div class="product-name">{{ product.name }}</div>
      <span class="product-code">{{ product.code }}</span>
    </div>

    <!-- 初始状态：选择管理方式 -->
    <div v-if="mode === 'none'" class="mode-select">
      <div class="mode-hint">请选择零件管理方式（选择后不可更改）</div>
      <div class="mode-cards">
        <div class="mode-card" @click="handleSelectMode('direct')">
          <div class="mode-icon">📦</div>
          <div class="mode-title">直接关联零件</div>
          <div class="mode-desc">直接为产品添加零件，适合零件较少的产品</div>
        </div>
        <div class="mode-card" @click="handleSelectMode('module')">
          <div class="mode-icon">📑</div>
          <div class="mode-title">模块化管理</div>
          <div class="mode-desc">通过模块分组管理零件，适合零件较多、结构复杂的产品</div>
        </div>
      </div>
    </div>

    <!-- 直接关联模式 -->
    <div v-else-if="mode === 'direct'" class="direct-mode">
      <!-- 添加面板 -->
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

        <a-input v-model:value="addForm.remark" placeholder="备注（可选）" :maxlength="100" class="add-remark" />

        <a-button type="primary" class="add-btn" :disabled="!canAdd" @click="handleAdd">
          添加
        </a-button>
      </div>

      <!-- 已关联零件列表 -->
      <a-table :columns="columns" :data-source="directItems" :loading="loading" :pagination="false"
        :row-key="(record: SelectedItem) => `${record.item_id}_${record.spec_id}`" size="middle" class="items-table"
        :locale="{ emptyText: '暂未关联任何零件，使用上方搜索框添加' }">
        <template #bodyCell="{ column, record }">
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
            <a-button type="link" size="small" danger @click="handleRemoveDirect(record)">
              移除
            </a-button>
          </template>
        </template>
      </a-table>

      <div class="footer-hint">
        共 {{ directItems.length }} 个零件关联；保存时将全量覆盖该产品的关联列表
      </div>
    </div>

    <!-- 模块化管理模式 -->
    <div v-else-if="mode === 'module'" class="module-mode">
      <!-- 模块操作栏 -->
      <div class="module-toolbar">
        <a-button type="primary" @click="showCreateModule">
          <template #icon>
            <PlusOutlined />
          </template>
          创建模块
        </a-button>
      </div>

      <!-- 模块列表 -->
      <div v-if="modules.length > 0" class="module-list">
        <a-collapse v-model:activeKey="activeModuleKeys">
          <a-collapse-panel v-for="module in modules" :key="module.module_id">
            <template #header>
              <div class="module-header">
                <span class="module-name">{{ module.name }}</span>
                <span class="module-count">{{ module.items?.length || 0 }} 个零件</span>
              </div>
            </template>
            <template #extra>
              <a-space @click.stop>
                <a-button type="link" size="small" @click="showEditModule(module)">编辑</a-button>
                <a-popconfirm title="确定删除该模块吗？" :disabled="!!module.items?.length"
                  @confirm="handleDeleteModule(module.module_id)">
                  <a-button type="link" size="small" danger :disabled="!!module.items?.length">
                    删除
                  </a-button>
                  <template v-if="module.items?.length" #title>
                    <span class="delete-hint">模块下存在零件，请先移除零件后再删除</span>
                  </template>
                </a-popconfirm>
              </a-space>
            </template>

            <!-- 模块内零件管理 -->
            <div class="module-items-panel">
              <ModuleItemsEditor :module-id="module.module_id" :initial-items="module.items || []"
                :available-items="availableItems" :all-types="allTypes" />
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>

      <a-empty v-else description="暂无模块，点击上方按钮创建" />

      <div class="footer-hint">
        共 {{ modules.length }} 个模块，{{ totalModuleItems }} 个零件
      </div>
    </div>

    <a-skeleton avatar :paragraph="{ rows: 4 }" v-else-if="mode === 'loading'" />
  </a-modal>

  <!-- 创建/编辑模块弹窗 -->
  <a-modal v-model:open="moduleModalVisible" :title="editingModule ? '编辑模块' : '创建模块'" :confirm-loading="moduleSaving"
    @ok="handleModuleSubmit" @cancel="moduleModalVisible = false">
    <a-form :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
      <a-form-item label="模块名称" required>
        <a-input v-model:value="moduleForm.name" placeholder="请输入模块名称" :maxlength="100" />
      </a-form-item>
      <a-form-item label="排序号">
        <a-input-number v-model:value="moduleForm.sort_order" :min="0" style="width: 100%" />
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model:value="moduleForm.remark" placeholder="可选，最长500字符" :maxlength="500" :rows="3" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
  /**
   * ProductItemsManager — 产品零件关联管理弹窗
   *
   * 支持两种管理模式：
   * 1. 直接关联模式：直接为产品添加零件
   * 2. 模块化管理模式：通过模块分组管理零件
   *
   * 模式互斥：产品只能选择一种方式，选定后不可更改（除非清空所有数据）
   */
  import { ref, reactive, computed, watch } from 'vue'
  import { message } from 'ant-design-vue'
  import { PlusOutlined } from '@ant-design/icons-vue'
  import { inventoryApi } from '@/api/inventory'
  import type { Product, InventoryItem, ItemTypeNode, ProductModule, ProductItemRelation } from '@/types/inventory'
  import ModuleItemsEditor from './ModuleItemsEditor.vue'

  /** 弹窗显隐 */
  interface Props {
    visible: boolean
    product: Product | null
  }

  const props = defineProps<Props>()

  interface Emits {
    (e: 'update:visible', value: boolean): void
  }

  const emit = defineEmits<Emits>()

  /** 零件管理模式：none-未选择，direct-直接关联，module-模块化 */
  type ManageMode = 'none' | 'direct' | 'module' | 'loading'
  const mode = ref<ManageMode>('loading')

  // ============ 公共状态 ============
  const loading = ref(false)
  const saving = ref(false)
  const typesLoading = ref(false)
  const loadingAvailable = ref(false)

  const allTypes = ref<ItemTypeNode[]>([])
  const parentTypes = ref<ItemTypeNode[]>([])
  const childTypes = ref<ItemTypeNode[]>([])
  const availableItems = ref<InventoryItem[]>([])

  // ============ 直接关联模式状态 ============
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
    quantity_per_product: number
    remark: string
  }

  const directItems = ref<SelectedItem[]>([])

  const addForm = reactive({
    parentTypeId: undefined as string | undefined,
    childTypeId: undefined as string | undefined,
    selectedItemKey: undefined as string | undefined,
    selectedSpecId: undefined as string | undefined,
    quantity_per_product: 1,
    remark: ''
  })

  const columns = [
    { title: '类型', key: 'item_type', width: 90, align: 'center' },
    { title: '名称', key: 'item_name', width: 100 },
    { title: '编码', key: 'item_code', width: 130, align: 'center' },
    { title: '规格', key: 'spec', width: 120, align: 'center' },
    { title: '库存', key: 'stock', width: 100, align: 'right' },
    { title: '单台数量', key: 'quantity_per_product', width: 120, align: 'center' },
    { title: '备注', key: 'remark', width: 150 },
    { title: '操作', key: 'actions', width: 80, align: 'center' }
  ]

  // ============ 模块化模式状态 ============
  interface ModuleWithItems extends ProductModule {
    items: ProductItemRelation[]
  }

  const modules = ref<ModuleWithItems[]>([])
  const activeModuleKeys = ref<string[]>([])

  // 模块弹窗
  const moduleModalVisible = ref(false)
  const moduleSaving = ref(false)
  const editingModule = ref<ModuleWithItems | null>(null)
  const moduleForm = reactive({
    name: '',
    code: '',
    sort_order: 0,
    remark: ''
  })

  // ============ 计算属性 ============
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

    return items
  })

  const itemOptions = computed(() => {
    const selectedKeys = new Set(directItems.value.map(i => i.item_id))
    return filteredItems.value
      .filter(item => !selectedKeys.has(item.item_id) || item.specs.some(s => !selectedKeys.has(`${item.item_id}_${s.spec_id}`)))
      .map(item => ({
        label: `${item.name} (${item.code})`,
        value: item.item_id
      }))
  })

  const selectedItem = computed(() =>
    availableItems.value.find(i => i.item_id === addForm.selectedItemKey)
  )

  const showSpecSelect = computed(() => {
    const item = selectedItem.value
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
  })

  const specOptions = computed(() => {
    const item = selectedItem.value
    if (!item?.specs) return []

    const selectedKeys = new Set(
      directItems.value
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

  const canAdd = computed(() => {
    if (!addForm.selectedItemKey) return false
    if (showSpecSelect.value && !addForm.selectedSpecId) return false
    return true
  })

  const totalModuleItems = computed(() =>
    modules.value.reduce((sum, m) => sum + (m.items?.length || 0), 0)
  )

  const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

  // ============ 数据加载 ============
  const loadTypes = async () => {
    typesLoading.value = true
    try {
      const res = await inventoryApi.listItemTypes()
      allTypes.value = (res.datas || res) as ItemTypeNode[]
      parentTypes.value = allTypes.value
    } finally {
      typesLoading.value = false
    }
  }

  const loadAvailableItems = async () => {
    loadingAvailable.value = true
    try {
      const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 999 })
      availableItems.value = res.datas.items
    } finally {
      loadingAvailable.value = false
    }
  }

  const loadProductItems = async () => {
    if (!props.product) return
    loading.value = true
    try {
      const res = await inventoryApi.listProductItems(props.product.product_id)
      if (res.datas.use_module) {
        mode.value = 'module'
        modules.value = (res.datas.modules || []).map(m => ({
          ...m,
          items: m.items || []
        })) as ModuleWithItems[]
      } else if (res.datas.use_module == false && res.datas.items && res.datas.items.length > 0) {
        mode.value = 'direct'
        directItems.value = (res.datas.items || []).map(i => ({
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
      } else {
        mode.value = 'none'
      }
    } finally {
      loading.value = false
    }
  }

  // ============ 模式选择 ============
  const handleSelectMode = (selectedMode: 'direct' | 'module') => {
    mode.value = selectedMode
  }

  // ============ 直接关联模式方法 ============
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

  const handleChildTypeChange = () => {
    addForm.selectedItemKey = undefined
    addForm.selectedSpecId = undefined
  }

  const handleItemChange = () => {
    addForm.selectedSpecId = undefined
    const defaultSpec = selectedItem.value?.specs?.[0]
    if (selectedItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
      addForm.selectedSpecId = defaultSpec.spec_id
    }
  }

  const handleAdd = () => {
    if (!addForm.selectedItemKey) {
      message.error('请选择零件')
      return
    }

    const item = selectedItem.value
    if (!item) return

    let specId = addForm.selectedSpecId
    let specName = ''

    if (item.specs?.length === 1 && item.specs[0]?.spec === '') {
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

    const exists = directItems.value.some(
      i => i.item_id === item.item_id && i.spec_id === specId
    )
    if (exists) {
      message.warning('该零件规格已添加')
      return
    }

    directItems.value.push({
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

    addForm.selectedItemKey = undefined
    addForm.selectedSpecId = undefined
    addForm.quantity_per_product = 1
    addForm.remark = ''
  }

  const handleRemoveDirect = (record: SelectedItem) => {
    const idx = directItems.value.findIndex(
      i => i.item_id === record.item_id && i.spec_id === record.spec_id
    )
    if (idx >= 0) {
      directItems.value.splice(idx, 1)
    }
  }

  // ============ 模块化模式方法 ============
  const showCreateModule = () => {
    editingModule.value = null
    moduleForm.name = ''
    moduleForm.code = ''
    moduleForm.sort_order = 0
    moduleForm.remark = ''
    moduleModalVisible.value = true
  }

  const showEditModule = (module: ModuleWithItems) => {
    editingModule.value = module
    moduleForm.name = module.name
    moduleForm.code = module.code || ''
    moduleForm.sort_order = module.sort_order
    moduleForm.remark = module.remark || ''
    moduleModalVisible.value = true
  }

  const handleModuleSubmit = async () => {
    if (!moduleForm.name.trim()) {
      message.error('请输入模块名称')
      return
    }

    if (!props.product) return

    moduleSaving.value = true
    try {
      if (editingModule.value) {
        await inventoryApi.updateModule({
          module_id: editingModule.value.module_id,
          name: moduleForm.name,
          code: moduleForm.code || undefined,
          sort_order: moduleForm.sort_order,
          remark: moduleForm.remark || undefined
        })
        // 更新本地数据
        const idx = modules.value.findIndex(m => m.module_id === editingModule.value!.module_id)
        const targetModule = modules.value[idx]
        if (idx >= 0 && targetModule) {
          targetModule.name = moduleForm.name
          targetModule.code = moduleForm.code || null
          targetModule.sort_order = moduleForm.sort_order
          targetModule.remark = moduleForm.remark || null
        }
        message.success('模块已更新')
      } else {
        const res = await inventoryApi.createModule({
          product_id: props.product.product_id,
          name: moduleForm.name,
          code: moduleForm.code || undefined,
          sort_order: moduleForm.sort_order,
          remark: moduleForm.remark || undefined
        })
        modules.value.push({
          module_id: res.datas.module_id,
          product_id: props.product.product_id,
          name: moduleForm.name,
          code: moduleForm.code || null,
          sort_order: moduleForm.sort_order,
          remark: moduleForm.remark || null,
          status: 1,
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          items: []
        })
        message.success('模块已创建')
      }
      moduleModalVisible.value = false
    } catch {
      // 错误由拦截器处理
    } finally {
      moduleSaving.value = false
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    try {
      await inventoryApi.deleteModule(moduleId)
      modules.value = modules.value.filter(m => m.module_id !== moduleId)
      activeModuleKeys.value = activeModuleKeys.value.filter(k => k !== moduleId)
      message.success('模块已删除')
    } catch {
      // 错误由拦截器处理
    }
  }

  // ============ 保存 ============
  const handleSave = async () => {
    if (!props.product) return

    if (mode.value === 'none') {
      emit('update:visible', false)
      return
    }

    saving.value = true
    try {
      if (mode.value === 'direct') {
        await inventoryApi.setProductItems(
          props.product.product_id,
          directItems.value.map(i => ({
            item_id: i.item_id,
            spec_id: i.spec_id,
            quantity_per_product: i.quantity_per_product,
            remark: i.remark || undefined
          }))
        )
        message.success('保存成功')
      }
      // 模块模式下，零件保存由 ModuleItemsEditor 组件内部处理
      emit('update:visible', false)
    } catch {
      // 错误由拦截器处理
    } finally {
      saving.value = false
    }
  }

  const handleCancel = () => {
    emit('update:visible', false)
  }

  // ============ 监听弹窗显隐 ============
  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.product) {
        loadTypes()
        loadAvailableItems()
        loadProductItems()

        addForm.parentTypeId = undefined
        addForm.childTypeId = undefined
        addForm.selectedItemKey = undefined
        addForm.selectedSpecId = undefined
        addForm.quantity_per_product = 1
        addForm.remark = ''
        childTypes.value = []
        activeModuleKeys.value = []
      } else {
        mode.value = 'loading'
        directItems.value = []
        modules.value = []
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

  /* 模式选择 */
  .mode-select {
    padding: 24px 0;
  }

  .mode-hint {
    text-align: center;
    color: #52525b;
    margin-bottom: 24px;
    font-size: 14px;
  }

  .mode-cards {
    display: flex;
    gap: 24px;
    justify-content: center;
  }

  .mode-card {
    width: 220px;
    padding: 24px;
    border: 2px solid #e4e4e7;
    border-radius: 12px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
  }

  .mode-card:hover {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .mode-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  .mode-title {
    font-size: 16px;
    font-weight: 600;
    color: #18181b;
    margin-bottom: 8px;
  }

  .mode-desc {
    font-size: 13px;
    color: #71717a;
    line-height: 1.5;
  }

  /* 直接关联模式 */
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
    min-width: 120px;
  }

  .add-quantity {
    width: 140px;
    flex-shrink: 0;
  }

  .add-quantity :deep(.ant-input-number) {
    border-radius: 8px;
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

  }

  .add-panel :deep(.ant-select-selector),
  .add-panel :deep(.ant-input) {
    border-radius: 8px;
  }

  /* 关联表格 */
  .items-table :deep(.ant-table-thead > tr > th) {
    background: #fafafa;
    font-weight: 600;
    font-size: 14px;
    color: #52525b;
    border-bottom: 1px solid #e4e4e7;
  }

  .items-table :deep(.ant-table-tbody > tr:nth-child(even) > td) {
    background: #f9fafb;
  }

  .items-table :deep(.ant-table-tbody > tr:hover > td) {
    background: #eff6ff;
  }

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
  }

  .stock-num.text-danger {
    color: #dc2626;
  }

  .qty-input,
  .remark-input {
    border-radius: 6px;
  }

  /* 模块化模式 */
  .module-toolbar {
    margin-bottom: 16px;
  }

  .module-list :deep(.ant-collapse) {
    border-radius: 8px;
    border: 1px solid #e4e4e7;
  }

  .module-list :deep(.ant-collapse-header) {
    background: #fafafa;
    border-radius: 8px 8px 0 0;
  }

  .module-list :deep(.ant-collapse-content) {
    border-top: 1px solid #e4e4e7;
  }

  .module-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .module-name {
    font-weight: 600;
    color: #18181b;
  }

  .module-count {
    font-size: 13px;
    color: #71717a;
  }

  .module-items-panel {
    padding: 16px 0;
  }

  .delete-hint {
    color: #dc2626;
    font-size: 13px;
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
