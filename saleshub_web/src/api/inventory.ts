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
    start_date?: string
    end_date?: string
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
    }
}

export default inventoryApi
