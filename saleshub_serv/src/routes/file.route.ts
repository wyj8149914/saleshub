import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware';

// 导入fileService（需要从service/inventory/index.ts导入单例）
import { fileService } from '../../service/inventory';

const router = Router();

// 配置multer使用内存存储
const upload = multer({
    storage: multer.memoryStorage(),
});

/**
 * POST /upload
 * 上传照片文件
 */
router.post(
    '/upload',
    upload.single('photo'),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // 检查文件是否存在
        if (!req.file) {
            return res.status(400).json({
                result: 1,
                msg: '请选择要上传的文件',
                alg: '',
                datas: null,
            });
        }

        // 调用fileService上传文件
        const result = await fileService.uploadPhoto({
            buffer: req.file.buffer,
            originalname: req.file.originalname,
        });

        // 根据任务要求，返回 {result: 0, msg: '上传成功', datas: {url}} 或错误
        if (result.result === 0) {
            res.locals.datas = {
                result: 0,
                msg: '上传成功',
                datas: { url: result.datas?.photoUrl },
            };
        } else {
            res.locals.datas = result;
        }
        next();
    })
);

export default router;
