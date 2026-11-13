import type { PaginatedData } from '@/types/inventory';

// ============ 枚举 ============

/** 日志结果:1-成功,2-失败(登录日志与操作日志共用) */
export enum LogResult {
  /** 成功 */
  SUCCESS = 1,
  /** 失败 */
  FAIL = 2,
}

/** 日志结果中文标签映射 */
export const LOG_RESULT_LABELS: Record<number, string> = {
  [LogResult.SUCCESS]: '成功',
  [LogResult.FAIL]: '失败',
};

// ============ 登录日志 ============

/** 登录日志列表查询参数 */
export interface LoginLogListQuery {
  pageIndex: number;
  pageSize: number;
  /** 用户名,模糊匹配(可选) */
  username?: string;
  /** 登录结果:1-成功,2-失败(可选) */
  result?: number;
  /** 登录IP,模糊匹配(可选) */
  ip?: string;
  /** 登录时间起(含当天),YYYY-MM-DD(可选) */
  start_time?: string;
  /** 登录时间止(含当天),YYYY-MM-DD(可选) */
  end_time?: string;
}

/** 登录日志条目 */
export interface LoginLog {
  /** 日志主键 UUID */
  log_id: string;
  /** 尝试登录的用户名 */
  username: string;
  /** 登录用户 ID,用户名不存在时为 null */
  user_id: string | null;
  /** 登录结果:1-成功,2-失败 */
  result: number;
  /** 失败原因,成功时为 null */
  fail_msg: string | null;
  /** 登录 IP */
  ip: string;
  /** 浏览器 User-Agent,可能为 null */
  user_agent: string | null;
  /** 登录时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
}

/** 登录日志分页列表数据 */
export type LoginLogPageData = PaginatedData<LoginLog>;

// ============ 操作日志 ============

/** 操作日志列表查询参数(仅管理员,user_id 为请求者用户ID,用于权限校验) */
export interface OperationLogListQuery {
  pageIndex: number;
  pageSize: number;
  /** 请求者用户 ID(权限校验) */
  user_id: string;
  /** 操作大类,如 PRODUCT/INVOICE,精确匹配(可选) */
  operation_type?: string;
  /** 操作代码,如 create_product,精确匹配(可选) */
  operation_code?: string;
  /** 操作人姓名,精确匹配(可选) */
  operator_name?: string;
  /** 操作对象名称,精确匹配(可选) */
  target_name?: string;
  /** 操作结果:1-成功,2-失败(可选) */
  operation_result?: number;
  /** 关键字,对操作说明/对象名称模糊匹配(可选) */
  keyword?: string;
  /** 操作时间起(含当天),YYYY-MM-DD(可选) */
  time_start?: string;
  /** 操作时间止(含当天),YYYY-MM-DD(可选) */
  time_end?: string;
}

/** 操作日志列表条目(轻量字段,不含变更前后值等大字段) */
export interface OperationLog {
  /** 日志主键 UUID */
  log_id: string;
  /** 操作时间,YYYY-MM-DD HH24:MI:SS */
  operation_time: string;
  /** 操作大类,如 PRODUCT/INVOICE */
  operation_type: string;
  /** 操作代码,如 create_product */
  operation_code: string;
  /** 操作说明 */
  operation_desc: string;
  /** 操作人用户 ID */
  operator_id: string;
  /** 操作人姓名快照,可能为 null */
  operator_name: string | null;
  /** 操作时角色数组,可能为 null */
  operator_role: string[] | null;
  /** 操作对象类型,可能为 null */
  target_type: string | null;
  /** 操作对象 ID,可能为 null */
  target_id: string | null;
  /** 操作对象名称,可能为 null */
  target_name: string | null;
  /** 操作结果:1-成功,2-失败 */
  operation_result: number;
  /** 失败信息,成功时为 null */
  error_msg: string | null;
  /** 操作 IP,可能为 null */
  ip_address: string | null;
  /** HTTP 方法,可能为 null */
  request_method: string | null;
  /** 请求路径,可能为 null */
  request_path: string | null;
}

/** 操作日志详情(列表字段基础上增加变更前后值、附加数据与 User-Agent) */
export interface OperationLogDetail extends OperationLog {
  /** 变更前值,JSON 字符串或纯文本,可能为 null */
  old_value: string | null;
  /** 变更后值,JSON 字符串或纯文本,可能为 null */
  new_value: string | null;
  /** 附加数据(JSONB),可能为 null */
  attach_data: Record<string, unknown> | null;
  /** 浏览器 User-Agent,可能为 null */
  user_agent: string | null;
}

/** 操作日志分页列表数据 */
export type OperationLogPageData = PaginatedData<OperationLog>;
