// ============ 仓库管理 ============
export interface Warehouse {
  warehouse_id: string;
  name: string;
  location: string | null;
  status: 1 | 2;
  create_time: string;
  update_time: string | null;
}

export interface WarehouseListQuery {
  pageIndex: number;
  pageSize: number;
  name?: string;
  status?: 1 | 2;
}

export interface WarehouseCreatePayload {
  name: string;
  location?: string;
}

export interface WarehouseUpdatePayload {
  warehouse_id: string;
  name: string;
  location?: string;
}

// ============ 规格仓库库存 ============
export interface SpecWarehouseStock {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_location: string | null;
  current_stock: number;
}

// ============ 仓库库存明细 ============
export interface WarehouseStockItem {
  item_id: string;
  item_name: string;
  spec_id: string;
  spec: string;
  current_stock: number;
  warn_stock: number;
}

// ============ 规格分配仓库 ============
/**
 * 分配规格到仓库的请求参数
 */
export interface AssignSpecWarehousePayload {
  spec_id: string;
  warehouse_id: string;
  quantity: number;
}
