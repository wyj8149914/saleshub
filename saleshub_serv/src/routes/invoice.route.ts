import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { BadRequestError } from '../utils/error.util';
import {
    InvoiceUploadDto,
    ListInvoiceDto,
    InvoiceIdDto,
    TaxFileInvoiceDto,
} from '../dto/invoice.dto';
import { ocrService, UploadFileItem, invoiceService } from '../service/invoice';

const router = Router();

/** 批量上传单次最多文件数 */
const MAX_BATCH_FILES = 50;

/** 单文件大小上限 5MB(转 base64 后小于腾讯云 OCR 7MB 限制) */
const MAX_FILE_SIZE = 1024 * 1024 * 5;

/**
 * 包装 multer 中间件:将 MulterError(超大小/超数量等)转换为统一格式的友好响应
 *
 * @param middleware multer 中间件
 * @param unexpectedFileMsg 字段数量/名称不符时的提示(单文件与批量场景不同)
 */
function wrapMulter(middleware: RequestHandler, unexpectedFileMsg: string): RequestHandler {
    return (req, res, next) => {
        middleware(req, res, (err: unknown) => {
            if (err instanceof multer.MulterError) {
                const msg =
                    err.code === 'LIMIT_FILE_SIZE'
                        ? `单个文件大小不能超过5MB`
                        : err.code === 'LIMIT_UNEXPECTED_FILE'
                          ? unexpectedFileMsg
                          : `文件上传失败:${err.code}`;
                res.locals.datas = { result: 1, msg };
                res.json(res.locals.datas);
                return;
            }
            next(err);
        });
    };
}

/**
 * 单文件上传中间件:类型不符直接抛业务错误(明确 400)
 */
const singleUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (isInvoiceFileType(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new BadRequestError('仅支持图片或PDF文件'));
    },
});

/**
 * 批量上传中间件:类型不符不中断请求,记录文件名后跳过,由 handler 生成失败条目
 */
const batchUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (isInvoiceFileType(file.mimetype)) {
            cb(null, true);
            return;
        }
        const reqWithRejected = req as Request & { rejected_file_names?: string[] };
        reqWithRejected.rejected_file_names = reqWithRejected.rejected_file_names ?? [];
        reqWithRejected.rejected_file_names.push(file.originalname);
        cb(null, false);
    },
});

/** 是否为发票识别支持的文件类型(图片或 PDF) */
function isInvoiceFileType(mimetype: string): boolean {
    return mimetype.startsWith('image/') || mimetype === 'application/pdf';
}

/**
 * 修复中文文件名乱码:multipart 按 latin1 传输,转回 utf8
 */
function fixFileName(originalname: string): string {
    try {
        return Buffer.from(originalname, 'latin1').toString('utf8');
    } catch {
        return originalname;
    }
}

/**
 * 将 multer 文件对象转换为识别服务输入
 */
function toUploadFileItem(file: Express.Multer.File): UploadFileItem {
    return {
        buffer: file.buffer,
        originalname: fixFileName(file.originalname),
        mimetype: file.mimetype,
        size: file.size,
    };
}

/**
 * POST /upload
 * 单文件上传识别:接收图片或 PDF,存 MinIO 后直接用接收到的文件识别入库
 * form-data: file-文件(必填), user_id-用户ID, invoice_nature-发票性质(1-实开/2-进项抵扣), invoice_purpose-发票用途(1~5)
 */
router.post(
    '/upload',
    wrapMulter(singleUpload.single('file'), '请通过 file 字段上传文件'),
    validationMiddleware(InvoiceUploadDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            res.locals.datas = { result: 1, msg: '请选择要上传的文件' };
            next();
            return;
        }
        // validationMiddleware 已将校验通过的 DTO 回写到 req.body
        const dto = req.body as InvoiceUploadDto;
        const result = await ocrService.uploadAndRecognize(toUploadFileItem(req.file), dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /uploadBatch
 * 批量上传识别:前端选择文件夹后逐个提交文件(最多 50 个),有限并发识别入库
 * form-data: files-文件列表, 其余字段同 /upload(所有文件共用同一发票性质/用途)
 */
router.post(
    '/uploadBatch',
    wrapMulter(batchUpload.array('files', MAX_BATCH_FILES), `单次最多上传${MAX_BATCH_FILES}个文件`),
    validationMiddleware(InvoiceUploadDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = req.body as InvoiceUploadDto;
        const files = ((req.files as Express.Multer.File[]) ?? []).map(toUploadFileItem);
        // 被文件类型过滤跳过的文件(fileFilter 中记录)
        const rejectedNames =
            (req as Request & { rejected_file_names?: string[] }).rejected_file_names ?? [];

        if (files.length === 0 && rejectedNames.length === 0) {
            res.locals.datas = { result: 1, msg: '请选择要上传的文件' };
            next();
            return;
        }

        const batchResult = await ocrService.uploadBatchAndRecognize(files, dto);

        // 类型不支持的文件合并为失败条目,重算汇总统计
        const rejectedResults = rejectedNames.map((name) => ({
            original_name: name,
            relation_id: null,
            result: 1,
            msg: '仅支持图片或PDF文件',
        }));
        const results = [...rejectedResults, ...batchResult.results];

        res.locals.datas = {
            result: 0,
            msg: '识别完成',
            datas: {
                results,
                total: results.length,
                success_count: batchResult.success_count,
                fail_count: rejectedResults.length + batchResult.fail_count,
            },
        };
        next();
    })
);

/**
 * GET /list
 * 分页查询发票列表:不按用户过滤,只查正常状态发票
 * Query: pageIndex/pageSize-分页(必填), invoice_nature-发票性质, invoice_purpose-发票用途,
 *       is_tax_filed-报税状态(1-未报税/2-已报税), start_date/end_date-开票日期区间(含当天,YYYY-MM-DD),
 *       keyword-关键字(发票号码/销售方/购买方模糊)
 */
router.get(
    '/list',
    validationMiddleware(ListInvoiceDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(ListInvoiceDto, req.query);
        const result = await invoiceService.list(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * GET /detail
 * 发票详情:返回票面字段与明细 items 及原始文件预览地址(不含 detail/raw_response 等大字段)
 * Query: invoice_id-发票ID(必填)
 */
router.get(
    '/detail',
    validationMiddleware(InvoiceIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(InvoiceIdDto, req.query);
        const result = await invoiceService.detail(dto);
        res.locals.datas = result;
        next();
    })
);

/**
 * POST /taxFile
 * 批量报税/取消报税:列表多选发票后一次性设置报税状态
 * Body: invoice_ids-发票ID列表(1~200个), is_tax_filed-目标报税状态(1-未报税/2-已报税),
 *       user_id-操作人用户ID
 */
router.post(
    '/taxFile',
    validationMiddleware(TaxFileInvoiceDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // validationMiddleware 已将校验通过的 DTO 回写到 req.body
        const dto = req.body as TaxFileInvoiceDto;
        const result = await invoiceService.taxFile(dto);
        res.locals.datas = result;
        next();
    })
);

export default router;
