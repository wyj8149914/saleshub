import { http } from '@/utils/request';
import type {
  Invoice,
  InvoiceListQuery,
  InvoiceDetail,
  InvoiceUploadResult,
  InvoiceUploadBatchResult,
  InvoiceTaxFileParams,
  InvoiceTaxFileResult,
} from '@/types/invoice';
import type { PaginatedData } from '@/types/inventory';

/** 识别接口超时时间:OCR 识别耗时较长(批量最多 50 个文件、服务端 4 路并发),放宽到 5 分钟 */
const OCR_TIMEOUT = 300000;

/**
 * 发票模块 API
 * 上传识别接口为 multipart/form-data(非 JSON)
 */
export const invoiceApi = {
  /** 分页查询发票列表(仅轻量票面字段) */
  list(query: InvoiceListQuery) {
    return http.get<PaginatedData<Invoice>>('/saleshub/invoice/list', { params: query });
  },

  /** 查询发票详情(含明细条目 items 与原文件预览地址 file_url) */
  detail(invoice_id: string) {
    return http.get<InvoiceDetail>('/saleshub/invoice/detail', { params: { invoice_id } });
  },

  /**
   * 单文件上传并识别发票
   * @param file 待识别文件(图片或 PDF,最大 5MB)
   * @param userId 识别用户 ID
   * @param invoiceNature 发票性质:1-实开,2-进项抵扣
   * @param invoicePurpose 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费
   */
  upload(file: File, userId: string, invoiceNature: number, invoicePurpose: number, tag?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('invoice_nature', String(invoiceNature));
    formData.append('invoice_purpose', String(invoicePurpose));
    if (tag) {
      formData.append('tag', tag);
    }
    return http.post<InvoiceUploadResult>('/saleshub/invoice/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: OCR_TIMEOUT,
    });
  },

  /**
   * 批量上传并识别发票(最多 50 个文件,所有文件共用同一组识别参数)
   * @param files 待识别文件列表(每个最大 5MB)
   * @param userId 识别用户 ID
   * @param invoiceNature 发票性质:1-实开,2-进项抵扣
   * @param invoicePurpose 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费
   */
  uploadBatch(files: File[], userId: string, invoiceNature: number, invoicePurpose: number, tag?: string) {
    const formData = new FormData();
    // 表单字段名必须为 files,可重复追加
    files.forEach((file) => formData.append('files', file));
    formData.append('user_id', userId);
    formData.append('invoice_nature', String(invoiceNature));
    formData.append('invoice_purpose', String(invoicePurpose));
    if (tag) {
      formData.append('tag', tag);
    }
    return http.post<InvoiceUploadBatchResult>('/saleshub/invoice/uploadBatch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: OCR_TIMEOUT,
    });
  },

  /**
   * 批量报税/取消报税(1~200 条)
   * 服务端整批校验:任一发票不存在/已作废/状态已符合目标时整批拒绝,不做任何更新
   * @param params 发票 ID 列表 + 目标报税状态(1-取消报税,2-报税) + 操作人用户 ID
   */
  taxFile(params: InvoiceTaxFileParams) {
    return http.post<InvoiceTaxFileResult>('/saleshub/invoice/taxFile', params);
  },
};

export default invoiceApi;
