import { http } from '@/utils/request';
import type {
  FileUploadResponse,
  ProductListQuery,
  ProductCreatePayload,
  ProductUpdatePayload,
  ItemListQuery,
  ItemCreatePayload,
  ItemUpdatePayload,
  ProductItemPayload,
  StockHistoryQuery,
  StockHistoryRecord,
  StockInRecord,
  StockOutRecord,
  StockInPayload,
  StockInBatchPayload,
  StockOutPayload,
  StockOutBatchPayload,
  StockOutByProductPayload,
  StockCheckRecord,
  StockCheckPayload,
  StockCheckBatchPayload,
  PaginatedData,
  Product,
  InventoryItem,
  ProductItemRelation,
  StockRecordListQuery,
  ItemTypeNode,
  ItemTypeListQuery,
  ItemTypeCreatePayload,
  ItemTypeUpdatePayload,
  ProductModule,
  ModuleCreatePayload,
  ModuleUpdatePayload,
  ProductItemsResponse,
  ProductDetailResponse,
} from '@/types/inventory';
import type { Warehouse, WarehouseListQuery, WarehouseCreatePayload, WarehouseUpdatePayload, SpecWarehouseStock, WarehouseStockItem } from '@/types/warehouse';

// ============ 文件上传 API ============
export const fileApi = {
  uploadFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return http
      .post<FileUploadResponse>('/saleshub/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.datas);
  },

  deleteFile(relation_id: string): Promise<void> {
    return http.post('/saleshub/file/delete', { relation_id }).then(() => undefined);
  },
};

