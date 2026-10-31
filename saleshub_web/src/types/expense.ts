import type { PaginatedData } from '@/types/inventory';

// ============ 枚举 ============

/** 费用类型 */
export enum ExpenseType {
  /** 有发票采购(需关联发票) */
  WITH_INVOICE = 1,
  /** 无发票支出 */
  WITHOUT_INVOICE = 2,
}

/** 费用类型中文标签 */
export const EXPENSE_TYPE_LABELS: Record<number, string> = {
  [ExpenseType.WITH_INVOICE]: '有发票采购',
  [ExpenseType.WITHOUT_INVOICE]: '无发票支出',
};

/** 采购来源渠道中文标签 */
export const EXPENSE_CHANNEL_LABELS: Record<number, string> = {
  1: '淘宝',
  2: '京东',
  3: '拼多多',
  4: '抖音',
  5: '线下',
  99: '其他',
};

/** 支出分类中文标签 */
export const EXPENSE_CATEGORY_LABELS: Record<number, string> = {
  1: '办公资产费',
  2: '差旅费',
  3: '成本费',
  4: '接待费',
  5: '快递费',
  6: '软件服务费',
  7: '其他',
};

/** 付款方式中文标签 */
export const EXPENSE_PAYMENT_METHOD_LABELS: Record<number, string> = {
  1: '现金',
  2: '微信',
  3: '支付宝',
  4: '银行转账',
  5: '其他',
};

// ============ 请求类型 ============

/** 支出费用单列表查询参数 */
export interface ExpenseListQuery {
  /** 页码,从 1 开始 */
  pageIndex: number;
  /** 每页条数 */
  pageSize: number;
  /** 费用类型:1-有发票采购,2-无发票支出 */
  expense_type?: number;
  /** 采购来源渠道 */
  channel?: number;
  /** 支出分类 */
  category?: number;
  /** 付款方式 */
  payment_method?: number;
  /** 支出日期起(含当天),YYYY-MM-DD */
  start_date?: string;
  /** 支出日期止(含当天),YYYY-MM-DD */
  end_date?: string;
  /** 关键字,对费用单编号/收款方模糊匹配 */
  keyword?: string;
}

/** 采购明细行提交结构(create/update 共用) */
export interface ExpenseItemPayload {
  /** 库存零件 ID */
  item_id: string;
  /** 库存规格 ID */
  spec_id: string;
  /** 采购数量,正整数 */
  quantity: number;
  /** 采购单价,最多两位小数 */
  price: number;
  /** 备注(可选) */
  remark?: string;
}

/** 新建支出费用单参数 */
export interface ExpenseCreatePayload {
  /** 费用类型:1-有发票采购,2-无发票支出 */
  expense_type: number;
  /** 创建人用户 ID */
  user_id: string;
  /** 支出金额,最多两位小数 */
  amount: number;
  /** 支出日期,YYYY-MM-DD */
  expense_date: string;
  /** 费用名称(可选) */
  expense_title?: string;
  /** 关联发票 ID(类型1可选,需先经 /saleshub/invoice/upload 识别入库) */
  invoice_id?: string;
  /** 采购来源渠道(可选) */
  channel?: number;
  /** 电商订单号(可选) */
  order_no?: string;
  /** 支出分类(可选) */
  category?: number;
  /** 收款方/对方名称(可选) */
  payee?: string;
  /** 付款方式(可选) */
  payment_method?: number;
  /** 备注(可选) */
  remark?: string;
  /** 采购明细行(1~100 行,可选) */
  items?: ExpenseItemPayload[];
}

/** 修改支出费用单参数(全部业务字段可选,仅更新传入字段;expense_type/expense_no 不允许修改) */
export interface ExpenseUpdatePayload {
  /** 支出费用单 ID */
  expense_id: string;
  /** 费用名称 */
  expense_title?: string;
  /** 支出金额,最多两位小数 */
  amount?: number;
  /** 支出日期,YYYY-MM-DD */
  expense_date?: string;
  /** 关联发票 ID(类型1可换绑) */
  invoice_id?: string;
  /** 采购来源渠道 */
  channel?: number;
  /** 电商订单号 */
  order_no?: string;
  /** 支出分类 */
  category?: number;
  /** 收款方/对方名称 */
  payee?: string;
  /** 付款方式 */
  payment_method?: number;
  /** 备注 */
  remark?: string;
  /** 采购明细行(传入时整批替换) */
  items?: ExpenseItemPayload[];
}

