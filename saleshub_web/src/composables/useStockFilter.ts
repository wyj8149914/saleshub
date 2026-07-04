import { ref, computed, onMounted } from 'vue'
import { inventoryApi } from '@/api/inventory'
import type { ItemTypeNode, InventoryItem } from '@/types/inventory'

export interface StockFilterState {
  parentTypeId: string | undefined
  childTypeId: string | undefined
  itemId: string | undefined
  specId: string | undefined
}

export function useStockFilter() {
  // 类型相关
  const typesLoading = ref(false)
  const allTypes = ref<ItemTypeNode[]>([])
  const parentTypes = ref<ItemTypeNode[]>([])
  const filterParentTypeId = ref<string | undefined>(undefined)
  const filterChildTypeId = ref<string | undefined>(undefined)
  const filterChildTypes = ref<ItemTypeNode[]>([])

  // 零件相关
  const itemsLoading = ref(false)
  const allItemsUnfiltered = ref<InventoryItem[]>([])  // 所有零件（未筛选）
  const allItems = ref<InventoryItem[]>([])            // 筛选后的零件
  const filterItemId = ref<string | undefined>(undefined)

  // 规格相关
  const filterSpecId = ref<string | undefined>(undefined)
  const filterSpecs = ref<Array<{ spec_id: string; spec: string }>>([])

  // 加载类型
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

  // 加载所有零件
  const loadAllItems = async () => {
    itemsLoading.value = true
    try {
      const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 })
      allItemsUnfiltered.value = res.datas.items || []
      allItems.value = allItemsUnfiltered.value
    } catch {
      allItemsUnfiltered.value = []
      allItems.value = []
    } finally {
      itemsLoading.value = false
    }
  }

  // 根据类型筛选零件
  const filterItems = () => {
    const typeId = filterChildTypeId.value || filterParentTypeId.value
    if (typeId) {
      allItems.value = allItemsUnfiltered.value.filter(item => {
        if (item.type_id === typeId) return true
        const parent = allTypes.value.find(t => t.type_id === typeId)
        if (parent?.children?.some(c => c.type_id === item.type_id)) return true
        return false
      })
    } else {
      allItems.value = allItemsUnfiltered.value
    }
  }

  // 零件选项
  const itemOptions = computed(() =>
    allItems.value.map((item) => ({
      label: `${item.name} (${item.code})`,
      value: item.item_id
    }))
  )

  // 规格选项
  const specOptions = computed(() =>
    filterSpecs.value.map((spec) => ({
      label: spec.spec || '默认规格',
      value: spec.spec_id
    }))
  )

  // 一级类型变更
  const handleParentTypeChange = (value: string | undefined) => {
    filterChildTypeId.value = undefined
    filterItemId.value = undefined
    filterSpecId.value = undefined
    filterSpecs.value = []

    if (value) {
      const parent = allTypes.value.find(t => t.type_id === value)
      filterChildTypes.value = parent?.children || []
    } else {
      filterChildTypes.value = []
    }
    filterItems()
  }

  // 二级类型变更
  const handleChildTypeChange = (value: string | undefined) => {
    filterItemId.value = undefined
    filterSpecId.value = undefined
    filterSpecs.value = []
    filterItems()
  }

  // 零件变更
  const handleItemChange = (value: string | undefined) => {
    filterSpecId.value = undefined

    if (value) {
      const item = allItems.value.find(i => i.item_id === value)
      filterSpecs.value = item?.specs || []
    } else {
      filterSpecs.value = []
    }
  }

  // 获取当前筛选状态
  const getFilterState = (): StockFilterState => ({
    parentTypeId: filterParentTypeId.value,
    childTypeId: filterChildTypeId.value,
    itemId: filterItemId.value,
    specId: filterSpecId.value
  })

  // 重置筛选
  const resetFilter = () => {
    filterParentTypeId.value = undefined
    filterChildTypeId.value = undefined
    filterItemId.value = undefined
    filterSpecId.value = undefined
    filterChildTypes.value = []
    allItems.value = allItemsUnfiltered.value
    filterSpecs.value = []
  }

  onMounted(() => {
    loadTypes()
    loadAllItems()
  })

  return {
    // 类型
    typesLoading,
    parentTypes,
    filterParentTypeId,
    filterChildTypeId,
    filterChildTypes,

    // 零件
    itemsLoading,
    allItems,
    filterItemId,
    itemOptions,

    // 规格
    filterSpecId,
    specOptions,

    // 方法
    handleParentTypeChange,
    handleChildTypeChange,
    handleItemChange,
    getFilterState,
    resetFilter
  }
}
