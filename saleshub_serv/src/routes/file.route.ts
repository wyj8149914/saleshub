import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { DeleteFileDto } from '../dto/file.dto';
import { fileService } from '../service/file.service';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
});

/**
 * POST /upload
 * 上传文件到 MinIO 并登记到 file 表
 */
router.post(
    '/upload',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            res.locals.datas = { result: 1, msg: '请选择要上传的文件' };
            next();
            return;
        }

        const result = await fileService.upload({
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });

        res.locals.datas = result;
        next();
    })
);

/**
 * POST /delete
 * 软删文件(status=2)
 */
router.post(
    '/delete',
    validationMiddleware(DeleteFileDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(DeleteFileDto, req.body);
        const result = await fileService.deleteByRelationId(dto.relation_id);
        res.locals.datas = result;
        next();
    })
);

export default router;
