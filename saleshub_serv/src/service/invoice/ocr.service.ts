import axios from 'axios';
import pLimit from 'p-limit';
import { v7 } from 'uuid';
import { QueryFailedError } from 'typeorm';
import { AppDataSource } from '../../config/database.config';
import { appConfig } from '../../config/env.config';
import { Invoice } from '../../entity/invoice.entity';
import { InvoiceOcrDto, InvoiceUploadDto } from '../../dto/invoice.dto';
import { getLogger } from '../../utils/logger.util';
import { fileService } from '../file.service';
import { mapInvoiceItem } from './invoice.mapper';
import { OrcResponse } from '../../interface/orc.interface';

/** 批量识别并发数:同时调用 OCR 的文件上限,避免压垮 OCR 服务 */
const UPLOAD_CONCURRENCY = 4;

/** 单张发票入库结果 */
interface InvoiceSaveItem {
    invoice_id: string;
    invoice_number: string;
    sub_type_desc: string | null;
    total_amount: string | null;
    /** 是否命中已有记录(重复识别) */
    is_duplicate: boolean;
}

/** 单张发票识别失败信息 */
interface InvoiceFailItem {
    page: number;
    sub_type: string;
    msg: string;
}

/** 发票OCR识别结果 */
interface OcrRecognizeResult {
    result: number;
    msg: string;
    datas?: {
        /** 已入库的发票列表 */
        invoices: InvoiceSaveItem[];

        /** 已存在的发票列表 */
        existed: InvoiceSaveItem[];

        /** 识别或入库失败的发票列表 */
        failed: InvoiceFailItem[];
    };
}

/** 上传识别的文件输入(来自 multer) */
export interface UploadFileItem {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

/** 上传识别结果(在识别结果基础上附加 relation_id 供前端关联原始文件) */
interface UploadOcrResult extends OcrRecognizeResult {
    datas?: OcrRecognizeResult['datas'] & { relation_id: string };
}

/** 批量识别的单文件结果 */
interface InvoiceFileResult {
    /** 原始文件名 */
    original_name: string;
    /** MinIO 文件ID(minio_file.relation_id),上传失败时为 null */
    relation_id: string | null;
    result: number;
    msg: string;
    /** 识别结果(invoices/existed/failed),上传或识别失败时可能为空 */
    datas?: OcrRecognizeResult['datas'];
}

/** 批量识别聚合结果 */
export interface InvoiceBatchDatas {
    results: InvoiceFileResult[];
    total: number;
    success_count: number;
    fail_count: number;
}

class InvoiceOcrService {
    private invoiceRepository = AppDataSource.getRepository(Invoice);
    private logger = getLogger('INVOICE_SERV');

