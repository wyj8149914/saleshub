import { http } from '@/utils/request'

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
    price: number | null
    current_stock: number
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
    image_url: string | null
    price: number | null
    remark: string | null
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
    type: ItemType
    name: string
    code: string
    specs: ItemSpec[]
    image_id: string | null
    image_url: string | null
    warn_stock: number
    remark: string | null
    is_custom: 1 | 2
}

export interface ItemListQuery {
    pageIndex: number
    pageSize: number
    type?: ItemType
    name?: string
    code?: string
    isWarning?: 1 | 2
    is_custom?: 1 | 2
}

export interface ItemCreatePayload {
    type: ItemType
    name: string
    specs?: SpecPayload[]
    warnStock?: number
    image_id?: string
    remark?: string
    is_custom?: 1 | 2
}

export interface ItemUpdatePayload {
    item_id: string
    type: ItemType
    name: string
    specs?: SpecPayload[]
    warnStock?: number
    image_id?: string
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
    start_date?: string
    end_date?: string
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

// ============ 文件上传 API ============
export const fileApi = {
    uploadFile(file: File): Promise<FileUploadResponse> {
        const formData = new FormData()
        formData.append('file', file)
        return http.post<FileUploadResponse>('/saleshub/file/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(res => res.datas)
    },

    deleteFile(relation_id: string): Promise<void> {
        return http.post('/saleshub/file/delete', { relation_id }).then(() => undefined)
    }
}

// ============ API ============
export const inventoryApi = {
    // ---- 产品 ----
    listProducts(query: ProductListQuery) {
        return http.get<PaginatedData<Product>>('/saleshub/inventory/listProducts', { params: query })
    },
    createProduct(payload: ProductCreatePayload) {
        return http.post<{ product_id: string }>('/saleshub/inventory/createProduct', payload)
    },
    updateProduct(payload: ProductUpdatePayload) {
        return http.post('/saleshub/inventory/updateProduct', payload)
    },
    deleteProduct(product_id: string) {
        return http.post('/saleshub/inventory/deleteProduct', { product_id })
    },

    // ---- 零件 ----
    listItems(query: ItemListQuery) {
        return http.get<PaginatedData<InventoryItem>>('/saleshub/inventory/listItems', { params: query })
    },
    createItem(payload: ItemCreatePayload) {
        return http.post<{ item_id: string }>('/saleshub/inventory/createItem', payload)
    },
    updateItem(payload: ItemUpdatePayload) {
        return http.post('/saleshub/inventory/updateItem', payload)
    },
    deleteItem(item_id: string) {
        return http.post('/saleshub/inventory/deleteItem', { item_id })
    },

    // ---- 产品-零件关联（全量覆盖语义）----
    setProductItems(product_id: string, items: ProductItemPayload[]) {
        return http.post('/saleshub/inventory/setProductItems', { product_id, items })
    },
    listProductItems(product_id: string) {
        return http.get<{ items: ProductItemRelation[] }>('/saleshub/inventory/listProductItems', {
            params: { product_id }
        })
    },

    // ---- 库存历史 ----
    listStockHistory(query: StockHistoryQuery) {
        return http.get<PaginatedData<StockRecord>>('/saleshub/inventory/listStockHistory', { params: query })
    },

    // ---- 入库记录列表 ----
    listStockInRecords(query: StockRecordListQuery) {
        return http.get<PaginatedData<StockInRecord>>('/saleshub/inventory/stockInList', { params: query })
    },

    // ---- 出库记录列表 ----
    listStockOutRecords(query: StockRecordListQuery) {
        return http.get<PaginatedData<StockOutRecord>>('/saleshub/inventory/stockOutList', { params: query })
    },

    // ---- 出入库操作 ----
    stockIn(payload: StockInPayload) {
        return http.post('/saleshub/inventory/stockIn', payload)
    },

    stockInBatch(payload: StockInBatchPayload) {
        return http.post('/saleshub/inventory/stockInBatch', payload)
    },

    stockOut(payload: StockOutPayload) {
        return http.post('/saleshub/inventory/stockOut', payload)
    },

    stockOutBatch(payload: StockOutBatchPayload) {
        return http.post('/saleshub/inventory/stockOutBatch', payload)
    },

    stockOutByProduct(payload: StockOutByProductPayload) {
        return http.post('/saleshub/inventory/stockOutByProduct', payload)
    }
}

export default inventoryApi
