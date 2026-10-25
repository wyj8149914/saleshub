import axios from 'axios';
import { v7 } from 'uuid';
import { QueryFailedError } from 'typeorm';
import { AppDataSource } from '../../config/database.config';
import { getFileBuffer } from '../../config/minio.config';
import { appConfig } from '../../config/env.config';
import { MinioFile } from '../../entity/file.entity';
import { Invoice } from '../../entity/invoice.entity';
import { InvoiceOcrDto } from '../../dto/invoice.dto';
import { getLogger } from '../../utils/logger.util';
import { mapInvoiceItem } from './invoice.mapper';

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

class InvoiceOcrService {
    private invoiceRepository = AppDataSource.getRepository(Invoice);
    private fileRepository = AppDataSource.getRepository(MinioFile);
    private logger = getLogger('INVOICE_SERV');

    /**
     * 识别发票并保存
     * 流程:根据 file_id 从 MinIO 取文件 → 转 base64 → 调用 OCR 接口 → 逐张解析入库
     * - 同一文件(如多页 PDF)可能识别出多张发票,每张各存一条记录
     * - 发票号码唯一,重复识别时返回已有记录(is_duplicate=true),不重复入库
     *
     * @param dto 识别请求参数(文件ID、用户ID、业务单据预留字段)
     */
    async recognizeAndSave(dto: InvoiceOcrDto): Promise<OcrRecognizeResult> {
        try {
            // 1. 查询原始文件记录
            const file = await this.fileRepository.findOne({
                where: { relation_id: dto.file_id, status: 1 },
            });
            if (!file) {
                return { result: 1, msg: '文件不存在' };
            }

            // 2. 从 MinIO 取文件内容并转 base64
            const buffer = await getFileBuffer(file.bucket, file.object_name);
            const imageBase64 = buffer.toString('base64');

            // 3. 调用 OCR 识别接口
            const response = await axios.post<OrcResponse>(
                appConfig.invoiceOcrUrl,
                { image_base64: imageBase64 },
                { timeout: 60_000 }
            );
            const ocrResponse = response.data;
            const items = ocrResponse?.MixedInvoiceItems ?? [];
            if (items.length === 0) {
                this.logger.warn('OCR未识别到发票:', { file_id: dto.file_id });
                return { result: 1, msg: '未识别到发票' };
            }

            // 4. 逐张解析入库
            const invoices: InvoiceSaveItem[] = [];
            const failed: InvoiceFailItem[] = [];
            const existed: InvoiceSaveItem[] = [];
            const now = new Date();

            for (const item of items) {
                if (item.Code !== 'OK') {
                    failed.push({ page: item.Page, sub_type: item.SubType, msg: `识别失败:${item.Code}` });
                    continue;
                }

                const mapResult = mapInvoiceItem(item);
                if (mapResult.result === 1 || !mapResult.data) {
                    failed.push({ page: item.Page, sub_type: item.SubType, msg: '发票字段解析失败' });
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
                invoice.ocr_request_id = ocrResponse.RequestId;
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
            this.logger.error('发票识别失败:', error);
            return { result: 1, msg: '识别失败' };
        }
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
            if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === '23505') {
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
