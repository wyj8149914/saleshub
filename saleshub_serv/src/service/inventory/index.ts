import { ProductService } from './product.service';
import { InventoryItemService } from './item.service';
import { StockService } from './stock.service';

// 创建服务单例
const productService = new ProductService();
const inventoryItemService = new InventoryItemService();
const stockService = new StockService();

export { productService, inventoryItemService, stockService, };
