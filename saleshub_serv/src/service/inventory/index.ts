import { ProductService } from './product.service';
import { InventoryItemService } from './item.service';
import { StockService } from './stock.service';
import { ItemTypeService } from './itemType.service';
import { WarehouseService } from './warehouse.service';

// 创建服务单例
const productService = new ProductService();
const inventoryItemService = new InventoryItemService();
const stockService = new StockService();
const itemTypeService = new ItemTypeService();
const warehouseService = new WarehouseService();

export { productService, inventoryItemService, stockService, itemTypeService, warehouseService };
