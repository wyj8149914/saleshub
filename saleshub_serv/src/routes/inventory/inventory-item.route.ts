import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { CreateInventoryItemDto } from '../../dto/request/inventory/inventory-item.dto';
import { UpdateInventoryItemDto, UpdateStatusDto } from '../../dto/request/inventory/product.dto';

// 导入InventoryItemService（需要从service/inventory/index.ts导入单例）
import { inventoryItemService } from '../../service/inventory';

const router = Router();

/**
 * GET /inventory-items
 * 查询所有库存件（支持按type和productId过滤）
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { type, productId } = req.query;
    const result = await inventoryItemService.findAll(
      type as string | undefined,
      productId as string | undefined
    );
    res.locals.datas = result;
    next();
  })
);

/**
 * GET /inventory-items/warnings
 * 查询所有预警库存件
 */
router.get(
  '/warnings',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await inventoryItemService.findWarnings();
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /inventory-items
 * 创建新库存件
 */
router.post(
  '/',
  validationMiddleware(CreateInventoryItemDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(CreateInventoryItemDto, req.body);
    const result = await inventoryItemService.create(dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * GET /inventory-items/:id
 * 根据ID查询单个库存件
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await inventoryItemService.findOne(id);
    res.locals.datas = result;
    next();
  })
);

/**
 * PUT /inventory-items/:id
 * 更新库存件信息
 */
router.put(
  '/:id',
  validationMiddleware(UpdateInventoryItemDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const dtoObj = plainToInstance(UpdateInventoryItemDto, req.body);
    const result = await inventoryItemService.update(id, dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * DELETE /inventory-items/:id
 * 删除库存件（软删除）
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await inventoryItemService.remove(id);
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /inventory-items/:id/status
 * 更新库存件状态
 */
router.post(
  '/:id/status',
  validationMiddleware(UpdateStatusDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const dtoObj = plainToInstance(UpdateStatusDto, req.body);
    const result = await inventoryItemService.updateStatus(id, dtoObj.status);
    res.locals.datas = result;
    next();
  })
);

export default router;
