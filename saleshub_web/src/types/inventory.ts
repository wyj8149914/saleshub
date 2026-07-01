// ============ 零件类型 ============
export interface ItemTypeNode {
    type_id: string
    type_name: string
    parent_id: string | null
    sort_order: number
    remark: string | null
    parent_type_id?: string | null
    parent_type_name?: string | null
    children?: ItemTypeNode[]
}

export interface ItemTypeListQuery {
    parent_id?: string
}

export interface ItemTypeCreatePayload {
    parent_id?: string
    type_name: string
    sort_order?: number
    remark?: string
}

export interface ItemTypeUpdatePayload {
    type_id: string
    type_name: string
    sort_order?: number
    remark?: string
}

// ============ 通用类型 ============
export type ItemType = 'device' | 'common'
export interface PaginatedData<T> {
    total: number
    items: T[]
}

// ============ 文件上传 ============
export interface FileUploadResponse {
    relation_id: string
    url: string
    hash: string
    is_duplicate: boolean
}

// ============ 零件规格 ============
export interface ItemSpec {
    spec_id: string
    spec: string
    current_stock: number
    price: number
}

/** 创建/更新零件时使用的规格项 */
export interface SpecPayload {
    spec: string
    price?: number
}

// ============ 产品 ============
export interface Product {
    product_id: string
    name: string
    code: string
    description: string
    image_id: string | null
    image_url: string | null,
    price: number | null,
    remark: string | null,
}

export interface ProductListQuery {
    pageIndex: number
    pageSize: number
    name?: string
    code?: string
}

export interface ProductCreatePayload {
    name: string
    description?: string
    image_id?: string
    price?: number
    remark?: string
}

export interface ProductUpdatePayload {
    product_id: string
    name: string
    description?: string
    image_id?: string
    price?: number
    remark?: string
}

// ============ 零件 ============
export interface InventoryItem {
    item_id: string
    type_id: string
    type_name?: string
    type_full_name?: string
    name: string
    code: string
    specs: ItemSpec[]
    image_id: string | null
    image_url: string | null
    warn_stock: number,
    is_custom: 1 | 2
    remark: string | null
}

export interface ItemListQuery {
    pageIndex: number
    pageSize: number
    type_id?: string
    name?: string
    code?: string
    isWarning?: 1 | 2
    is_custom?: 1 | 2
}

export interface ItemCreatePayload {
    type_id: string
    name: string
    specs?: SpecPayload[]
    warnStock?: number
    image_id?: string
    remark?: string
    is_custom?: 1 | 2
}

export interface ItemUpdatePayload {
    item_id: string
    type_id: string
    name: string
    specs?: SpecPayload[]
    warnStock?: number
    image_id?: string,
    remark?: string
    is_custom?: 1 | 2
}

// ============ 产品-零件关联 ============
export interface ProductItemRelation {
    relation_id: string
    product_id: string
    item_id: string
    spec_id: string
    spec: string
    quantity_per_product: number
    remark: string | null
    item_name: string
    item_code: string
    type_id: string
    type_name: string
    current_stock: number
    warn_stock: number
}

export interface ProductItemPayload {
    item_id: string
    spec_id: string
    quantity_per_product?: number
    remark?: string
}

export interface StockRecord {
    record_id: string
    item_id: string
    spec_id?: string
    quantity: number
    before_stock?: number
    after_stock?: number
    type: 'in' | 'out' | 'check'
    date?: string
    remark?: string
    create_time: string
    record_no?: string
}

export interface StockHistoryQuery {
    item_id: string
    pageIndex: number
    pageSize: number
    spec_id?: string
    start_date?: string
    end_date?: string
}

export interface StockHistoryRecord {
    id: string
    type: 'in' | 'out' | 'check'
    item_name: string | null
    spec: string | null
    quantity: number | null
    before_stock: number
    after_stock: number
    date: string
    remark: string | null
    create_time: string
}

// ============ 入库记录 ============
export interface StockInRecord {
    record_id: string
    record_no: string
    date: string
    quantity: number
    remark: string | null
    photo_id: string | null
    photo_url: string | null
    before_stock: number
    after_stock: number
    item_name: string | null
    spec: string | null
    create_time: string
}

// ============ 出库记录 ============
export interface StockOutRecord {
    record_id: string
    record_no: string
    date: string
    quantity: number
    remark: string | null
    before_stock: number
    after_stock: number
    item_name: string | null
    spec: string | null
    create_time: string
}

export interface StockRecordListQuery {
    pageIndex: number
    pageSize: number
    start_date?: string
    end_date?: string
    item_id?: string
    spec_id?: string
    record_no?: string
}

// ============ 出入库 Payload ============
export interface StockInPayload {
    item_id: string
    spec_id: string
    quantity: number
    date: string
    photo_id: string
    remark?: string
}

export interface StockInBatchItem {
    item_id: string
    spec_id: string
    quantity: number
}

export interface StockInBatchPayload {
    items: StockInBatchItem[]
    date: string
    photo_id: string
    remark?: string
}

export interface StockOutPayload {
    item_id: string
    spec_id: string
    quantity: number
    date: string
    remark?: string
}

export interface StockOutBatchItem {
    item_id: string
    spec_id: string
    quantity: number
}

export interface StockOutBatchPayload {
    items: StockOutBatchItem[]
    date: string
    remark?: string
}

export interface StockOutByProductPayload {
    product_id: string
    quantity: number
    date: string
    remark?: string
}

// ============ 盘点记录 ============
export interface StockCheckRecord {
    check_id: string
    record_no: string
    date: string
    remark: string | null
    before_stock: number
    after_stock: number
    item_name: string | null
    spec: string | null
    create_time: string
}

export interface StockCheckPayload {
    item_id: string
    spec_id: string
    after_stock: number
    date: string
    remark?: string
}

export interface StockCheckBatchItem {
    item_id: string
    spec_id: string
    after_stock: number
}

export interface StockCheckBatchPayload {
    items: StockCheckBatchItem[]
    date: string
    remark?: string
}
