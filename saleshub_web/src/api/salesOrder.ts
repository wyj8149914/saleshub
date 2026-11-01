import { http } from '@/utils/request';
import type {
  SalesOrderCreatePayload,
  SalesOrderDetail,
  SalesOrderListQuery,
  SalesOrderPageData,
  SalesOrderReceivePayload,
  SalesOrderReceiveResult,
  SalesOrderUpdatePayload,
  SalesOrderUpdateStatusPayload,
} from '@/types/salesOrder';

/**
 * 销售订单模块 API
 * 对应后端 /saleshub/order/* 接口
 */
export const salesOrderApi = {
  /** 分页查询销售订单列表(支持订单状态/收款状态/交货日期区间/关键字筛选) */
  list(query: SalesOrderListQuery) {
    return http.get<SalesOrderPageData>('/saleshub/order/list', { params: query });
  },

  /** 查询销售订单详情(含合同文件预览地址 contract_url) */
  detail(order_id: string) {
    return http.get<SalesOrderDetail>('/saleshub/order/detail', { params: { order_id } });
  },

  /** 新建销售订单(仅记整单信息;编号 XS+6位递增 服务端生成) */
  create(payload: SalesOrderCreatePayload) {
    return http.post<{ order_id: string; order_no: string }>('/saleshub/order/create', payload);
  },

  /** 修改销售订单基本信息(仅正常状态可改;修改金额后服务端重新推导收款状态) */
  update(payload: SalesOrderUpdatePayload) {
    return http.post('/saleshub/order/update', payload);
  },

  /** 收款登记:累加已收金额并自动推导收款状态(超额/已取消订单整单拒绝) */
  receive(payload: SalesOrderReceivePayload) {
    return http.post<SalesOrderReceiveResult>('/saleshub/order/receive', payload);
  },

  /** 变更订单交货状态(4-已取消为终态;同状态幂等成功) */
  updateStatus(payload: SalesOrderUpdateStatusPayload) {
    return http.post('/saleshub/order/updateStatus', payload);
  },

  /** 删除销售订单(软删除,已删除订单不再展示) */
  delete(order_id: string) {
    return http.post('/saleshub/order/delete', { order_id });
  },
};

export default salesOrderApi;
