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
}

// ============ 产品 ============
export interface Product {
    product_id: string
    name: string
    code: string
    description: string
    image_id: string | null
    image_url: string | null
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
}

export interface ProductUpdatePayload {
    product_id: string
    name: string
    description?: string
    image_id?: string
}

// ============ 零件 ============
export interface InventoryItem {
    item_id: string
    type: ItemType
    name: string
    code: string
    specs: ItemSpec[]
    image_id: string | null
    image_url: string | null
    warn_stock: number
}

export interface ItemListQuery {
    pageIndex: number
    pageSize: number
    type?: ItemType
    name?: string
    code?: string
    isWarning?: 1 | 2
}

export interface ItemCreatePayload {
    type: ItemType
    name: string
    specs?: string[]
    warnStock?: number
    image_id?: string
}

export interface ItemUpdatePayload {
    item_id: string
    type: ItemType
    name: string
    specs?: string[]
    warnStock?: number
    image_id?: string
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
    item_type: ItemType
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
