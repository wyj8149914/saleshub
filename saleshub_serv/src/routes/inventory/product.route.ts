import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { CreateProductDto, UpdateProductDto, UpdateStatusDto } from '../../dto/request/inventory/product.dto';

// 导入ProductService（需要从service/inventory/index.ts导入单例）
import { productService } from '../../service/inventory';

const router = Router();

/**
 * GET /products
 * 查询所有产品
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await productService.findAll();
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /products
 * 创建新产品
 */
router.post(
  '/',
  validationMiddleware(CreateProductDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(CreateProductDto, req.body);
    const result = await productService.create(dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * GET /products/:id
 * 根据ID查询单个产品
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await productService.findOne(id);
    res.locals.datas = result;
    next();
  })
);

/**
 * PUT /products/:id
 * 更新产品信息
 */
router.put(
  '/:id',
  validationMiddleware(UpdateProductDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const dtoObj = plainToInstance(UpdateProductDto, req.body);
    const result = await productService.update(id, dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * DELETE /products/:id
 * 删除产品（软删除）
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await productService.remove(id);
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /products/:id/status
 * 更新产品状态
 */
router.post(
  '/:id/status',
  validationMiddleware(UpdateStatusDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const dtoObj = plainToInstance(UpdateStatusDto, req.body);
    const result = await productService.updateStatus(id, dtoObj.status);
    res.locals.datas = result;
    next();
  })
);

export default router;