    /**
     * 核心识别入库:直接使用文件 Buffer 调用 OCR,不关心文件来源
     * 流程:Buffer 转 base64 → 调用 OCR 接口 → 逐张解析入库
     * - 同一文件(如多页 PDF)可能识别出多张发票,每张各存一条记录
     * - 发票号码唯一,重复识别时返回已有记录(is_duplicate=true),不重复入库
     *
     * @param buffer 文件内容(图片或 PDF)
     * @param dto 识别参数(用户ID、文件ID、发票性质/用途可选)
     */
    async recognizeBuffer(buffer: Buffer, dto: InvoiceOcrDto): Promise<OcrRecognizeResult> {
        try {
            // 1. 调用 OCR 识别接口
            const response = await axios.post<OrcResponse>(
                appConfig.invoiceOcrUrl,
                { image_base64: buffer.toString('base64') },
                { timeout: 60_000 }
            );
            const ocrResponse = response.data;
            if (ocrResponse.result !== 0) {
                return { result: 1, msg: ocrResponse.msg };
            }
            this.logger.info('OCR识别结果:', ocrResponse);
            const items = ocrResponse.datas.MixedInvoiceItems ?? [];
            if (items.length === 0) {
                this.logger.warn('OCR未识别到发票:', { file_id: dto.file_id });
                return { result: 1, msg: '未识别到发票' };
            }

            // 2. 逐张解析入库
            const invoices: InvoiceSaveItem[] = [];
            const failed: InvoiceFailItem[] = [];
            const existed: InvoiceSaveItem[] = [];
            const now = new Date();

            for (const item of items) {
                if (item.Code !== 'OK') {
                    failed.push({
                        page: item.Page,
                        sub_type: item.SubType,
                        msg: `识别失败:${item.Code}`,
                    });
                    continue;
                }

                const mapResult = mapInvoiceItem(item);
                if (mapResult.result === 1 || !mapResult.data) {
                    failed.push({
                        page: item.Page,
                        sub_type: item.SubType,
                        msg: '发票字段解析失败',
                    });
                    continue;
                }

                // 填充主键、关联信息与识别元信息
                const invoice = mapResult.data;
                invoice.invoice_id = v7().replace(/-/g, '');
                invoice.user_id = dto.user_id;
                invoice.file_id = dto.file_id;
                if (dto.biz_type) {
                    invoice.biz_type = dto.biz_type;
                }
                if (dto.biz_id) {
                    invoice.biz_id = dto.biz_id;
                }
                // 业务属性:发票性质/用途由上传方指定
                invoice.invoice_nature = dto.invoice_nature;
                invoice.invoice_purpose = dto.invoice_purpose;
                invoice.ocr_request_id = ocrResponse.datas.RequestId;
                invoice.ocr_code = item.Code;
                invoice.status = 1;
                invoice.create_time = now;
                invoice.update_time = now;

                const saved = await this.saveInvoice(invoice);
                if (saved !== null && !saved.is_duplicate) {
                    invoices.push(saved);
                } else if (saved !== null && saved.is_duplicate) {
                    existed.push(saved);
                } else {
                    failed.push({ page: item.Page, sub_type: item.SubType, msg: '入库失败' });
                }
            }

            this.logger.info('发票识别完成:', {
                file_id: dto.file_id,
                total: items.length,
                saved: invoices.length,
                existed: existed.length,
                failed: failed.length,
            });

            return {
                result: 0,
                msg: '识别完成',
                datas: { invoices, failed, existed },
            };
        } catch (error) {
            this.logger.error('发票识别失败:', error, { file_id: dto.file_id });
            return { result: 1, msg: '识别失败' };
        }
    }

    /**
     * 上传单文件并识别入库
     * 流程:文件存 MinIO 并登记 → 直接使用接收到的 Buffer 识别入库(不再从 MinIO 读回)
     * - 识别失败时保留 MinIO 文件,前端可凭 relation_id 调 /invoice/ocr 重试
     *
     * @param file 上传的文件内容
     * @param dto 上传参数(用户ID、发票性质、发票用途)
     * @returns 识别结果(datas 中附加 relation_id 供前端关联原始文件)
     */
    async uploadAndRecognize(
        file: UploadFileItem,
        dto: InvoiceUploadDto
    ): Promise<UploadOcrResult> {
        // 1. 存 MinIO + 登记文件表(hash 去重)
        const uploadResult = await fileService.upload({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        });
        if (uploadResult.result !== 0 || !uploadResult.datas) {
            return { result: 1, msg: uploadResult.msg };
        }
        const relationId = uploadResult.datas.relation_id;

        // 2. 直接使用接收到的文件 Buffer 识别入库
        const ocrResult = await this.recognizeBuffer(file.buffer, {
            file_id: relationId,
            user_id: dto.user_id,
            invoice_nature: dto.invoice_nature,
            invoice_purpose: dto.invoice_purpose,
        });

        // 附加 relation_id 供前端关联原始文件;识别失败时下发空列表保持结构一致
        return {
            ...ocrResult,
            datas: ocrResult.datas
                ? { ...ocrResult.datas, relation_id: relationId }
                : { relation_id: relationId, invoices: [], existed: [], failed: [] },
        };
    }

