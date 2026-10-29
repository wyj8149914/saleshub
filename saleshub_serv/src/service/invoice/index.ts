import { InvoiceOcrService, UploadFileItem } from './ocr.service';
import { InvoiceService } from './invoice.service';

const ocrService = new InvoiceOcrService();
const invoiceService = new InvoiceService();

export { ocrService, invoiceService };
export type { UploadFileItem };
