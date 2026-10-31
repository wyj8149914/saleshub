import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Invoice } from '../../entity/finance.entity';
import { MixedInvoiceItem } from '../../interface/orc.interface';

// 启用自定义格式解析,支持「2026年07月27日」格式的开票日期
dayjs.extend(customParseFormat);

/** 增值税发票类 SubType,对应 SingleInvoiceInfos 中的 VatInvoiceInfo 结构 */
const VAT_INVOICE_SUBTYPES = [
    'VatSpecialInvoice',
    'VatCommonInvoice',
    'VatElectronicCommonInvoice',
    'VatElectronicSpecialInvoice',
    'VatElectronicInvoiceBlockchain',
    'VatElectronicInvoiceToll',
];

/** 全电发票类 SubType,对应 SingleInvoiceInfos 中的 VatElectronicInfo 结构 */
const VAT_ELECTRONIC_SUBTYPES = ['VatElectronicSpecialInvoiceFull', 'VatElectronicInvoiceFull'];

/** 机票行程单类 SubType,对应 SingleInvoiceInfos 中的 AirTransport 结构 */
const AIR_TRANSPORT_SUBTYPES = ['AirTransport'];

/** 字段值清洗:去空白,空串返回 null */
function s(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

/** 金额清洗:仅保留合法数字字符串(如 "478.00"),非法返回 null */
function n(value: unknown): string | null {
    const str = String(value);
    return /^-?\d+(\.\d+)?$/.test(str) ? str : null;
}

/**
 * 将腾讯云 OCR 混合发票识别的单条结果映射为 Invoice 实体
 * 仅填充票面公共字段与 JSONB 字段,关联信息(用户/文件)和主键由调用方填充
 *
 * @param item MixedInvoiceItems 中的一条识别结果(要求 Code === 'OK')
 * @returns 填充后的 Invoice 实体;无法解析出发票号码时返回 null
 */
export function mapInvoiceItem(item: MixedInvoiceItem) {
    const invoice = new Invoice();
    const infos = item.SingleInvoiceInfos ?? {};
    const info = (infos[item.SubType] ?? null) as Record<string, unknown> | null;

    invoice.invoice_type = item.Type;
    invoice.sub_type = item.SubType;
    invoice.sub_type_desc = item.SubTypeDescription;
    invoice.page = item.Page;
    invoice.detail = info;
    invoice.raw_response = item;

    if (!info) {
        return { result: 1, message: '未识别到发票信息' };
    }

    if (VAT_INVOICE_SUBTYPES.includes(item.SubType)) {
        // 增值税发票(含纸质/电子/区块链/通行费)
        invoice.title = s(info.Title);
        invoice.invoice_code = s(info.Code);
        invoice.invoice_number = s(info.Number) ?? '';
        invoice.invoice_date = s(info.Date) ? dayjs(s(info.Date), 'YYYY年MM月DD日').toDate() : null;
        invoice.pretax_amount = n(info.PretaxAmount);
        invoice.tax_amount = n(info.Tax);
        invoice.total_amount = n(info.Total);
        invoice.total_amount_cn = s(info.TotalCn);
        invoice.seller_name = s(info.Seller);
        invoice.seller_tax_id = s(info.SellerTaxID);
        invoice.buyer_name = s(info.Buyer);
        invoice.buyer_tax_id = s(info.BuyerTaxID);
        invoice.remark = s(info.Remark);
        invoice.issuer = s(info.Issuer);
        invoice.items = (info.VatInvoiceItemInfos ?? null) as Record<string, unknown>[] | null;
    } else if (VAT_ELECTRONIC_SUBTYPES.includes(item.SubType)) {
        // 全电发票(电子发票(普通发票)/电子发票(专用发票)),无发票代码
        invoice.title = s(info.Title);
        invoice.invoice_code = null;
        invoice.invoice_number = s(info.Number) ?? '';
        invoice.invoice_date = s(info.Date) ? dayjs(s(info.Date), 'YYYY年MM月DD日').toDate() : null;
        invoice.pretax_amount = n(info.PretaxAmount);
        invoice.tax_amount = n(info.Tax);
        invoice.total_amount = n(info.Total);
        invoice.total_amount_cn = s(info.TotalCn);
        invoice.seller_name = s(info.Seller);
        invoice.seller_tax_id = s(info.SellerTaxID);
        invoice.buyer_name = s(info.Buyer);
        invoice.buyer_tax_id = s(info.BuyerTaxID);
        invoice.remark = s(info.Remark);
        invoice.issuer = s(info.Issuer);
        invoice.items = (info.VatElectronicItems ?? null) as Record<string, unknown>[] | null;
    } else if (AIR_TRANSPORT_SUBTYPES.includes(item.SubType)) {
        // 机票行程单:税前金额取票价 Fare,销售方为填开单位 Issuer
        invoice.title = s(info.Title);
        invoice.invoice_code = null;
        invoice.invoice_number = s(info.Number) ?? '';
        invoice.invoice_date = s(info.Date) ? dayjs(s(info.Date), 'YYYY年MM月DD日').toDate() : null;
        invoice.pretax_amount = n(info.Fare);
        invoice.tax_amount = n(info.Tax);
        invoice.total_amount = n(info.Total);
        invoice.total_amount_cn = null;
        invoice.seller_name = s(info.Issuer);
        invoice.seller_tax_id = null;
        invoice.buyer_name = s(info.Buyer);
        invoice.buyer_tax_id = s(info.BuyerTaxID);
        invoice.remark = null;
        invoice.issuer = s(info.Issuer);
        invoice.items = (info.FlightItems ?? null) as Record<string, unknown>[] | null;
    } else if (item.SubType === 'ElectronicTrainTicketFull') {
        // 铁路电子客票:无税额字段,价税合计取票价 Fare
        invoice.title = s(info.TypeOfVoucher);
        invoice.invoice_code = null;
        invoice.invoice_number = s(info.Number) ?? '';
        invoice.invoice_date = s(info.Date) ? dayjs(s(info.Date), 'YYYY年MM月DD日').toDate() : null;
        invoice.pretax_amount = null;
        invoice.tax_amount = null;
        invoice.total_amount = n(info.Total) ?? n(info.Fare);
        invoice.total_amount_cn = null;
        invoice.seller_name = null;
        invoice.seller_tax_id = null;
        invoice.buyer_name = s(info.Buyer);
        invoice.buyer_tax_id = s(info.BuyerTaxID);
        invoice.remark = null;
        invoice.issuer = null;
        invoice.items = null;
    } else if (item.SubType === 'ElectronicFlightTicketFull') {
        // 电子发票(航空运输电子客票行程单)
        invoice.title = s(info.TypeOfVoucher);
        invoice.invoice_code = null;
        invoice.invoice_number = s(info.Number) ?? '';
        invoice.invoice_date = s(info.Date) ? dayjs(s(info.Date), 'YYYY年MM月DD日').toDate() : null;
        invoice.pretax_amount = n(info.Fare);
        invoice.tax_amount = n(info.Tax);
        invoice.total_amount = n(info.Total);
        invoice.total_amount_cn = null;
        invoice.seller_name = s(info.Seller);
        invoice.seller_tax_id = null;
        invoice.buyer_name = s(info.Buyer);
        invoice.buyer_tax_id = s(info.BuyerTaxID);
        invoice.remark = null;
        invoice.issuer = s(info.Issuer);
        invoice.items = (info.FlightItems ?? null) as Record<string, unknown>[] | null;
    } else {
        // 未支持的发票类型:公共字段尽量透传,明细不解析
        return { result: 1, message: '未支持的发票类型' };
    }

    if (!invoice.invoice_number) {
        return { result: 1, message: '未识别到发票号码' };
    }
    return { result: 0, message: '识别成功', data: invoice };
}
