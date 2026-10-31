import { InvoiceOcrService, UploadFileItem } from './ocr.service';
import { InvoiceService } from './invoice.service';
import { ExpenseService } from '../finace/expense.service';

const ocrService = new InvoiceOcrService();
const invoiceService = new InvoiceService();
const expenseService = new ExpenseService();

export { ocrService, invoiceService, expenseService };
export type { UploadFileItem };
