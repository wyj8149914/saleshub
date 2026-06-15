import { ProductService } from './product.service';
import { InventoryItemService } from './inventory-item.service';
import { StockService } from './stock.service';
import { FileService } from './file.service';

// 创建服务单例
const productService = new ProductService();
const inventoryItemService = new InventoryItemService();
const stockService = new StockService();
const fileService = new FileService();

export {
  productService,
  inventoryItemService,
  stockService,
  fileService,
};
