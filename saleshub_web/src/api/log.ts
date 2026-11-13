import { http } from '@/utils/request';
import type {
  LoginLogListQuery,
  LoginLogPageData,
  OperationLogListQuery,
  OperationLogPageData,
  OperationLogDetail,
} from '@/types/log';

/**
 * 日志模块 API
 * 登录日志查询无权限限制;操作日志查询/详情仅管理员(服务端按 user_id 校验)
 */
export const logApi = {
  /** 分页查询登录日志(按登录时间降序) */
  listLogin(query: LoginLogListQuery) {
    return http.get<LoginLogPageData>('/saleshub/log/listLogin', { params: query });
  },

  /**
   * 分页查询操作日志(仅管理员,按操作时间降序)
   * @param query 筛选参数,user_id 为当前登录用户 ID 用于权限校验
   */
  operationList(query: OperationLogListQuery) {
    return http.get<OperationLogPageData>('/saleshub/log/list', { params: query });
  },

  /**
   * 查询操作日志详情(仅管理员,含变更前后值与附加数据)
   * @param log_id 日志 ID
   * @param user_id 当前登录用户 ID,用于权限校验
   */
  operationDetail(log_id: string, user_id: string) {
    return http.get<OperationLogDetail>('/saleshub/log/detail', { params: { log_id, user_id } });
  },
};

export default logApi;
