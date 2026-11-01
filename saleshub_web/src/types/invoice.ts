// ============ 发票枚举 ============

/** 发票性质:1-实开,2-进项抵扣 */
export enum InvoiceNature {
  /** 实开 */
  ACTUAL = 1,
  /** 进项抵扣 */
  DEDUCTION = 2,
}

/** 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费 */
export enum InvoicePurpose {
  /** 办公资产费 */
  OFFICE = 1,
  /** 差旅费 */
  TRAVEL = 2,
  /** 成本费 */
  COST = 3,
  /** 接待费 */
  RECEPTION = 4,
  /** 快递费 */
  EXPRESS = 5,
}

/** 发票报税状态:1-未报税,2-已报税 */
export enum InvoiceTaxStatus {
  /** 未报税 */
  NOT_FILED = 1,
  /** 已报税 */
  FILED = 2,
}

// ============ 标签映射 ============

/** 发票性质中文标签映射 */
export const INVOICE_NATURE_LABELS: Record<number, string> = {
  [InvoiceNature.ACTUAL]: '实开',
  [InvoiceNature.DEDUCTION]: '进项抵扣',
};

/** 发票用途中文标签映射 */
export const INVOICE_PURPOSE_LABELS: Record<number, string> = {
  [InvoicePurpose.OFFICE]: '办公资产费',
  [InvoicePurpose.TRAVEL]: '差旅费',
  [InvoicePurpose.COST]: '成本费',
  [InvoicePurpose.RECEPTION]: '接待费',
  [InvoicePurpose.EXPRESS]: '快递费',
};

/** 发票明细常见字段中文映射(未命中时展示原始字段名) */
export const INVOICE_ITEM_FIELD_LABELS: Record<string, string> = {
  LineItemName: '项目名称',
  Spec: '规格',
  Unit: '单位',
  Quantity: '数量',
  UnitPrice: '单价',
  AmountWithoutTax: '金额',
  TaxRate: '税率',
  AmountWithTax: '税额',
  Tax: '税额',
  Name: '名称',
  Price: '单价',
  Total: '合计',
};

/** 报税状态中文标签映射 */
export const INVOICE_TAX_STATUS_LABELS: Record<number, string> = {
  [InvoiceTaxStatus.NOT_FILED]: '未报税',
  [InvoiceTaxStatus.FILED]: '已报税',
};

// ============ 列表与详情 ============

/** 发票列表查询参数 */
export interface InvoiceListQuery {
  pageIndex: number;
  pageSize: number;
  /** 发票性质:1-实开,2-进项抵扣(可选) */
  invoice_nature?: number;
  /** 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费(可选) */
  invoice_purpose?: number;
  /** 报税状态:1-未报税,2-已报税(可选) */
  is_tax_filed?: number;
  /** 开票日期起(含当天),YYYY-MM-DD(可选) */
  start_date?: string;
  /** 开票日期止(含当天),YYYY-MM-DD(可选) */
  end_date?: string;
  /** 关键字,对发票号码/销售方名称/购买方名称模糊匹配(可选) */
  keyword?: string;
  /** 标签,对标签模糊匹配(可选) */
  tag?: string;
}

/** 发票列表项(轻量票面字段,不含明细) */
export interface Invoice {
  /** 发票主键 UUID(无连字符,32 位) */
  invoice_id: string;
  /** 识别用户 ID */
  user_id: string;
  /** 原始文件 ID(minio_file.relation_id) */
  file_id: string;
  /** 发票类型(腾讯云 MixedInvoiceOCR,如 16-全电发票) */
  invoice_type: number;
  /** 发票详细类型,如 VatElectronicInvoiceFull */
  sub_type: string;
  /** 发票详细类型描述,如「电子发票(普通发票)」,可能为 null */
  sub_type_desc: string | null;
  /** 发票名称,可能为 null */
  title: string | null;
  /** 发票代码,全电发票为 null */
  invoice_code: string | null;
  /** 发票号码 */
  invoice_number: string;
  /** 开票日期,ISO 日期时间字符串,可能为 null */
  invoice_date: string | null;
  /** 税前金额,数字字符串,可能为 null */
  pretax_amount: string | null;
  /** 合计税额,数字字符串,可能为 null */
  tax_amount: string | null;
  /** 价税合计,数字字符串,可能为 null */
  total_amount: string | null;
  /** 销售方名称,可能为 null */
  seller_name: string | null;
  /** 购买方名称,可能为 null */
  buyer_name: string | null;
  /** 发票性质:1-实开,2-进项抵扣,可能为 null */
  invoice_nature: number | null;
  /** 发票用途,可能为 null */
  invoice_purpose: number | null;
  /** 是否报税:1-未报税,2-已报税 */
  is_tax_filed: number;
  /** 报税时间,未报税或已取消报税时为 null */
  tax_filed_time: string | null;
  /** 报税操作人用户 ID,未报税或已取消报税时为 null */
  tax_filed_by: string | null;
  /** 状态:1-正常 */
  status: number;
  /** 入库时间,ISO 日期时间字符串 */
  create_time: string;
}

