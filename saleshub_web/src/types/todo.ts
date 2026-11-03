import type { PaginatedData } from '@/types/inventory';

// ============ 枚举 ============

/** 待办重要程度 */
export enum TodoPriority {
  /** 重要紧急 */
  IMPORTANT_URGENT = 1,
  /** 重要不紧急 */
  IMPORTANT_NOT_URGENT = 2,
  /** 不重要紧急 */
  NOT_IMPORTANT_URGENT = 3,
  /** 不重要不紧急 */
  NOT_IMPORTANT_NOT_URGENT = 4,
}

/** 待办重要程度中文标签 */
export const TODO_PRIORITY_LABELS: Record<number, string> = {
  [TodoPriority.IMPORTANT_URGENT]: '重要紧急',
  [TodoPriority.IMPORTANT_NOT_URGENT]: '重要不紧急',
  [TodoPriority.NOT_IMPORTANT_URGENT]: '不重要紧急',
  [TodoPriority.NOT_IMPORTANT_NOT_URGENT]: '不重要不紧急',
};

/** 待办是否完成:1-否,2-是(整条待办的总体状态,不按执行人拆分) */
export enum TodoCompleted {
  NO = 1,
  YES = 2,
}

/** 待办列表排序字段 */
export enum TodoSort {
  /** 创建时间降序(默认) */
  CREATE_TIME_DESC = 1,
  /** 截止日期升序 */
  DEADLINE_ASC = 2,
  /** 重要程度升序(重要紧急优先) */
  PRIORITY_ASC = 3,
}

/** 待办列表排序中文标签 */
export const TODO_SORT_LABELS: Record<number, string> = {
  [TodoSort.CREATE_TIME_DESC]: '创建时间降序',
  [TodoSort.DEADLINE_ASC]: '截止日期升序',
  [TodoSort.PRIORITY_ASC]: '重要程度优先',
};

// ============ 请求类型 ============

/** 待办事项列表查询参数 */
export interface TodoListQuery {
  /** 页码,从 1 开始 */
  pageIndex: number;
  /** 每页数量 */
  pageSize: number;
  /** 执行人用户 ID,传入时查询该用户的「我的待办」 */
  executor_id?: string;
  /** 待办类型 ID */
  type_id?: string;
  /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
  priority?: number;
  /** 是否完成:1-否,2-是 */
  is_completed?: number;
  /** 截止日期起(含当天),YYYY-MM-DD */
  start_date?: string;
  /** 截止日期止(含当天),YYYY-MM-DD */
  end_date?: string;
  /** 关键字,对待办名称模糊匹配 */
  keyword?: string;
  /** 排序字段:1-创建时间降序(默认),2-截止日期升序,3-重要程度升序 */
  sort?: number;
}

/** 新建待办事项参数 */
export interface TodoCreatePayload {
  /** 待办事项名称,最长 100 字符 */
  title: string;
  /** 待办类型 ID(可选) */
  type_id?: string;
  /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
  priority: number;
  /** 截止日期,YYYY-MM-DD */
  deadline: string;
  /** 执行人用户 ID 列表(至少 1 个,最多 20 个) */
  executor_ids: string[];
  /** 附件 relation_id 列表(可选,/saleshub/file/upload 返回的 relation_id) */
  attachments?: string[];
  /** 备注(可选,最长 500 字符) */
  remark?: string;
  /** 创建人用户 ID */
  user_id: string;
}

/** 修改待办事项参数(全部业务字段可选,仅更新传入字段;创建人不允许修改) */
export interface TodoUpdatePayload {
  /** 待办事项 ID */
  todo_id: string;
  /** 待办事项名称 */
  title?: string;
  /** 待办类型 ID */
  type_id?: string;
  /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
  priority?: number;
  /** 截止日期,YYYY-MM-DD(直接修改不产生延期记录) */
  deadline?: string;
  /** 执行人用户 ID 列表(传入时整体替换,至少 1 个,最多 20 个) */
  executor_ids?: string[];
  /** 附件 relation_id 列表(传入时整体替换) */
  attachments?: string[];
  /** 备注 */
  remark?: string;
}

/** 待办完成状态变更参数 */
export interface TodoCompletePayload {
  /** 待办事项 ID */
  todo_id: string;
  /** 是否完成:1-否,2-是 */
  is_completed: number;
}

