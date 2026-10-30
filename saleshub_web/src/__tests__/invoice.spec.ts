import { describe, it, expect } from 'vitest';

import {
  INVOICE_ITEM_FIELD_LABELS,
  INVOICE_NATURE_LABELS,
  INVOICE_PURPOSE_LABELS,
  INVOICE_TAX_STATUS_LABELS,
  InvoiceNature,
  InvoicePurpose,
  InvoiceTaxStatus,
} from '@/types/invoice';
import type { Invoice } from '@/types/invoice';
import {
  INVOICE_MAX_BATCH_COUNT,
  INVOICE_MAX_FILE_SIZE_MB,
  INVOICE_MAX_TAX_COUNT,
  checkInvoiceFiles,
  formatFileSize,
  invoiceItemFieldLabel,
  sumInvoiceTotalAmount,
  validateTaxSelection,
} from '@/utils/invoice';

/** 构造指定名称、类型与大小的测试文件 */
function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('发票标签映射', () => {
  it('发票性质标签覆盖全部枚举值', () => {
    // 数字枚举存在反向映射,Object.values 会混入字符串,这里显式遍历
    [InvoiceNature.ACTUAL, InvoiceNature.DEDUCTION].forEach((v) => {
      expect(INVOICE_NATURE_LABELS[v]).toBeTruthy();
    });
    expect(INVOICE_NATURE_LABELS[InvoiceNature.ACTUAL]).toBe('实开');
    expect(INVOICE_NATURE_LABELS[InvoiceNature.DEDUCTION]).toBe('进项抵扣');
  });

  it('发票用途标签覆盖全部枚举值', () => {
    [
      InvoicePurpose.OFFICE,
      InvoicePurpose.TRAVEL,
      InvoicePurpose.COST,
      InvoicePurpose.RECEPTION,
      InvoicePurpose.EXPRESS,
    ].forEach((v) => {
      expect(INVOICE_PURPOSE_LABELS[v]).toBeTruthy();
    });
    expect(INVOICE_PURPOSE_LABELS[InvoicePurpose.OFFICE]).toBe('办公资产费');
    expect(INVOICE_PURPOSE_LABELS[InvoicePurpose.EXPRESS]).toBe('快递费');
  });
});

describe('发票文件校验', () => {
  const MB = 1024 * 1024;

  it('空文件列表整体拒绝', () => {
    const { valid, errors } = checkInvoiceFiles([]);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('批量超过 50 个整体拒绝', () => {
    const files = Array.from({ length: INVOICE_MAX_BATCH_COUNT + 1 }, () => makeFile('a.jpg', 1));
    const { valid, errors } = checkInvoiceFiles(files);
    expect(valid).toHaveLength(0);
    expect(errors[0]).toContain('50');
  });

  it('单个识别限制 1 个文件', () => {
    const files = [makeFile('a.jpg', 1), makeFile('b.jpg', 1)];
    const { valid, errors } = checkInvoiceFiles(files, 1);
    expect(valid).toHaveLength(0);
    expect(errors[0]).toContain('最多选择1个文件');
  });

  it('图片与 PDF 通过,其他类型拒绝', () => {
    const { valid, errors } = checkInvoiceFiles([
      makeFile('a.jpg', 1, 'image/jpeg'),
      makeFile('b.png', 1, 'image/png'),
      makeFile('c.pdf', 1, 'application/pdf'),
      makeFile('d.txt', 1, 'text/plain'),
    ]);
    expect(valid).toHaveLength(3);
    expect(errors).toEqual(['d.txt:仅支持图片或PDF文件']);
  });

  it('type 为空时按扩展名兜底识别', () => {
    const { valid, errors } = checkInvoiceFiles([
      makeFile('a.PDF', 1, ''),
      makeFile('b.jpg', 1, ''),
      makeFile('c.docx', 1, ''),
    ]);
    expect(valid).toHaveLength(2);
    expect(errors).toEqual(['c.docx:仅支持图片或PDF文件']);
  });

  it('文件大小恰好 5MB 通过,超过 5MB 拒绝', () => {
    const { valid, errors } = checkInvoiceFiles([
      makeFile('ok.pdf', INVOICE_MAX_FILE_SIZE_MB * MB, 'application/pdf'),
      makeFile('big.pdf', INVOICE_MAX_FILE_SIZE_MB * MB + 1, 'application/pdf'),
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0]?.name).toBe('ok.pdf');
    expect(errors).toEqual([`big.pdf:单个文件大小不能超过${INVOICE_MAX_FILE_SIZE_MB}MB`]);
  });

  it('混合列表保持通过文件的提交顺序', () => {
    const { valid } = checkInvoiceFiles([
      makeFile('big.pdf', 6 * MB, 'application/pdf'),
      makeFile('a.jpg', 1),
      makeFile('bad.txt', 1, 'text/plain'),
      makeFile('b.pdf', 1, 'application/pdf'),
    ]);
    expect(valid.map((f) => f.name)).toEqual(['a.jpg', 'b.pdf']);
  });
});

describe('发票明细字段翻译', () => {
  it('常见字段映射为中文', () => {
    expect(invoiceItemFieldLabel('LineItemName')).toBe('项目名称');
    expect(invoiceItemFieldLabel('AmountWithoutTax')).toBe('金额');
  });

  it('未知字段保留原名', () => {
    expect(invoiceItemFieldLabel('CustomField')).toBe('CustomField');
  });

  it('映射表无空值', () => {
    Object.values(INVOICE_ITEM_FIELD_LABELS).forEach((label) => expect(label).toBeTruthy());
  });
});

describe('文件大小格式化', () => {
  it('按 B/KB/MB 展示', () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(356 * 1024)).toBe('356 KB');
    expect(formatFileSize(512)).toBe('512 B');
  });
});