    /**
     * 批量上传识别:有限并发逐文件处理,单个文件失败不影响其他文件
     *
     * @param files 上传的文件列表
     * @param dto 上传参数(所有文件共用同一发票性质/用途)
     * @returns 逐文件结果与汇总统计
     */
    async uploadBatchAndRecognize(
        files: UploadFileItem[],
        dto: InvoiceUploadDto
    ): Promise<InvoiceBatchDatas> {
        // p-limit 有限并发:同时最多 UPLOAD_CONCURRENCY 个文件在识别,Promise.all 保持结果与输入顺序一致
        const limit = pLimit(UPLOAD_CONCURRENCY);
        const results = await Promise.all(
            files.map((file) =>
                limit(async () => {
                    try {
                        const ocrResult = await this.uploadAndRecognize(file, dto);
                        return {
                            original_name: file.originalname,
                            relation_id: ocrResult.datas?.relation_id ?? null,
                            result: ocrResult.result,
                            msg: ocrResult.msg,
                            // 单文件结果中的 relation_id 已上提为条目字段,不重复下发
                            datas: ocrResult.datas
                                ? {
                                      invoices: ocrResult.datas.invoices,
                                      existed: ocrResult.datas.existed,
                                      failed: ocrResult.datas.failed,
                                  }
                                : undefined,
                        } satisfies InvoiceFileResult;
                    } catch (error) {
                        this.logger.error('批量识别单文件处理异常:', error, {
                            original_name: file.originalname,
                        });
                        return {
                            original_name: file.originalname,
                            relation_id: null,
                            result: 1,
                            msg: '处理异常',
                        } satisfies InvoiceFileResult;
                    }
                })
            )
        );

        const successCount = results.filter((item) => item.result === 0).length;
        this.logger.info('批量识别完成:', {
            total: results.length,
            success: successCount,
            failed: results.length - successCount,
        });

        return {
            results,
            total: results.length,
            success_count: successCount,
            fail_count: results.length - successCount,
        };
    }

    /**
     * 保存单张发票,处理发票号码唯一约束
     * - 已存在同号发票:返回已有记录,标记 is_duplicate=true
     * - 并发唯一冲突(23505):回查已有记录,同样标记 is_duplicate=true
     *
     * @returns 入库结果;入库异常且非重复冲突时返回 null
     */
    private async saveInvoice(invoice: Invoice): Promise<InvoiceSaveItem | null> {
        const toSaveItem = (entity: Invoice, isDuplicate: boolean): InvoiceSaveItem => ({
            invoice_id: entity.invoice_id,
            invoice_number: entity.invoice_number,
            sub_type_desc: entity.sub_type_desc,
            total_amount: entity.total_amount,
            is_duplicate: isDuplicate,
        });

        // 查重:同一发票号码只保留一条记录
        const existing = await this.invoiceRepository.findOne({
            where: { invoice_number: invoice.invoice_number },
        });
        if (existing) {
            this.logger.info('发票已存在,跳过入库:', { invoice_number: invoice.invoice_number });
            return toSaveItem(existing, true);
        }

        try {
            await this.invoiceRepository.save(invoice);
            return toSaveItem(invoice, false);
        } catch (error) {
            // 并发场景下唯一约束冲突,回查已有记录
            if (
                error instanceof QueryFailedError &&
                (error as unknown as { code?: string }).code === '23505'
            ) {
                const winner = await this.invoiceRepository.findOne({
                    where: { invoice_number: invoice.invoice_number },
                });
                if (winner) {
                    return toSaveItem(winner, true);
                }
            }
            this.logger.error('发票入库失败:', error, { invoice_number: invoice.invoice_number });
            return null;
        }
    }
}

export const invoiceOcrService = new InvoiceOcrService();