/** 待办延期参数 */
export interface TodoPostponePayload {
  /** 待办事项 ID */
  todo_id: string;
  /** 延期后截止日期,YYYY-MM-DD,必须晚于当前截止日期 */
  new_deadline: string;
  /** 延期原因,2~200 字符 */
  reason: string;
  /** 延期操作人用户 ID(处理人或管理员) */
  operator_id: string;
}

/** 新建待办类型参数 */
export interface TodoTypeCreatePayload {
  /** 创建人用户 ID */
  user_id: string;
  /** 类型名称,全局唯一,最长 50 字符 */
  type_name: string;
}

// ============ 响应类型 ============

/** 待办类型 */
export interface TodoType {
  /** 待办类型主键 UUID(无连字符,32 位) */
  type_id: string;
  /** 类型名称 */
  type_name: string;
  /** 创建人用户 ID */
  user_id: string;
  /** 状态:1-正常,2-停用 */
  status: number;
  /** 创建时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
}

/** 待办类型列表 datas(不分页) */
export interface TodoTypeListData {
  total: number;
  items: TodoType[];
}

/** 待办执行人(接口仅返回 user_id,姓名由前端用户列表映射) */
export interface TodoExecutor {
  user_id: string;
}

/** 待办事项列表行 */
export interface Todo {
  /** 待办事项主键 UUID(无连字符,32 位) */
  todo_id: string;
  /** 待办事项名称 */
  title: string;
  /** 待办类型 ID,可为 null */
  type_id: string | null;
  /** 待办类型名称(按 type_id 联查),可为 null */
  type_name: string | null;
  /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
  priority: number;
  /** 截止日期,YYYY-MM-DD */
  deadline: string;
  /** 剩余天数(截止日期-当前日期),负数表示已过期 N 天,0 表示今天截止 */
  remaining_days: number;
  /** 是否完成:1-否,2-是(整条待办的总体状态) */
  is_completed: number;
  /** 完成时间,YYYY-MM-DD HH24:MI:SS,未完成为 null */
  completed_time: string | null;
  /** 附件 relation_id 列表,可为 null */
  attachments: string[] | null;
  /** 备注,可为 null */
  remark: string | null;
  /** 创建人用户 ID */
  user_id: string;
  /** 执行人列表 */
  executors: TodoExecutor[];
  /** 延期次数 */
  postpone_count: number;
  /** 累计延期天数(各次延期 delay_days 求和) */
  total_delay_days: number;
  /** 状态:1-正常,2-删除 */
  status: number;
  /** 创建时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
}

/** 待办事项分页列表 datas */
export type TodoPageData = PaginatedData<Todo>;

/** 待办延期记录 */
export interface TodoPostponeRecord {
  /** 延期记录主键 UUID(无连字符,32 位) */
  postpone_id: string;
  /** 延期前截止日期,YYYY-MM-DD */
  old_deadline: string;
  /** 延期后截止日期,YYYY-MM-DD */
  new_deadline: string;
  /** 本次延期天数(new_deadline - old_deadline) */
  delay_days: number;
  /** 延期原因 */
  reason: string;
  /** 延期操作人用户 ID(处理人或管理员) */
  operator_id: string;
  /** 延期操作时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
}

/** 待办事项详情 */
export interface TodoDetail {
  /** 待办事项主键 UUID(无连字符,32 位) */
  todo_id: string;
  /** 待办事项名称 */
  title: string;
  /** 待办类型 ID,可为 null */
  type_id: string | null;
  /** 待办类型名称(按 type_id 联查),可为 null */
  type_name: string | null;
  /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
  priority: number;
  /** 截止日期,YYYY-MM-DD(延期后的最新截止日期) */
  deadline: string;
  /** 剩余天数(截止日期-当前日期),负数表示已过期 N 天,0 表示今天截止 */
  remaining_days: number;
  /** 是否完成:1-否,2-是 */
  is_completed: number;
  /** 完成时间,YYYY-MM-DD HH24:MI:SS,未完成为 null */
  completed_time: string | null;
  /** 附件 relation_id 列表,可为 null */
  attachments: string[] | null;
  /** 备注,可为 null */
  remark: string | null;
  /** 创建人用户 ID */
  user_id: string;
  /** 执行人列表(按关联时间升序) */
  executors: TodoExecutor[];
  /** 延期记录列表(按延期时间降序,只增不改) */
  postpone_records: TodoPostponeRecord[];
  /** 状态:1-正常,2-删除 */
  status: number;
  /** 创建时间,YYYY-MM-DD HH24:MI:SS */
  create_time: string;
  /** 更新时间,YYYY-MM-DD HH24:MI:SS */
  update_time: string;
}
