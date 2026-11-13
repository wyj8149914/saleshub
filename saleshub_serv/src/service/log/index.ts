import { LogService } from './log.service';
import { OperationLogService, recordOperation } from './operationLog.service';

const logService = new LogService();
const operationLogService = new OperationLogService();

export { logService, operationLogService, recordOperation };
