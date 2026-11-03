import { http } from '@/utils/request';
import type {
  TodoListQuery,
  TodoCreatePayload,
  TodoUpdatePayload,
  TodoCompletePayload,
  TodoPostponePayload,
  TodoTypeCreatePayload,
  TodoPageData,
  TodoDetail,
  TodoTypeListData,
} from '@/types/todo';

/**
 * 待办类型模块 API
 * 对应后端 /saleshub/todo/type/* 接口
 */
export const todoTypeApi = {
  /** 查询全部正常状态的待办类型(不分页,按创建时间降序,支持名称关键字模糊匹配) */
  list(keyword?: string) {
    return http.get<TodoTypeListData>('/saleshub/todo/type/list', {
      params: keyword ? { keyword } : {},
    });
  },

  /** 新建待办类型(类型名称全局唯一,重名时后端返回「类型名称已存在」) */
  create(payload: TodoTypeCreatePayload) {
    return http.post<{ type_id: string }>('/saleshub/todo/type/create', payload);
  },

  /** 删除待办类型(软删除,status 置为停用,删除后不再出现在类型列表中) */
  delete(type_id: string) {
    return http.post('/saleshub/todo/type/delete', { type_id });
  },
};

/**
 * 待办事项模块 API
 * 对应后端 /saleshub/todo/* 接口
 */
export const todoApi = {
  /** 分页查询待办事项列表(含执行人列表/剩余天数/延期统计) */
  list(query: TodoListQuery) {
    return http.get<TodoPageData>('/saleshub/todo/list', { params: query });
  },

  /** 查询待办事项详情(含执行人列表与延期记录列表) */
  detail(todo_id: string) {
    return http.get<TodoDetail>('/saleshub/todo/detail', { params: { todo_id } });
  },

  /** 新建待办事项(执行人多选,事务内写入主表与执行人关联表) */
  create(payload: TodoCreatePayload) {
    return http.post<{ todo_id: string }>('/saleshub/todo/create', payload);
  },

  /** 修改待办事项(仅正常状态可改;executor_ids/attachments 传入时整体替换) */
  update(payload: TodoUpdatePayload) {
    return http.post('/saleshub/todo/update', payload);
  },

  /**
   * 待办完成状态变更:标记完成写入完成时间,取消完成清空完成时间
   * 传入相同状态幂等成功
   */
  complete(payload: TodoCompletePayload) {
    return http.post('/saleshub/todo/complete', payload);
  },

  /**
   * 待办延期:事务内更新截止日期并插入延期记录(只增不改)
   * 新截止日期必须晚于当前截止日期
   */
  postpone(payload: TodoPostponePayload) {
    return http.post('/saleshub/todo/postpone', payload);
  },

  /** 删除待办事项(软删除,status 置为删除) */
  delete(todo_id: string) {
    return http.post('/saleshub/todo/delete', { todo_id });
  },
};

export default todoApi;
