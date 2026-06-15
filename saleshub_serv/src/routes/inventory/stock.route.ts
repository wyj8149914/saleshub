import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { StockInDto, StockOutDto, InventoryCheckDto } from '../../dto/request/inventory/stock.dto';

// 导入StockService（从service/inventory/index.ts导入单例）
import { stockService } from '../../service/inventory';

const router = Router();

/**
 * POST /in
 * 入库操作
 */
router.post(
  '/in',
  validationMiddleware(StockInDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(StockInDto, req.body);
    const result = await stockService.stockIn(dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /out
 * 出库操作
 */
router.post(
  '/out',
  validationMiddleware(StockOutDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(StockOutDto, req.body);
    const result = await stockService.stockOut(dtoObj);
    res.locals.datas = result;
    next();
  })
);

/**
 * GET /history
 * 获取库存件历史记录（入库、出库、盘点）
 * 查询参数：itemId（必填）、startDate（可选）、endDate（可选）
 */
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { itemId, startDate, endDate } = req.query;

    // 验证必填参数
    if (!itemId || typeof itemId !== 'string') {
      res.locals.datas = {
        result: 1,
        msg: 'itemId is required',
        alg: '',
        datas: null,
      };
      return next();
    }

    const result = await stockService.getHistory(
      itemId,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.locals.datas = result;
    next();
  })
);

/**
 * POST /check
 * 库存盘点操作
 */
router.post(
  '/check',
  validationMiddleware(InventoryCheckDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(InventoryCheckDto, req.body);
    const result = await stockService.inventoryCheck(dtoObj);
    res.locals.datas = result;
    next();
  })
);

export default router;
