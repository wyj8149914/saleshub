import { http } from '@/utils/request';
import type {
  ExpenseListQuery,
  ExpenseCreatePayload,
  ExpenseUpdatePayload,
  ExpenseBindInvoicePayload,
  ExpensePageData,
  ExpenseDetail,
  ExpenseCreateResult,
} from '@/types/expense';

/**
 * 支出费用模块 API
 * 对应后端 /saleshub/expense/* 接口
 */
export const expenseApi = {
  /** 分页查询支出费用单列表(左联发票表带出发票号码/价税合计,不含采购明细) */
  list(query: ExpenseListQuery) {
    return http.get<ExpensePageData>('/saleshub/expense/list', { params: query });
  },

  /** 查询支出费用单详情(含采购明细行 items 与关联发票摘要) */
  detail(expense_id: string) {
    return http.get<ExpenseDetail>('/saleshub/expense/detail', { params: { expense_id } });
  },

  /**
   * 新建支出费用单
   * 类型1-有发票采购可带 invoice_id 与采购明细;类型2-无发票支出仅金额/分类等基础字段
   */
  create(payload: ExpenseCreatePayload) {
    return http.post<ExpenseCreateResult>('/saleshub/expense/create', payload);
  },

  /** 修改支出费用单(仅正常状态可改;items 传入时整批替换) */
  update(payload: ExpenseUpdatePayload) {
    return http.post('/saleshub/expense/update', payload);
  },

  /**
   * 支出费用单关联/换绑发票
   * 供前端上传发票(/saleshub/invoice/upload)识别入库后回填 invoice_id,重复关联同一发票幂等成功
   */
  bindInvoice(payload: ExpenseBindInvoicePayload) {
    return http.post('/saleshub/expense/bindInvoice', payload);
  },

  /**
   * 删除支出费用单(软删除,费用单与采购明细行同事务作废)
   * 类型1关联的发票随费用单作废自动释放,可再次被其他费用单选择
   * @param expense_id 费用单 ID
   */
  delete(expense_id: string) {
    return http.post('/saleshub/expense/delete', { expense_id });
  },
};

export default expenseApi;
