/**
 * Environment-aware logging utility for notifications
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

type LogData = Record<string, unknown> | unknown[] | string | number | boolean | null

class NotificationLogger {
  private logLevel: LogLevel

  constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'production') {
      this.logLevel = LogLevel.ERROR
    } else if (process.env.NODE_ENV === 'test') {
      this.logLevel = LogLevel.WARN
    } else {
      this.logLevel = LogLevel.DEBUG
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel
  }

  private formatMessage(level: string, message: string, data?: LogData): void {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [NOTIFICATION] [${level}]`

    if (data) {
      console.log(`${prefix} ${message}`, data)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }

  error(message: string, data?: LogData): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.formatMessage('ERROR', message, data)
    }
  }

  warn(message: string, data?: LogData): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.formatMessage('WARN', message, data)
    }
  }

  info(message: string, data?: LogData): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.formatMessage('INFO', message, data)
    }
  }

  debug(message: string, data?: LogData): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.formatMessage('DEBUG', message, data)
    }
  }

  // Service Worker specific logging (always logs to preserve debugging)
  sw(message: string, data?: LogData): void {
    const prefix = '🔧 SW:'
    if (data) {
      console.log(`${prefix} ${message}`, data)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }
}

// Export singleton instance
export const notificationLogger = new NotificationLogger()
