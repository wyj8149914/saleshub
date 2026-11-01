import { InvoiceOcrService, UploadFileItem } from './ocr.service';
import { InvoiceService } from './invoice.service';
import { ExpenseService } from '../finace/expense.service';
import { SalesOrderService } from './salesOrder.service';

const ocrService = new InvoiceOcrService();
const invoiceService = new InvoiceService();
const expenseService = new ExpenseService();
const salesOrderService = new SalesOrderService();

export { ocrService, invoiceService, expenseService, salesOrderService };
export type { UploadFileItem };
