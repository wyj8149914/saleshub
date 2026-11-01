import { http } from '@/utils/request';
import type { LoginPayload, LoginResponseData } from '@/types/auth';
import type {
  UserCreatePayload,
  UserCreateResult,
  UserListQuery,
  UserPageData,
  UserUpdatePasswordPayload,
  UserUpdatePayload,
  UserUpdateStatusPayload,
} from '@/types/user';

/**
 * 用户模块 API(用户管理仅 role=admin 可用,路由与菜单已做权限控制)
 * 对应后端 /saleshub/user/* 接口
 */
export const userApi = {
  login(payload: LoginPayload) {
    return http.post<LoginResponseData>('/saleshub/user/login', payload);
  },

  /** 分页查询用户列表(支持 username/name/phone 模糊、role/status 精确筛选) */
  listUsers(query: UserListQuery) {
    return http.get<UserPageData>('/saleshub/user/listUsers', { params: query });
  },

  /** 创建用户(username 唯一;密码至少 8 位且含大写/小写/数字/特殊符号至少三种) */
  createUser(payload: UserCreatePayload) {
    return http.post<UserCreateResult>('/saleshub/user/createUser', payload);
  },

  /** 更新用户基础信息(姓名/手机号/角色;不修改 username 与 password) */
  updateUser(payload: UserUpdatePayload) {
    return http.post('/saleshub/user/updateUser', payload);
  },

  /** 启用/停用用户账号(停用后该用户无法登录) */
  updateUserStatus(payload: UserUpdateStatusPayload) {
    return http.post('/saleshub/user/updateUserStatus', payload);
  },

  /** 修改指定用户的登录密码(密码强度要求同创建) */
  updateUserPassword(payload: UserUpdatePasswordPayload) {
    return http.post('/saleshub/user/updateUserPassword', payload);
  },
};

export default userApi;
