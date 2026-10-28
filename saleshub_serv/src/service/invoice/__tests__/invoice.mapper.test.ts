import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import { Invoice } from '../../../entity/invoice.entity';
import { MixedInvoiceItem } from '../../../interface/orc.interface';
import { mapInvoiceItem } from '../invoice.mapper';

/** OCR 识别结果数据文件(invoice.json)路径 */
const OCR_DATA_PATH = path.join(__dirname, './invoice.json');

/** 读取 invoice.json 中 MixedInvoiceItems 的第一条识别结果,作为基础测试数据 */
function loadFirstItem(): MixedInvoiceItem {
    const raw = JSON.parse(fs.readFileSync(OCR_DATA_PATH, 'utf-8'));
    const items: MixedInvoiceItem[] = raw.MixedInvoiceItems;
    if (!items || items.length === 0) {
        throw new Error('invoice.json 中未找到 MixedInvoiceItems 数据');
    }
    return items[0];
}

/**
 * 基于真实识别结果构造指定类型的测试数据
 * 保留原始条目的公共元信息(Code/Page/Polygon等),仅替换 SubType 与票面内容,
 * 用于覆盖各发票类型的映射分支
 */
function makeItem(subType: string, info: Record<string, unknown>): MixedInvoiceItem {
    const base = loadFirstItem();
    return { ...base, SubType: subType, SingleInvoiceInfos: { [subType]: info } };
}

