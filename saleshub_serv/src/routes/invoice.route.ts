import { Router, Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { InvoiceOcrDto } from '../dto/invoice.dto';
import { invoiceOcrService } from '../service/invoice/ocr.service';

const router = Router();

/**
 * POST /ocr
 * 发票识别:根据文件ID从 MinIO 取文件,转 base64 调用 OCR 接口,识别结果入库
 */
router.post(
    '/ocr',
    validationMiddleware(InvoiceOcrDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(InvoiceOcrDto, req.body);
        const result = await invoiceOcrService.recognizeAndSave(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