/** 未绑定支出费用单的实开发票列表 datas(不分页,无 total) */
export interface UnboundInvoiceListData {
  /** 未绑定费用单的实开发票列表,字段结构同 Invoice */
  items: Invoice[];
}

/** 发票明细条目,字段随发票类型不同 */
export type InvoiceItemEntry = Record<string, unknown>;

/** 发票详情(完整票面字段 + 明细条目 + 原文件预览地址) */
export interface InvoiceDetail extends Invoice {
  /** 业务单据类型(预留字段),可能为 null */
  biz_type: string | null;
  /** 业务单据 ID(预留字段),可能为 null */
  biz_id: string | null;
  /** 发票所在图片/PDF 页码,从 1 开始,可能为 null */
  page: number | null;
  /** 价税合计大写,可能为 null */
  total_amount_cn: string | null;
  /** 销售方纳税人识别号,可能为 null */
  seller_tax_id: string | null;
  /** 购买方纳税人识别号,可能为 null */
  buyer_tax_id: string | null;
  /** 备注,可能为 null */
  remark: string | null;
  /** 开票人,可能为 null */
  issuer: string | null;
  /** 明细条目数组,字段随发票类型不同,可能为 null */
  items: InvoiceItemEntry[] | null;
  /** 更新时间,ISO 日期时间字符串 */
  update_time: string;
  /** 原始发票文件预览地址,文件缺失时为空字符串 */
  file_url: string;
}

// ============ 识别上传结果 ============

/** 识别入库的发票摘要(新入库与已存在结构相同,以 is_duplicate 区分) */
export interface InvoiceBrief {
  /** 发票主键 UUID(无连字符,32 位) */
  invoice_id: string;
  /** 发票号码 */
  invoice_number: string;
  /** 发票详细类型描述,可能为 null */
  sub_type_desc: string | null;
  /** 价税合计,数字字符串,可能为 null */
  total_amount: string | null;
  /** 是否为已存在记录 */
  is_duplicate: boolean;
}

/** 单张识别失败明细(同文件中某一张识别/入库失败,不影响其他发票) */
export interface InvoiceFailedEntry {
  /** 所在页码,从 1 开始 */
  page: number;
  /** 腾讯云 SubType,如 VatElectronicInvoiceFull */
  sub_type: string;
  /** 失败原因 */
  msg: string;
}

/** 单文件上传识别结果 datas */
export interface InvoiceUploadResult {
  /** 原始文件 ID(minio_file.relation_id),可用于后续关联 */
  relation_id: string;
  /** 本次新入库的发票 */
  invoices: InvoiceBrief[];
  /** 发票号码已存在、未重复入库的记录 */
  existed: InvoiceBrief[];
  /** 单张识别、字段解析或入库失败的发票 */
  failed: InvoiceFailedEntry[];
}

/** 批量识别单文件结果 */
export interface InvoiceBatchFileResult {
  /** 原始文件名(服务端已按 UTF-8 修正中文乱码) */
  original_name: string;
  /** MinIO 文件 ID;类型不符、上传前异常或未产生文件时为 null */
  relation_id: string | null;
  /** 该文件结果码:0-识别流程完成,1-失败 */
  result: number;
  /** 该文件提示,如「识别完成」「未识别到发票」「仅支持图片或PDF文件」 */
  msg: string;
  /** 该文件的发票明细;类型不符或处理异常时可能没有 */
  datas?: {
    /** 本次新入库的发票 */
    invoices: InvoiceBrief[];
    /** 已存在的发票 */
    existed: InvoiceBrief[];
    /** 单张失败信息 */
    failed: InvoiceFailedEntry[];
  };
}

/** 批量上传识别结果 datas */
export interface InvoiceUploadBatchResult {
  /** 逐文件结果,顺序与提交顺序一致(类型被拒绝的排在前面) */
  results: InvoiceBatchFileResult[];
  /** 结果条数,含类型被拒绝的文件 */
  total: number;
  /** result=0 的文件数(类型被拒绝的不计入) */
  success_count: number;
  /** result=1 的文件数,含类型被拒绝的文件 */
  fail_count: number;
}

// ============ 批量报税 ============

/** 批量报税/取消报税请求参数 */
export interface InvoiceTaxFileParams {
  /** 发票主键 UUID 列表(无连字符,32 位),1~200 个 */
  invoice_ids: string[];
  /** 目标报税状态:1-未报税(取消报税),2-已报税 */
  is_tax_filed: number;
  /** 操作人用户 ID */
  user_id: string;
}

/** 批量报税/取消报税结果 datas */
export interface InvoiceTaxFileResult {
  /** 实际发生状态变更的发票条数 */
  updated_count: number;
}
