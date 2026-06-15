/**
 * Logger utility for service logging
 */

export function getLogger(context: string): any {
  // Simple logger implementation
  // In production, this could be replaced with Winston or another logging library
  return {
    info: (message: string, ...args: any[]) => {
      console.log(`[${context}] INFO:`, message, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${context}] ERROR:`, message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${context}] WARN:`, message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      console.debug(`[${context}] DEBUG:`, message, ...args);
    },
  };
}
