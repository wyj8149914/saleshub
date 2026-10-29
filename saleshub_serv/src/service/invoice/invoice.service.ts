import dayjs from 'dayjs';
import { AppDataSource } from '../../config/database.config';
import { Invoice } from '../../entity/invoice.entity';
import { MinioFile } from '../../entity/file.entity';
import { ListInvoiceDto, InvoiceIdDto } from '../../dto/invoice.dto';
import { getLogger } from '../../utils/logger.util';
import { generateFileUrl } from '../../config/minio.config';

/** 发票列表条目(轻量字段,不含明细等 JSONB 大字段) */
interface InvoiceListItem {
    invoice_id: string;
    user_id: string;
    file_id: string;
    invoice_type: number;
    sub_type: string;
    sub_type_desc: string | null;
    title: string | null;
    invoice_code: string | null;
    invoice_number: string;
    invoice_date: Date | null;
    pretax_amount: string | null;
    tax_amount: string | null;
    total_amount: string | null;
    seller_name: string | null;
    buyer_name: string | null;
    invoice_nature: number | null;
    invoice_purpose: number | null;
    status: number;
    create_time: Date;
}

/** 发票列表响应 */
interface InvoiceListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: InvoiceListItem[] };
}

/** 发票详情数据(含明细 items 与原始文件地址,排除 detail/raw_response/ocr_request_id/ocr_code) */
interface InvoiceDetailData extends Omit<InvoiceListItem, 'create_time'> {
    biz_type: string | null;
    biz_id: string | null;
    page: number | null;
    total_amount_cn: string | null;
    seller_tax_id: string | null;
    buyer_tax_id: string | null;
    remark: string | null;
    issuer: string | null;
    items: Record<string, unknown>[] | null;
    create_time: Date;
    update_time: Date;
    /** 原始发票文件(图片/PDF)预览地址 */
    file_url: string;
}

/** 发票详情响应 */
interface InvoiceDetailResult {
    result: number;
    msg: string;
    datas?: InvoiceDetailData;
}

export class InvoiceService {
    private invoiceRepository = AppDataSource.getRepository(Invoice);
    private logger = getLogger('INVOICE_SERV');

