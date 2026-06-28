/**
 * Centralized logging system for observability and diagnostics.
 * Prevents debug logs in production and formats log messages consistently.
 */

const isProd =
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD === true);

export class Logger {
  private context: string;

  constructor(context: string = 'System') {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [DriverDash:${this.context}] ${message}${dataStr}`;
  }

  public debug(message: string, data?: any): void {
    if (isProd) return;
    console.debug(this.formatMessage('debug', message, data));
  }

  public info(message: string, data?: any): void {
    console.info(this.formatMessage('info', message, data));
  }

  public warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  public error(message: string, error?: any, data?: any): void {
    let combinedData = data || {};
    if (error) {
      combinedData = {
        ...combinedData,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      };
    }
    console.error(this.formatMessage('error', message, combinedData));
  }
}

// Default export is a pre-instantiated logger for generic use
export const logger = new Logger('Global');