describe('mapInvoiceItem', () => {
    describe('真实OCR数据(invoice.json)', () => {
        test('全电发票 VatElectronicInvoiceFull 完整映射', () => {
            const item = loadFirstItem();
            const res = mapInvoiceItem(item);

            // 识别成功,返回 Invoice 实体
            expect(res.result).toBe(0);
            expect(res.message).toBe('识别成功');
            expect(res.data).toBeInstanceOf(Invoice);

            const invoice = res.data as Invoice;

            // 识别元信息透传
            expect(invoice.invoice_type).toBe(16);
            expect(invoice.sub_type).toBe('VatElectronicInvoiceFull');
            expect(invoice.sub_type_desc).toBe('电子发票(普通发票)');
            expect(invoice.page).toBe(1);

            // 全电发票无发票代码
            expect(invoice.invoice_code).toBeNull();
            expect(invoice.invoice_number).toBe('26352000001781090461');
            expect(dayjs(invoice.invoice_date).format('YYYY-MM-DD')).toBe('2026-07-27');

            // 金额与大写
            expect(invoice.pretax_amount).toBe('48.51');
            expect(invoice.tax_amount).toBe('0.49');
            expect(invoice.total_amount).toBe('49.00');
            expect(invoice.total_amount_cn).toBe('肆拾玖圆整');

            // 买卖方与开票人
            expect(invoice.title).toBe('电子发票(普通发票)');
            expect(invoice.seller_name).toBe('漳平市国振贸易有限公司');
            expect(invoice.seller_tax_id).toBe('91350881MA8UFTP25E');
            expect(invoice.buyer_name).toBe('深圳市光克拉科技有限公司');
            expect(invoice.buyer_tax_id).toBe('91440300MAERTR8N8K');
            expect(invoice.issuer).toBe('刘兴童');
            // 空字符串备注清洗为 null
            expect(invoice.remark).toBeNull();

            // 明细条目取 VatElectronicItems
            expect(invoice.items).toHaveLength(1);
            expect(invoice.items?.[0]).toMatchObject({ Name: '*印刷品*贴纸', TaxRate: '1%' });

            // JSONB 字段:detail 为类型特有对象,raw_response 为完整识别结果
            expect(invoice.detail).toEqual(item.SingleInvoiceInfos.VatElectronicInvoiceFull);
            expect(invoice.raw_response).toEqual(item);
        });
    });

    describe('增值税发票类(VatInvoiceInfo结构)', () => {
        test('VatSpecialInvoice 映射,含发票代码与明细', () => {
            const item = makeItem('VatSpecialInvoice', {
                Title: '深圳增值税专用发票',
                Code: '4403152130',
                Number: '12345678',
                Date: '2016年04月11日',
                PretaxAmount: '825.15',
                Tax: '46.71',
                Total: '825.15',
                TotalCn: '捌佰贰拾伍圆壹角伍分',
                Seller: '深圳市腾讯科技有限公司',
                SellerTaxID: '440300094040109',
                Buyer: '深圳市腾讯计算机系统有限公司',
                BuyerTaxID: '440300708461136',
                Remark: '发票',
                Issuer: '张三',
                VatInvoiceItemInfos: [{ Name: '技术服务费', TaxRate: '6%' }],
            });

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(0);

            const invoice = res.data as Invoice;
            expect(invoice.invoice_code).toBe('4403152130');
            expect(invoice.invoice_number).toBe('12345678');
            expect(dayjs(invoice.invoice_date).format('YYYY-MM-DD')).toBe('2016-04-11');
            expect(invoice.pretax_amount).toBe('825.15');
            expect(invoice.tax_amount).toBe('46.71');
            expect(invoice.total_amount).toBe('825.15');
            expect(invoice.total_amount_cn).toBe('捌佰贰拾伍圆壹角伍分');
            expect(invoice.remark).toBe('发票');
            expect(invoice.issuer).toBe('张三');
            // 明细条目取 VatInvoiceItemInfos
            expect(invoice.items).toEqual([{ Name: '技术服务费', TaxRate: '6%' }]);
        });
    });

    describe('机票行程单(AirTransport)', () => {
        test('税前金额取Fare,销售方取填开单位Issuer', () => {
            const item = makeItem('AirTransport', {
                Title: '航空运输电子客票行程单',
                Number: '7841234567890',
                Date: '2026年07月05日',
                Fare: '1280.00',
                Tax: '11.64',
                Total: '1280.00',
                Issuer: '中国南方航空股份有限公司',
                Buyer: '深圳市光克拉科技有限公司',
                BuyerTaxID: '91440300MAERTR8N8K',
                FlightItems: [{ FlightNumber: 'CZ3456', Seat: 'Y' }],
            });

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(0);

            const invoice = res.data as Invoice;
            expect(invoice.invoice_code).toBeNull();
            expect(invoice.invoice_number).toBe('7841234567890');
            // 税前金额取票价 Fare
            expect(invoice.pretax_amount).toBe('1280.00');
            expect(invoice.tax_amount).toBe('11.64');
            expect(invoice.total_amount).toBe('1280.00');
            // 行程单无大写金额
            expect(invoice.total_amount_cn).toBeNull();
            // 销售方为填开单位,无纳税人识别号
            expect(invoice.seller_name).toBe('中国南方航空股份有限公司');
            expect(invoice.seller_tax_id).toBeNull();
            expect(invoice.seller_name).toBe(invoice.issuer);
            expect(invoice.remark).toBeNull();
            expect(invoice.items).toEqual([{ FlightNumber: 'CZ3456', Seat: 'Y' }]);
        });
    });

    describe('铁路电子客票(ElectronicTrainTicketFull)', () => {
        test('无税额字段,价税合计为空时回退取Fare', () => {
            const item = makeItem('ElectronicTrainTicketFull', {
                TypeOfVoucher: '电子发票(铁路电子客票)',
                Number: '13382211601229000001',
                Date: '2026年07月01日',
                Fare: '55.00',
                Total: '',
                Buyer: '深圳市光克拉科技有限公司',
                BuyerTaxID: '91440300MAERTR8N8K',
            });

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(0);

            const invoice = res.data as Invoice;
            // 标题取凭证类型
            expect(invoice.title).toBe('电子发票(铁路电子客票)');
            expect(invoice.invoice_code).toBeNull();
            expect(invoice.invoice_number).toBe('13382211601229000001');
            // 无税前金额与税额
            expect(invoice.pretax_amount).toBeNull();
            expect(invoice.tax_amount).toBeNull();
            // Total 为空串,价税合计回退取票价 Fare
            expect(invoice.total_amount).toBe('55.00');
            expect(invoice.total_amount_cn).toBeNull();
            expect(invoice.seller_name).toBeNull();
            expect(invoice.seller_tax_id).toBeNull();
            expect(invoice.issuer).toBeNull();
            expect(invoice.remark).toBeNull();
            expect(invoice.items).toBeNull();
        });
    });

    describe('电子发票(航空运输电子客票行程单)', () => {
        test('ElectronicFlightTicketFull 映射', () => {
            const item = makeItem('ElectronicFlightTicketFull', {
                TypeOfVoucher: '电子发票(航空运输电子客票行程单)',
                Number: '1234567890',
                Date: '2026年07月05日',
                Fare: '1200.00',
                Tax: '10.91',
                Total: '1210.91',
                Seller: '中国南方航空股份有限公司',
                Buyer: '深圳市光克拉科技有限公司',
                BuyerTaxID: '91440300MAERTR8N8K',
                Issuer: '南航电子商务',
                FlightItems: [{ FlightNumber: 'CZ3456' }],
            });

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(0);

            const invoice = res.data as Invoice;
            expect(invoice.title).toBe('电子发票(航空运输电子客票行程单)');
            expect(invoice.invoice_code).toBeNull();
            // 税前金额取票价 Fare
            expect(invoice.pretax_amount).toBe('1200.00');
            expect(invoice.tax_amount).toBe('10.91');
            expect(invoice.total_amount).toBe('1210.91');
            // 销售方取 Seller,开票人取 Issuer
            expect(invoice.seller_name).toBe('中国南方航空股份有限公司');
            expect(invoice.seller_tax_id).toBeNull();
            expect(invoice.issuer).toBe('南航电子商务');
            expect(invoice.items).toEqual([{ FlightNumber: 'CZ3456' }]);
        });
    });

    describe('失败分支', () => {
        test('SingleInvoiceInfos 中无对应 SubType 数据,返回未识别到发票信息', () => {
            const item = loadFirstItem();
            const res = mapInvoiceItem({ ...item, SingleInvoiceInfos: {} });

            expect(res.result).toBe(1);
            expect(res.message).toBe('未识别到发票信息');
            expect(res.data).toBeUndefined();
        });

        test('票面无发票号码,返回未识别到发票号码', () => {
            const item = loadFirstItem();
            const info = {
                ...(item.SingleInvoiceInfos.VatElectronicInvoiceFull as Record<string, unknown>),
                Number: '',
            };
            item.SingleInvoiceInfos = { VatElectronicInvoiceFull: info };

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(1);
            expect(res.message).toBe('未识别到发票号码');
            expect(res.data).toBeUndefined();
        });

        test('未支持的发票类型,返回未支持的发票类型', () => {
            const item = makeItem('QuotaInvoice', { Number: '12345', Total: '100.00' });

            const res = mapInvoiceItem(item);
            expect(res.result).toBe(1);
            expect(res.message).toBe('未支持的发票类型');
            expect(res.data).toBeUndefined();
        });
    });
});