    /**
     * 分页查询发票列表(GET /invoice/list)
     * - 只查正常状态(status=1),作废发票不展示
     * - 不按用户过滤,查询全部发票
     * - 支持筛选:发票性质、发票用途、开票日期区间(含起止当天)、关键字
     *   (对发票号码/销售方名称/购买方名称模糊匹配)
     * - 按创建时间降序,返回轻量字段(不含 items 等大字段)
     *
     * @param dto 分页与筛选参数
     */
    async list(dto: ListInvoiceDto): Promise<InvoiceListResult> {
        try {
            const queryBuilder = this.invoiceRepository
                .createQueryBuilder('invoice')
                .select([
                    'invoice.invoice_id AS invoice_id',
                    'invoice.tag AS tag',
                    'invoice.user_id AS user_id',
                    'invoice.file_id AS file_id',
                    'invoice.invoice_type AS invoice_type',
                    'invoice.sub_type AS sub_type',
                    'invoice.sub_type_desc AS sub_type_desc',
                    'invoice.title AS title',
                    'invoice.invoice_code AS invoice_code',
                    'invoice.invoice_number AS invoice_number',
                    'invoice.invoice_date AS invoice_date',
                    'invoice.pretax_amount AS pretax_amount',
                    'invoice.tax_amount AS tax_amount',
                    'invoice.total_amount AS total_amount',
                    'invoice.seller_name AS seller_name',
                    'invoice.buyer_name AS buyer_name',
                    'invoice.invoice_nature AS invoice_nature',
                    'invoice.invoice_purpose AS invoice_purpose',
                    'invoice.status AS status',
                    "to_char(invoice.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('invoice.status = :status', { status: 1 });

            if (dto.invoice_nature) {
                queryBuilder.andWhere('invoice.invoice_nature = :invoiceNature', {
                    invoiceNature: dto.invoice_nature,
                });
            }
            if (dto.invoice_purpose) {
                queryBuilder.andWhere('invoice.invoice_purpose = :invoicePurpose', {
                    invoicePurpose: dto.invoice_purpose,
                });
            }
            if (dto.start_date) {
                queryBuilder.andWhere('invoice.invoice_date >= :startDate', {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                // 结束日期含当天:与「止日期次日零点」比较
                queryBuilder.andWhere('invoice.invoice_date < :endDate', {
                    endDate: dayjs(dto.end_date).add(1, 'day').format('YYYY-MM-DD'),
                });
            }
            if (dto.keyword) {
                queryBuilder.andWhere(
                    '(invoice.invoice_number LIKE :keyword ' +
                        'OR invoice.seller_name LIKE :keyword ' +
                        'OR invoice.buyer_name LIKE :keyword)',
                    { keyword: `%${dto.keyword}%` }
                );
            }
            if (dto.tag) {
                queryBuilder.andWhere('invoice.tag LIKE :tag', { tag: `%${dto.tag}%` });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('invoice.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<InvoiceListItem>();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询发票列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询发票详情(GET /invoice/detail)
     * - 只查正常状态(status=1),不存在或已作废返回「发票不存在」
     * - 返回全部票面字段与明细 items,排除 detail/raw_response/ocr_request_id/ocr_code
     * - 通过 file_id 关联 minio_file 生成原始发票文件预览地址 file_url
     *
     * @param dto 发票ID
     */
    async detail(dto: InvoiceIdDto): Promise<InvoiceDetailResult> {
        try {
            const row = await this.invoiceRepository
                .createQueryBuilder('invoice')
                .leftJoin(MinioFile, 'file', 'file.relation_id = invoice.file_id')
                .select([
                    'invoice.invoice_id AS invoice_id',
                    'invoice.tag AS tag',
                    'invoice.user_id AS user_id',
                    'invoice.file_id AS file_id',
                    'invoice.biz_type AS biz_type',
                    'invoice.biz_id AS biz_id',
                    'invoice.invoice_type AS invoice_type',
                    'invoice.sub_type AS sub_type',
                    'invoice.sub_type_desc AS sub_type_desc',
                    'invoice.page AS page',
                    'invoice.title AS title',
                    'invoice.invoice_code AS invoice_code',
                    'invoice.invoice_number AS invoice_number',
                    'invoice.invoice_date AS invoice_date',
                    'invoice.pretax_amount AS pretax_amount',
                    'invoice.tax_amount AS tax_amount',
                    'invoice.total_amount AS total_amount',
                    'invoice.total_amount_cn AS total_amount_cn',
                    'invoice.seller_name AS seller_name',
                    'invoice.seller_tax_id AS seller_tax_id',
                    'invoice.buyer_name AS buyer_name',
                    'invoice.buyer_tax_id AS buyer_tax_id',
                    'invoice.remark AS remark',
                    'invoice.issuer AS issuer',
                    'invoice.invoice_nature AS invoice_nature',
                    'invoice.invoice_purpose AS invoice_purpose',
                    'invoice.items AS items',
                    'invoice.status AS status',
                    'invoice.create_time AS create_time',
                    'invoice.update_time AS update_time',
                    'file.object_name AS file_object_name',
                ])
                .where('invoice.invoice_id = :invoiceId AND invoice.status = :status', {
                    invoiceId: dto.invoice_id,
                    status: 1,
                })
                .getRawOne();

            if (!row) {
                return { result: 1, msg: '发票不存在' };
            }

            // object_name 仅用于生成预览地址,不在响应中下发
            const { file_object_name, ...invoice } = row as Record<string, unknown> & {
                file_object_name: string | null;
            };
            const datas = {
                ...invoice,
                file_url: generateFileUrl(file_object_name ?? ''),
            } as InvoiceDetailData;

            return { result: 0, msg: 'success', datas };
        } catch (error) {
            this.logger.error('查询发票详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}
