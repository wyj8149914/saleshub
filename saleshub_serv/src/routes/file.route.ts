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
    limits: {
        fileSize: 1024 * 1024 * 10, // 10MB
    },
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
        let originalName = '';
        try {
            originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (error) {
            originalName = req.file.originalname;
        }
        const result = await fileService.upload({
            buffer: req.file.buffer,
            originalname: originalName,
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
