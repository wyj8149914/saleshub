import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { CreateInventoryItemDto, ItemIdDto, ListInventoryItemDto, UpdateInventoryItemDto } from '../dto/item.dto';
import {
    CreateProductDto,
    ProductIdDto,
    ListProductDto,
    UpdateProductDto,
    SetProductItemsDto,
    ProductItemIdDto,
} from '../dto/product.dto';
import { StockInDto, StockOutDto, StockCheckDto, ListStockHistoryDto } from '../dto/stock.dto';
import { productService, inventoryItemService, stockService } from '../service/inventory';

const router = Router();

// 查询库存件
router.get('/listItems',
    validationMiddleware(ListInventoryItemDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListInventoryItemDto, req.query);
        const result = await inventoryItemService.list(dtoObj);
        res.locals.datas = result;
        next();
    })
);


// 创建新库存件
router.post('/createItem',
    validationMiddleware(CreateInventoryItemDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(CreateInventoryItemDto, req.body);
        const result = await inventoryItemService.create(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 更新库存件信息
router.post('/updateItem',
    validationMiddleware(UpdateInventoryItemDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateInventoryItemDto, req.body);
        const result = await inventoryItemService.update(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 删除库存件（软删除）
router.post('/deleteItem',
    validationMiddleware(ItemIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ItemIdDto, req.body);
        const result = await inventoryItemService.delete(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询产品
router.get('/listProducts',
    validationMiddleware(ListProductDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListProductDto, req.query);
        const result = await productService.list(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 创建新产品
router.post('/createProduct',
    validationMiddleware(CreateProductDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(CreateProductDto, req.body);
        const result = await productService.create(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 更新产品信息
router.post('/updateProduct',
    validationMiddleware(UpdateProductDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateProductDto, req.body);
        const result = await productService.update(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 删除产品（软删除）
router.post('/deleteProduct',
    validationMiddleware(ProductIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ProductIdDto, req.body);
        const result = await productService.delete(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 设置产品库存件(全量覆盖)
router.post('/setProductItems',
    validationMiddleware(SetProductItemsDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(SetProductItemsDto, req.body);
        const result = await productService.setProductItems(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询产品的库存件列表
router.get('/listProductItems',
    validationMiddleware(ProductItemIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ProductItemIdDto, req.query);
        const result = await productService.getProductItems(dtoObj.product_id);
        res.locals.datas = result;
        next();
    })
);

// 入库操作
router.post('/stockIn',
    validationMiddleware(StockInDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(StockInDto, req.body);
        const result = await stockService.stockIn(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 出库操作
router.post('/stockOut',
    validationMiddleware(StockOutDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(StockOutDto, req.body);
        const result = await stockService.stockOut(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询库存件历史记录
router.get('/listStockHistory',
    validationMiddleware(ListStockHistoryDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListStockHistoryDto, req.query);
        const result = await stockService.listHistory(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 库存盘点
router.post('/stockCheck',
    validationMiddleware(StockCheckDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(StockCheckDto, req.body);
        const result = await stockService.stockCheck(dtoObj);
        res.locals.datas = result;
        next();
    })
);

export default router;
