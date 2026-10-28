import { Entity, Column, PrimaryColumn } from 'typeorm';
import { MixedInvoiceItem } from '../interface/orc.interface';

/**
 * 发票识别结果实体
 *
 * 存储腾讯云 OCR 混合发票识别(MixedInvoiceOCR)结果:
 * - 公共票面字段(发票号、金额、买卖方等)结构化存储,便于业务查询统计
 * - 明细条目、类型特有字段、原始识别结果以 JSONB 存储,防止字段缺失
 * - 同一张发票通过发票号码唯一约束防重
 */
@Entity({ schema: 'inventory', name: 'invoice' })
export class Invoice {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    invoice_id: string;

    // ============ 关联信息 ============

    @Column({ type: 'varchar', length: 32, comment: '识别用户ID' })
    user_id: string;

    @Column({ type: 'varchar', length: 32, comment: '原始文件ID(minio_file.relation_id)' })
    file_id: string;

    @Column({ type: 'varchar', length: 20, nullable: true, comment: '业务单据类型(预留)' })
    biz_type: string | null;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '业务单据ID(预留)' })
    biz_id: string | null;

    // ============ 识别元信息 ============

    @Column({ type: 'varchar', length: 64, comment: '腾讯云OCR请求ID(RequestId)' })
    ocr_request_id: string;

    @Column({ type: 'varchar', length: 64, comment: '识别状态码:OK-成功,其它见腾讯云错误码' })
    ocr_code: string;

    @Column({ type: 'int', comment: '发票类型:16-全电发票等,见腾讯云MixedInvoiceOCR文档' })
    invoice_type: number;

    @Column({
        type: 'varchar',
        length: 64,
        comment: '发票详细类型SubType,如VatElectronicInvoiceFull',
    })
    sub_type: string;

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '发票详细类型描述' })
    sub_type_desc: string | null;

    @Column({ type: 'int', nullable: true, comment: '发票所在图片/PDF页码,从1开始' })
    page: number | null;

    // ============ 公共票面字段 ============

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '发票名称' })
    title: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true, comment: '发票代码(全电发票为空)' })
    invoice_code: string | null;

    @Column({ type: 'varchar', length: 32, comment: '发票号码' })
    invoice_number: string;

    @Column({
        type: 'varchar',
        length: 20,
        nullable: true,
        comment: '开票日期(原始格式,如2026年09月09日)',
    })
    invoice_date: Date | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, comment: '税前金额' })
    pretax_amount: string | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, comment: '合计税额' })
    tax_amount: string | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, comment: '价税合计' })
    total_amount: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '价税合计大写' })
    total_amount_cn: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true, comment: '销售方名称' })
    seller_name: string | null;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '销售方纳税人识别号' })
    seller_tax_id: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true, comment: '购买方名称' })
    buyer_name: string | null;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '购买方纳税人识别号' })
    buyer_tax_id: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    remark: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true, comment: '开票人' })
    issuer: string | null;

    // ============ 业务属性 ============

    @Column({ type: 'int', nullable: true, comment: '发票性质:1-实开,2-进项抵扣' })
    invoice_nature: number | null;

    @Column({
        type: 'int',
        nullable: true,
        comment: '发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费',
    })
    invoice_purpose: number | null;

    // ============ JSONB 数据 ============

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: '明细条目数组(VatElectronicItems/VatInvoiceItemInfos)',
    })
    items: Record<string, unknown>[] | null;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: '类型特有字段完整对象(SingleInvoiceInfos中对应类型的值,含铁路车次/机票航段等)',
    })
    detail: Record<string, unknown> | null;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: '完整识别结果(MixedInvoiceItem,含坐标/印章信息)',
    })
    raw_response: MixedInvoiceItem | null;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用/作废' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