/** 支出费用单关联发票参数 */
export interface ExpenseBindInvoicePayload {
  /** 支出费用单 ID */
  expense_id: string;
  /** 关联发票 ID(上传识别入库后返回的发票主键) */
  invoice_id: string;
}

// ============ 响应类型 ============

/** 支出费用单列表行 */
export interface Expense {
  /** 支出费用单主键 UUID(无连字符,32 位) */
  expense_id: string;
  /** 费用单编号,格式 ZC+6位递增数字 */
  expense_no: string;
  /** 费用名称,可能为 null */
  expense_title: string | null;
  /** 费用类型:1-有发票采购,2-无发票支出 */
  expense_type: number;
  /** 创建人用户 ID */
  user_id: string;
  /** 关联发票 ID,类型2或未关联时为 null */
  invoice_id: string | null;
  /** 关联发票号码(左联发票表),可能为 null */
  invoice_number: string | null;
  /** 关联发票价税合计,数字字符串,可能为 null */
  invoice_total_amount: string | null;
  /** 采购来源渠道,可能为 null */
  channel: number | null;
  /** 电商订单号,可能为 null */
  order_no: string | null;
  /** 支出金额,数字字符串 */
  amount: string;
  /** 支出日期,YYYY-MM-DD HH24:MI:SS */
  expense_date: string;
  /** 支出分类,可能为 null */
  category: number | null;
  /** 收款方/对方名称,可能为 null */
  payee: string | null;
  /** 付款方式,可能为 null */
  payment_method: number | null;
  /** 备注,可能为 null */
  remark: string | null;
  /** 状态:1-正常 */
  status: number;
  /** 创建时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
}

/** 支出费用单详情中的采购明细行 */
export interface ExpenseDetailItem {
  /** 明细行主键 UUID */
  relation_id: string;
  /** 所属支出费用单 ID */
  expense_id: string;
  /** 库存零件 ID */
  item_id: string;
  /** 库存规格 ID */
  spec_id: string;
  /** 采购数量 */
  quantity: number;
  /** 采购单价,数字字符串 */
  price: string;
  /** 备注,可能为 null */
  remark: string | null;
  /** 状态:1-正常 */
  status: number;
  /** 创建时间,ISO 日期时间字符串 */
  create_time: string;
  /** 更新时间,ISO 日期时间字符串 */
  update_time: string;
}

/** 支出费用单详情(列表字段基础上增加 update_time/items/发票摘要) */
export interface ExpenseDetail extends Omit<Expense, 'invoice_total_amount'> {
  /** 更新时间,YYYY-MM-DD HH24:MI:SS */
  update_time: string;
  /** 采购明细行(仅正常状态,按创建时间升序;类型2为空数组) */
  items: ExpenseDetailItem[];
  /** 关联发票号码,未关联发票时为 null */
  invoice_number: string | null;
  /** 关联发票详细类型描述,如「电子发票(普通发票)」,可能为 null */
  sub_type_desc: string | null;
  /** 关联发票开票日期,ISO 日期时间字符串,可能为 null */
  invoice_date: string | null;
  /** 关联发票原始文件在 MinIO 的对象名,仅用于生成预览地址,可能为 null */
  file_object_name: string | null;
  /** 原始发票文件(图片/PDF)预览地址;原始文件缺失时无此字段 */
  invoice_url?: string;
}

/** 支出费用单分页列表数据 */
export type ExpensePageData = PaginatedData<Expense>;

/** 新建支出费用单响应 datas */
export interface ExpenseCreateResult {
  /** 支出费用单主键 UUID */
  expense_id: string;
  /** 费用单编号,格式 ZC+6位递增数字 */
  expense_no: string;
}