// ============ API ============
export const inventoryApi = {
  // ---- 产品 ----
  listProducts(query: ProductListQuery) {
    return http.get<PaginatedData<Product>>('/saleshub/inventory/listProducts', { params: query });
  },
  createProduct(payload: ProductCreatePayload) {
    return http.post<{ product_id: string }>('/saleshub/inventory/createProduct', payload);
  },
  updateProduct(payload: ProductUpdatePayload) {
    return http.post('/saleshub/inventory/updateProduct', payload);
  },
  deleteProduct(product_id: string) {
    return http.post('/saleshub/inventory/deleteProduct', { product_id });
  },
  getProductDetail(product_id: string) {
    return http.get<ProductDetailResponse>('/saleshub/inventory/productDetail', {
      params: { product_id },
    });
  },

  // ---- 零件 ----
  listItems(query: ItemListQuery) {
    return http.get<PaginatedData<InventoryItem>>('/saleshub/inventory/listItems', {
      params: query,
    });
  },
  createItem(payload: ItemCreatePayload) {
    return http.post<{ item_id: string }>('/saleshub/inventory/createItem', payload);
  },
  updateItem(payload: ItemUpdatePayload) {
    return http.post('/saleshub/inventory/updateItem', payload);
  },
  deleteItem(item_id: string) {
    return http.post('/saleshub/inventory/deleteItem', { item_id });
  },

  // ---- 产品-零件关联（全量覆盖语义）----
  setProductItems(product_id: string, items: ProductItemPayload[]) {
    return http.post('/saleshub/inventory/setProductItems', { product_id, items });
  },
  listProductItems(product_id: string) {
    return http.get<ProductItemsResponse>('/saleshub/inventory/listProductItems', {
      params: { product_id },
    });
  },

  // ---- 模块管理 ----
  createModule(payload: ModuleCreatePayload) {
    return http.post<{ module_id: string }>('/saleshub/inventory/createModule', payload);
  },
  listModule(product_id: string) {
    return http.get<{ items: ProductModule[] }>('/saleshub/inventory/listModule', {
      params: { product_id },
    });
  },
  updateModule(payload: ModuleUpdatePayload) {
    return http.post('/saleshub/inventory/updateModule', payload);
  },
  deleteModule(module_id: string) {
    return http.post('/saleshub/inventory/deleteModule', { module_id });
  },
  setModuleItems(module_id: string, items: ProductItemPayload[]) {
    return http.post('/saleshub/inventory/setModuleItems', { module_id, items });
  },
  listModuleItems(module_id: string) {
    return http.get<{ items: ProductItemRelation[] }>('/saleshub/inventory/listModuleItems', {
      params: { module_id },
    });
  },

  // ---- 库存历史 ----
  stockHistoryList(query: StockHistoryQuery) {
    return http.get<PaginatedData<StockHistoryRecord>>('/saleshub/inventory/stockHistoryList', {
      params: query,
    });
  },

  // ---- 入库记录列表 ----
  listStockInRecords(query: StockRecordListQuery) {
    return http.get<PaginatedData<StockInRecord>>('/saleshub/inventory/stockInList', {
      params: query,
    });
  },

  // ---- 出库记录列表 ----
  listStockOutRecords(query: StockRecordListQuery) {
    return http.get<PaginatedData<StockOutRecord>>('/saleshub/inventory/stockOutList', {
      params: query,
    });
  },

  // ---- 盘点记录列表 ----
  listStockCheckRecords(query: StockRecordListQuery) {
    return http.get<PaginatedData<StockCheckRecord>>('/saleshub/inventory/stockCheckList', {
      params: query,
    });
  },

  // ---- 出入库操作 ----
  stockIn(payload: StockInPayload) {
    return http.post('/saleshub/inventory/stockIn', payload);
  },

  stockInBatch(payload: StockInBatchPayload) {
    return http.post('/saleshub/inventory/stockInBatch', payload);
  },

  stockOut(payload: StockOutPayload) {
    return http.post('/saleshub/inventory/stockOut', payload);
  },

  stockOutBatch(payload: StockOutBatchPayload) {
    return http.post('/saleshub/inventory/stockOutBatch', payload);
  },

  stockOutByProduct(payload: StockOutByProductPayload) {
    return http.post('/saleshub/inventory/stockOutByProduct', payload);
  },

  // ---- 盘点操作 ----
  stockCheck(payload: StockCheckPayload) {
    return http.post('/saleshub/inventory/stockCheck', payload);
  },

  stockCheckBatch(payload: StockCheckBatchPayload) {
    return http.post('/saleshub/inventory/stockCheckBatch', payload);
  },

  // ---- 撤销操作 ----
  revertStockIn(record_id: string) {
    return http.post('/saleshub/inventory/revertStockIn', { record_id });
  },

  revertStockOut(record_id: string) {
    return http.post('/saleshub/inventory/revertStockOut', { record_id });
  },

  // ---- 零件类型 ----
  listItemTypes(query?: ItemTypeListQuery) {
    return http.get<ItemTypeNode[]>('/saleshub/inventory/listItemTypes', { params: query });
  },
  createItemType(payload: ItemTypeCreatePayload) {
    return http.post<{ type_id: string }>('/saleshub/inventory/createItemType', payload);
  },
  updateItemType(payload: ItemTypeUpdatePayload) {
    return http.post('/saleshub/inventory/updateItemType', payload);
  },
  deleteItemType(type_id: string) {
    return http.post('/saleshub/inventory/deleteItemType', { type_id });
  },

  // ---- 仓库 ----
  listWarehouses(query?: WarehouseListQuery) {
    return http.get<Warehouse[]>('/saleshub/inventory/listWarehouses', { params: query || {} });
  },

  createWarehouse(payload: WarehouseCreatePayload) {
    return http.post('/saleshub/inventory/createWarehouse', payload);
  },

  updateWarehouse(payload: WarehouseUpdatePayload) {
    return http.post('/saleshub/inventory/updateWarehouse', payload);
  },

  deleteWarehouse(warehouse_id: string) {
    return http.post('/saleshub/inventory/deleteWarehouse', { warehouse_id });
  },

  // 查询规格在各仓库的库存分布
  listSpecWarehouseStock(spec_id: string) {
    return http.get<SpecWarehouseStock[]>('/saleshub/inventory/listSpecWarehouseStock', {
      params: { spec_id },
    });
  },

  // 查询仓库库存明细
  listWarehouseStock(warehouse_id: string) {
    return http.get<WarehouseStockItem[]>('/saleshub/inventory/listWarehouseStock', {
      params: { warehouse_id },
    });
  },
};

export default inventoryApi;