describe('发票报税', () => {
  /** 构造仅报税状态不同的最小发票对象 */
  function makeInvoice(isTaxFiled: number): Invoice {
    return {
      invoice_id: `id-${isTaxFiled}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: 'u1',
      file_id: 'f1',
      invoice_type: 16,
      sub_type: 'VatElectronicInvoiceFull',
      sub_type_desc: null,
      title: null,
      invoice_code: null,
      invoice_number: '12345678',
      invoice_date: null,
      pretax_amount: null,
      tax_amount: null,
      total_amount: null,
      seller_name: null,
      buyer_name: null,
      invoice_nature: null,
      invoice_purpose: null,
      is_tax_filed: isTaxFiled,
      tax_filed_time: null,
      tax_filed_by: null,
      status: 1,
      create_time: '2026-01-01 00:00:00',
    };
  }

  it('报税状态标签覆盖全部枚举值', () => {
    [InvoiceTaxStatus.NOT_FILED, InvoiceTaxStatus.FILED].forEach((v) => {
      expect(INVOICE_TAX_STATUS_LABELS[v]).toBeTruthy();
    });
    expect(INVOICE_TAX_STATUS_LABELS[InvoiceTaxStatus.NOT_FILED]).toBe('未报税');
    expect(INVOICE_TAX_STATUS_LABELS[InvoiceTaxStatus.FILED]).toBe('已报税');
  });

  it('报税选择校验:空选中拒绝', () => {
    const { valid, msg } = validateTaxSelection([], InvoiceTaxStatus.FILED);
    expect(valid).toBe(false);
    expect(msg).toBeTruthy();
  });

  it('报税选择校验:超过 200 条拒绝', () => {
    const records = Array.from({ length: INVOICE_MAX_TAX_COUNT + 1 }, () => makeInvoice(InvoiceTaxStatus.NOT_FILED));
    const { valid, msg } = validateTaxSelection(records, InvoiceTaxStatus.FILED);
    expect(valid).toBe(false);
    expect(msg).toContain('200');
  });

  it('报税时选中含已报税行拒绝', () => {
    const records = [
      makeInvoice(InvoiceTaxStatus.NOT_FILED),
      makeInvoice(InvoiceTaxStatus.FILED),
    ];
    const { valid } = validateTaxSelection(records, InvoiceTaxStatus.FILED);
    expect(valid).toBe(false);
  });

  it('取消报税时选中含未报税行拒绝', () => {
    const records = [
      makeInvoice(InvoiceTaxStatus.FILED),
      makeInvoice(InvoiceTaxStatus.NOT_FILED),
    ];
    const { valid } = validateTaxSelection(records, InvoiceTaxStatus.NOT_FILED);
    expect(valid).toBe(false);
  });

  it('全部状态与目标一致的合法选中通过', () => {
    const notFiled = [makeInvoice(InvoiceTaxStatus.NOT_FILED), makeInvoice(InvoiceTaxStatus.NOT_FILED)];
    expect(validateTaxSelection(notFiled, InvoiceTaxStatus.FILED).valid).toBe(true);

    const filed = [makeInvoice(InvoiceTaxStatus.FILED), makeInvoice(InvoiceTaxStatus.FILED)];
    expect(validateTaxSelection(filed, InvoiceTaxStatus.NOT_FILED).valid).toBe(true);
  });

  it('价税合计汇总:累加金额,空值不计入,保留两位小数', () => {
    const records = [
      { ...makeInvoice(InvoiceTaxStatus.NOT_FILED), total_amount: '100.50' },
      { ...makeInvoice(InvoiceTaxStatus.NOT_FILED), total_amount: '200.25' },
      { ...makeInvoice(InvoiceTaxStatus.NOT_FILED), total_amount: null },
    ];
    expect(sumInvoiceTotalAmount(records)).toBe('300.75');
  });

  it('价税合计汇总:空列表为 0.00,浮点精度修正为两位小数', () => {
    expect(sumInvoiceTotalAmount([])).toBe('0.00');
    const records = [
      { ...makeInvoice(InvoiceTaxStatus.NOT_FILED), total_amount: '0.1' },
      { ...makeInvoice(InvoiceTaxStatus.NOT_FILED), total_amount: '0.2' },
    ];
    expect(sumInvoiceTotalAmount(records)).toBe('0.30');
  });
});
