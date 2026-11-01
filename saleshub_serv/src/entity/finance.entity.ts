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

    // ============ 报税状态 ============

    @Column({ type: 'int', default: 1, comment: '是否报税:1-未报税,2-已报税' })
    is_tax_filed: number;

    @Column({ type: 'timestamp', nullable: true, comment: '报税时间(取消报税时清空)' })
    tax_filed_time: Date | null;

    @Column({
        type: 'varchar',
        length: 32,
        nullable: true,
        comment: '报税操作人用户ID(取消报税时清空)',
    })
    tax_filed_by: string | null;

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

    @Column({ type: 'varchar', length: 50, nullable: true, comment: '标签' })
    tag: string | null;
}

/**
 * 销售订单实体
 *
 * 仅记整单信息(客户/联系方式/金额/交货日期),不拆产品明细行
 * - 交货状态:1-待交货,2-已交货,3-已完成,4-已取消(取消即终态,不另设软删除字段)
 * - 收款状态:由已收金额推导(0-未收,部分-部分收款,足额-已收款)
 */
@Entity({ schema: 'inventory', name: 'sales_order' })
export class SalesOrder {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    order_id: string;

    // ============ 单据信息 ============

    @Column({ type: 'varchar', length: 50, comment: '订单编号,格式XS+6位递增数字(如XS000001)' })
    order_no: string;

    @Column({ type: 'varchar', length: 100, comment: '订单名称' })
    order_title: string;

    @Column({ type: 'varchar', length: 32, comment: '创建人用户ID' })
    user_id: string;

    // ============ 客户信息 ============

    @Column({ type: 'varchar', length: 100, comment: '客户名称' })
    customer_name: string;

    @Column({ type: 'varchar', length: 20, comment: '客户联系方式' })
    customer_phone: string;

    @Column({ type: 'varchar', length: 255, nullable: true, comment: '收货地址(选填)' })
    address: string | null;

    // ============ 金额与状态 ============

    @Column({ type: 'numeric', precision: 12, scale: 2, comment: '订单金额' })
    amount: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, comment: '已收金额,默认0' })
    received_amount: string;

    @Column({
        type: 'int',
        default: 1,
        comment: '收款状态:1-未收款,2-部分收款,3-已收款(由已收金额推导落库)',
    })
    pay_status: number;

    @Column({ type: 'date', comment: '交货日期' })
    delivery_date: Date;

    @Column({ type: 'int', default: 1, comment: '订单状态:1-待交货,2-已交货,3-已完成,4-已取消' })
    order_status: number;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    remark: string | null;

    // ============ 关联信息 ============

    @Column({
        type: 'varchar',
        length: 32,
        nullable: true,
        comment: '合同文件ID(minio_file.relation_id)',
    })
    contract_file_id: string | null;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

/**
 * 支出费用单实体
 *
 * 支出费用分为两类:
 * - 1-有发票采购:关联发票(1:1),记录采购来源渠道,零件/规格/价格明细见 ExpenseItem,
 *   入库时通过 stock_in_record.expense_id 关联本表(支持分批入库)
 * - 2-无发票支出:一般为线下付款,仅记金额/分类/收款方/付款方式
 */
@Entity({ schema: 'inventory', name: 'expense' })
export class Expense {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    expense_id: string;

    // ============ 单据信息 ============

    @Column({ type: 'varchar', length: 50, comment: '费用单编号,格式ZC+6位递增数字(如ZC000001)' })
    expense_no: string;

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '费用名称' })
    expense_title: string | null;

    @Column({ type: 'int', comment: '费用类型:1-有发票采购,2-无发票支出' })
    expense_type: number;

    @Column({ type: 'varchar', length: 32, comment: '创建人用户ID' })
    user_id: string;

    // ============ 关联信息 ============

    @Column({
        type: 'varchar',
        length: 32,
        nullable: true,
        comment: '关联发票ID(invoice.invoice_id)',
    })
    invoice_id: string | null;

    // ============ 费用信息 ============

    @Column({
        type: 'int',
        nullable: true,
        comment: '采购来源渠道:1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他',
    })
    channel: number | null;

    @Column({
        type: 'varchar',
        length: 50,
        nullable: true,
        comment: '电商订单号(淘宝/京东等平台订单,线下采购为空)',
    })
    order_no: string | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, comment: '支出金额' })
    amount: string;

    @Column({ type: 'timestamp', comment: '支出日期' })
    expense_date: Date;

    @Column({
        type: 'int',
        nullable: true,
        comment: '支出分类:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他',
    })
    category: number | null;

    // ============ 支付信息 ============

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        comment: '收款方/对方名称(无发票线下付款场景常用)',
    })
    payee: string | null;

    @Column({
        type: 'int',
        nullable: true,
        comment: '付款方式:1-现金,2-微信,3-支付宝,4-银行转账,5-其他',
    })
    payment_method: number | null;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    remark: string | null;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-作废' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

/**
 * 采购明细行实体(仅费用类型1-有发票采购使用)
 *
 * 记录采购的零件/规格/数量/单价,行金额(quantity*price)由查询计算,不落库
 */
@Entity({ schema: 'inventory', name: 'expense_item' })
export class ExpenseItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    relation_id: string;

    // ============ 关联信息 ============

    @Column({ type: 'varchar', length: 32, comment: '所属支出费用单ID(expense.expense_id)' })
    expense_id: string;

    @Column({ type: 'varchar', length: 32, comment: '库存零件ID(inventory_item.item_id)' })
    item_id: string;

    @Column({ type: 'varchar', length: 32, comment: '库存规格ID(inventory_item_spec.spec_id)' })
    spec_id: string;

    // ============ 采购明细 ============

    @Column({ type: 'int', comment: '采购数量' })
    quantity: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, comment: '采购单价' })
    price: string;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    remark: string | null;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
