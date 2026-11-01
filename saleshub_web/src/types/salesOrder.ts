// ============ 销售订单枚举 ============

/** 订单状态:1-待交货,2-已交货,3-已完成,4-已取消(终态) */
export enum OrderStatus {
  /** 待交货 */
  PENDING = 1,
  /** 已交货 */
  DELIVERED = 2,
  /** 已完成 */
  COMPLETED = 3,
  /** 已取消(终态,不可变更) */
  CANCELLED = 4,
}

/** 收款状态:1-未收款,2-部分收款,3-已收款(由已收/订单金额推导) */
export enum PayStatus {
  /** 未收款 */
  UNPAID = 1,
  /** 部分收款 */
  PARTIAL = 2,
  /** 已收款 */
  PAID = 3,
}

/** 订单状态中文标签映射 */
export const ORDER_STATUS_LABELS: Record<number, string> = {
  [OrderStatus.PENDING]: '待交货',
  [OrderStatus.DELIVERED]: '已交货',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
};

/** 收款状态中文标签映射 */
export const PAY_STATUS_LABELS: Record<number, string> = {
  [PayStatus.UNPAID]: '未收款',
  [PayStatus.PARTIAL]: '部分收款',
  [PayStatus.PAID]: '已收款',
};

// ============ 列表与详情 ============

/** 销售订单列表查询参数 */
export interface SalesOrderListQuery {
  pageIndex: number;
  pageSize: number;
  /** 订单状态,精确匹配(可选) */
  order_status?: number;
  /** 收款状态,精确匹配(可选) */
  pay_status?: number;
  /** 交货日期起(含当天),YYYY-MM-DD(可选) */
  start_date?: string;
  /** 交货日期止(含当天),YYYY-MM-DD(可选) */
  end_date?: string;
  /** 关键字,对订单编号/客户名称模糊匹配(可选) */
  keyword?: string;
}

/** 销售订单列表项(整单字段,不含合同文件预览地址) */
export interface SalesOrder {
  /** 销售订单主键 UUID(无连字符,32 位) */
  order_id: string;
  /** 订单编号,XS+6位递增数字(如 XS000001) */
  order_no: string;
  /** 订单名称 */
  order_title: string;
  /** 创建人用户 ID */
  user_id: string;
  /** 客户名称 */
  customer_name: string;
  /** 客户联系方式 */
  customer_phone: string;
  /** 收货地址,可能为 null */
  address: string | null;
  /** 订单金额,数字字符串(如 12800.00) */
  amount: string;
  /** 已收金额,数字字符串(如 5000.00) */
  received_amount: string;
  /** 收款状态:1-未收款,2-部分收款,3-已收款 */
  pay_status: number;
  /** 交货日期,YYYY-MM-DD HH24:MI:SS 格式字符串 */
  delivery_date: string;
  /** 订单状态:1-待交货,2-已交货,3-已完成,4-已取消 */
  order_status: number;
  /** 备注,可能为 null */
  remark: string | null;
  /** 合同文件 ID(minio_file.relation_id),可能为 null */
  contract_file_id: string | null;
  /** 状态:1-正常 */
  status: number;
  /** 创建时间,YYYY-MM-DD HH24:MI:SS 格式字符串 */
  create_time: string;
}

/** 销售订单分页列表 datas */
export interface SalesOrderPageData {
  total: number;
  items: SalesOrder[];
}

/** 销售订单详情(含更新时间与合同文件预览地址) */
export interface SalesOrderDetail extends SalesOrder {
  /** 更新时间,YYYY-MM-DD HH24:MI:SS 格式字符串 */
  update_time: string;
  /** 合同文件预览地址;未上传合同或原始文件缺失时无此字段 */
  contract_url?: string;
}

// ============ 新建/修改/收款/状态 ============

/** 新建销售订单请求参数 */
export interface SalesOrderCreatePayload {
  /** 创建人用户 ID */
  user_id: string;
  /** 订单名称,最长 100 字符 */
  order_title: string;
  /** 客户名称,最长 100 字符 */
  customer_name: string;
  /** 客户联系方式,最长 20 字符 */
  customer_phone: string;
  /** 收货地址(可选,最长 255 字符) */
  address?: string;
  /** 订单金额,最多两位小数 */
  amount: number;
  /** 交货日期,YYYY-MM-DD */
  delivery_date: string;
  /** 备注(可选,最长 500 字符) */
  remark?: string;
  /** 合同文件 ID(可选,/saleshub/file/upload 返回的 relation_id) */
  contract_file_id?: string;
}

/** 修改销售订单请求参数(order_no 与 user_id 不可改;仅更新传入字段) */
export interface SalesOrderUpdatePayload {
  order_id: string;
  order_title?: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  /** 修改后服务端按已收金额重新推导收款状态 */
  amount?: number;
  delivery_date?: string;
  remark?: string;
  contract_file_id?: string;
}

/** 销售订单收款请求参数 */
export interface SalesOrderReceivePayload {
  order_id: string;
  /** 本次收款金额,最多两位小数,必须大于 0,累加后不可超过订单金额 */
  received_amount: number;
}

/** 销售订单收款结果 datas */
export interface SalesOrderReceiveResult {
  /** 累加后的已收金额,数字字符串 */
  received_amount: string;
  /** 更新后的收款状态:1-未收款,2-部分收款,3-已收款 */
  pay_status: number;
}

/** 销售订单状态变更请求参数(4-已取消为终态;同状态幂等成功) */
export interface SalesOrderUpdateStatusPayload {
  order_id: string;
  order_status: number;
}
