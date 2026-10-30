/**
 * 发票模块工具函数:文件校验、批量报税选择校验、明细字段名翻译
 * 校验函数均为纯函数,不弹提示,便于单元测试与调用方自行处理提示
 */
import { INVOICE_ITEM_FIELD_LABELS } from '@/types/invoice';
import type { Invoice } from '@/types/invoice';

/** 发票识别支持的文件类型:图片或 PDF(用于 upload 组件 accept 属性) */
export const INVOICE_ACCEPT = 'image/*,application/pdf';

/** 单个文件大小上限(MB),与后端一致 */
export const INVOICE_MAX_FILE_SIZE_MB = 5;

/** 批量识别最多文件数,与后端一致 */
export const INVOICE_MAX_BATCH_COUNT = 50;

/** 单次批量报税最多发票数,与后端一致 */
export const INVOICE_MAX_TAX_COUNT = 200;

/** 发票文件类型扩展名兜底(部分环境 File.type 为空) */
const INVOICE_FILE_EXT_REGEXP = /\.(pdf|jpe?g|png|bmp|webp|gif)$/i;

/**
 * 校验发票文件类型:图片或 PDF
 * @param file 待校验文件
 * @returns 是否通过
 */
export function isValidInvoiceFileType(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf' || INVOICE_FILE_EXT_REGEXP.test(file.name);
}

/**
 * 校验发票文件大小:不超过 5MB(超过时后端会整单拒绝,必须前置拦截)
 * @param file 待校验文件
 * @returns 是否通过
 */
export function isValidInvoiceFileSize(file: File): boolean {
  return file.size <= INVOICE_MAX_FILE_SIZE_MB * 1024 * 1024;
}

/** 文件列表校验结果 */
export interface InvoiceFilesCheckResult {
  /** 通过校验的文件列表(保持提交顺序) */
  valid: File[];
  /** 未通过校验的提示,格式「文件名:原因」 */
  errors: string[];
}

/**
 * 批量校验发票文件(数量、类型、大小),供单个/批量识别提交前调用
 * @param files 待校验文件列表
 * @param maxCount 数量上限,批量默认 50,单个识别传 1
 * @returns 通过的文件与未通过的原因列表
 */
export function checkInvoiceFiles(files: File[], maxCount: number = INVOICE_MAX_BATCH_COUNT): InvoiceFilesCheckResult {
  // 数量类问题直接整体返回,不进入逐文件校验
  if (files.length === 0) {
    return { valid: [], errors: ['请选择要识别的文件'] };
  }
  if (files.length > maxCount) {
    return { valid: [], errors: [`单次最多选择${maxCount}个文件`] };
  }

  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!isValidInvoiceFileType(file)) {
      errors.push(`${file.name}:仅支持图片或PDF文件`);
      continue;
    }
    if (!isValidInvoiceFileSize(file)) {
      errors.push(`${file.name}:单个文件大小不能超过${INVOICE_MAX_FILE_SIZE_MB}MB`);
      continue;
    }
    valid.push(file);
  }
  return { valid, errors };
}

/**
 * 翻译发票明细条目字段名:常见腾讯云字段映射为中文,未命中时展示原始字段名
 * @param field 原始字段名
 * @returns 中文标签或原始字段名
 */
export function invoiceItemFieldLabel(field: string): string {
  return INVOICE_ITEM_FIELD_LABELS[field] || field;
}

/** 批量报税选择校验结果 */
export interface TaxSelectionCheck {
  /** 是否通过校验 */
  valid: boolean;
  /** 未通过时的提示文案,可直接用于 message.warning */
  msg?: string;
}

/**
 * 校验多选发票是否满足批量报税/取消报税的前置条件
 * 服务端为整批校验(任一发票不符合条件即整批拒绝),前端预校验可避免无效请求
 * @param records 选中行记录(按选中 key 过滤后的完整行数据)
 * @param targetStatus 目标报税状态:1-未报税(取消报税),2-已报税
 * @returns 校验结果,未通过时带提示文案
 */
export function validateTaxSelection(records: Invoice[], targetStatus: number): TaxSelectionCheck {
  if (records.length === 0) {
    return { valid: false, msg: '请先选择要操作的发票' };
  }
  if (records.length > INVOICE_MAX_TAX_COUNT) {
    return { valid: false, msg: `单次最多操作${INVOICE_MAX_TAX_COUNT}张发票` };
  }
  // 报税要求全部为未报税,取消报税要求全部为已报税;混合选中或含已符合目标状态的行即整批拒绝
  const mismatched = records.some((record) => record.is_tax_filed === targetStatus);
  if (mismatched) {
    return { valid: false, msg: '选中发票中存在状态不一致的发票,请重新选择' };
  }
  return { valid: true };
}

/**
 * 格式化文件大小为可读文本
 * @param size 文件字节数
 * @returns 如「1.2 MB」「356 KB」
 */
export function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(0)} KB`;
  }
  return `${size} B`;
}
