import axios from 'axios';

// Create axios instance with baseURL from environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
});

// Generic API Response type
export interface ApiResponse<T = any> {
  result: number;
  msg: string;
  alg: string;
  datas: T;
}

// Product types
export interface Product {
  productId: string;
  name: string;
  code: string;
  description: string;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  name: string;
  code: string;
  description: string;
  specifications?: Record<string, any>;
}

export interface UpdateProductRequest {
  name?: string;
  code?: string;
  description?: string;
  specifications?: Record<string, any>;
}

// Inventory types
export enum ItemType {
  DEVICE = 'device',
  COMMON = 'common'
}

export interface InventoryItem {
  itemId: string;
  type: ItemType;
  name: string;
  code: string;
  productId?: string;
  productName?: string;
  specifications?: Record<string, any>;
  warnStock?: number;
  currentStock?: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryItemRequest {
  type: ItemType;
  name: string;
  code: string;
  productId?: string;
  specifications?: Record<string, any>;
  warnStock?: number;
}

export interface UpdateInventoryItemRequest {
  type?: ItemType;
  name?: string;
  code?: string;
  productId?: string;
  specifications?: Record<string, any>;
  warnStock?: number;
}

// Stock types
export interface StockInRequest {
  itemId: string;
  quantity: number;
  batchNumber?: string;
  notes?: string;
}

export interface StockOutRequest {
  itemId: string;
  quantity: number;
  reason?: string;
  notes?: string;
}

export interface StockRecord {
  recordId: string;
  itemId: string;
  type: 'in' | 'out';
  quantity: number;
  batchNumber?: string;
  reason?: string;
  notes?: string;
  createdAt: Date;
}

export interface InventoryCheckRequest {
  itemId: string;
  actualQuantity: number;
  notes?: string;
}

export interface InventoryWarning {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  threshold: number;
  warningLevel: 'low' | 'critical';
}

// Inventory API object
export const inventoryApi = {
  // ==================== Product Methods ====================

  /**
   * Get all products
   * GET /api/product
   */
  async getProducts(): Promise<ApiResponse<Product[]>> {
    const { data } = await api.get<ApiResponse<Product[]>>('/api/product');
    return data;
  },

  /**
   * Get a single product by ID
   * GET /api/product/:id
   */
  async getProduct(id: string): Promise<ApiResponse<Product>> {
    const { data } = await api.get<ApiResponse<Product>>(`/api/product/${id}`);
    return data;
  },

  /**
   * Create a new product
   * POST /api/product
   */
  async createProduct(product: CreateProductRequest): Promise<ApiResponse<Product>> {
    const { data } = await api.post<ApiResponse<Product>>('/api/product', product);
    return data;
  },

  /**
   * Update a product
   * PUT /api/product/:id
   */
  async updateProduct(id: string, product: UpdateProductRequest): Promise<ApiResponse<Product>> {
    const { data } = await api.put<ApiResponse<Product>>(`/api/product/${id}`, product);
    return data;
  },

  /**
   * Delete a product
   * DELETE /api/product/:id
   */
  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    const { data } = await api.delete<ApiResponse<void>>(`/api/product/${id}`);
    return data;
  },

  /**
   * Update product status
   * POST /api/product/:id/status
   */
  async updateProductStatus(id: string, status: number): Promise<ApiResponse<void>> {
    const { data } = await api.post<ApiResponse<void>>(`/api/product/${id}/status`, { status });
    return data;
  },

  // ==================== Inventory Methods ====================

  /**
   * Get inventory items with optional filters
   * GET /api/inventory
   */
  async getInventoryItems(type?: ItemType, productId?: string): Promise<ApiResponse<InventoryItem[]>> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (productId) params.productId = productId;

    const { data } = await api.get<ApiResponse<InventoryItem[]>>('/api/inventory', { params });
    return data;
  },

  /**
   * Get a single inventory item by ID
   * GET /api/inventory/:id
   */
  async getInventoryItem(id: string): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.get<ApiResponse<InventoryItem>>(`/api/inventory/${id}`);
    return data;
  },

  /**
   * Create a new inventory item
   * POST /api/inventory
   */
  async createInventoryItem(item: CreateInventoryItemRequest): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.post<ApiResponse<InventoryItem>>('/api/inventory', item);
    return data;
  },

  /**
   * Update an inventory item
   * PUT /api/inventory/:id
   */
  async updateInventoryItem(id: string, item: UpdateInventoryItemRequest): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.put<ApiResponse<InventoryItem>>(`/api/inventory/${id}`, item);
    return data;
  },

  /**
   * Delete an inventory item
   * DELETE /api/inventory/:id
   */
  async deleteInventoryItem(id: string): Promise<ApiResponse<void>> {
    const { data } = await api.delete<ApiResponse<void>>(`/api/inventory/${id}`);
    return data;
  },

  /**
   * Update inventory item status
   * POST /api/inventory/:id/status
   */
  async updateInventoryItemStatus(id: string, status: number): Promise<ApiResponse<void>> {
    const { data } = await api.post<ApiResponse<void>>(`/api/inventory/${id}/status`, { status });
    return data;
  },

  /**
   * Get inventory warnings
   * GET /api/inventory/warnings
   */
  async getWarnings(): Promise<ApiResponse<InventoryWarning[]>> {
    const { data } = await api.get<ApiResponse<InventoryWarning[]>>('/api/inventory/warnings');
    return data;
  },

  // ==================== Stock Methods ====================

  /**
   * Stock in operation
   * POST /api/stock/in
   */
  async stockIn(data: StockInRequest): Promise<ApiResponse<StockRecord>> {
    const response = await api.post<ApiResponse<StockRecord>>('/api/stock/in', data);
    return response.data;
  },

  /**
   * Stock out operation
   * POST /api/stock/out
   */
  async stockOut(data: StockOutRequest): Promise<ApiResponse<StockRecord>> {
    const response = await api.post<ApiResponse<StockRecord>>('/api/stock/out', data);
    return response.data;
  },

  /**
   * Get stock history with optional filters
   * GET /api/stock/history
   */
  async getStockHistory(
    itemId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ApiResponse<StockRecord[]>> {
    const params: Record<string, string> = { itemId };
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    const { data } = await api.get<ApiResponse<StockRecord[]>>('/api/stock/history', { params });
    return data;
  },

  /**
   * Perform inventory check
   * POST /api/stock/check
   */
  async inventoryCheck(data: InventoryCheckRequest): Promise<ApiResponse<void>> {
    const response = await api.post<ApiResponse<void>>('/api/stock/check', data);
    return response.data;
  },

  // ==================== File Methods ====================

  /**
   * Upload photo file
   * POST /api/file/upload
   */
  async uploadPhoto(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('photo', file);

    const { data } = await api.post<ApiResponse<{ url: string }>>('/api/file/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return data;
  }
};

export default inventoryApi;
