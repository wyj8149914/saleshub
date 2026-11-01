import type { UserRole } from '@/types/auth';

/** 用户状态:1-正常,2-停用 */
export enum UserStatus {
  /** 正常 */
  NORMAL = 1,
  /** 停用 */
  DISABLED = 2,
}

/** 角色中文标签映射 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  user: '普通用户',
};

/** 状态中文标签映射 */
export const USER_STATUS_LABELS: Record<number, string> = {
  [UserStatus.NORMAL]: '正常',
  [UserStatus.DISABLED]: '停用',
};

// ============ 用户列表 ============

/** 用户列表查询参数 */
export interface UserListQuery {
  pageIndex: number;
  pageSize: number;
  /** 登录用户名,模糊匹配(可选) */
  username?: string;
  /** 姓名/昵称,模糊匹配(可选) */
  name?: string;
  /** 手机号,模糊匹配(可选) */
  phone?: string;
  /** 角色,精确匹配(可选) */
  role?: UserRole;
  /** 状态,精确匹配:1-正常,2-停用(可选) */
  status?: number;
}

/** 用户列表项(不含密码哈希) */
export interface UserListItem {
  /** 用户主键 UUID(无连字符) */
  user_id: string;
  /** 登录用户名 */
  username: string;
  /** 姓名/昵称 */
  name: string;
  /** 手机号 */
  phone: string | null;
  /** 角色:admin-管理员,user-普通用户 */
  role: UserRole;
  /** 状态:1-正常,2-停用 */
  status: number;
  /** 最后登录时间,从未登录时为 null */
  last_login_time: string | null;
  /** 创建时间 */
  create_time: string;
}

/** 用户分页列表 datas */
export interface UserPageData {
  total: number;
  items: UserListItem[];
}

// ============ 创建/修改/状态/密码 ============

/** 创建用户请求参数 */
export interface UserCreatePayload {
  /** 登录用户名,唯一,最长 50 字符 */
  username: string;
  /** 登录密码,至少 8 位且大写/小写/数字/特殊符号至少三种 */
  password: string;
  /** 姓名/昵称,最长 100 字符 */
  name: string;
  /** 手机号(可选,最长 20 字符) */
  phone?: string;
  /** 角色(可选,默认 user) */
  role?: UserRole;
}

/** 创建用户结果 datas */
export interface UserCreateResult {
  /** 新建用户主键 UUID */
  user_id: string;
}

/** 更新用户请求参数(不修改 username 与 password;name 必填直接覆盖) */
export interface UserUpdatePayload {
  user_id: string;
  /** 姓名/昵称,最长 100 字符 */
  name: string;
  /** 手机号(可选,传空字符串清空) */
  phone?: string;
  /** 角色(可选) */
  role?: UserRole;
}

/** 设置用户状态请求参数:1-正常(启用),2-停用 */
export interface UserUpdateStatusPayload {
  user_id: string;
  status: number;
}

/** 修改用户密码请求参数,密码强度要求同创建 */
export interface UserUpdatePasswordPayload {
  user_id: string;
  password: string;
}
