/**
 * Error Monitoring and Alerting Integration
 *
 * This module provides:
 * - Error tracking and metrics collection
 * - Performance monitoring for error patterns
 * - Alert system for critical errors
 * - Integration with external monitoring services
 */

import type { ErrorContext, StandardizedError } from './standardErrorHandler'
import { ErrorCategory } from './errorTaxonomy'

/**
 * Error metrics and statistics
 */
export interface ErrorMetrics {
  timestamp: Date
  errorCode: string
  category: ErrorCategory
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  operation?: string
  resource?: string
  responseTime?: number
  requestId: string
  userAgent?: string
  clientIp?: string
  stack?: string[]
}

/**
 * Error rate monitoring
 */
export interface ErrorRateMetrics {
  windowStart: Date
  windowEnd: Date
  totalRequests: number
  totalErrors: number
  errorRate: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<string, number>
  topErrors: Array<{
    code: string
    count: number
    percentage: number
  }>
}

/**
 * Performance impact tracking
 */
export interface PerformanceImpact {
  operation: string
  avgResponseTime: number
  errorResponseTime: number
  impactFactor: number
  affectedUsers: number
  frequency: number
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  errorCode?: string
  category?: ErrorCategory
  severity?: 'low' | 'medium' | 'high' | 'critical'
  threshold: {
    count?: number
    rate?: number
    timeWindow: number // minutes
  }
  channels: Array<'email' | 'slack' | 'webhook' | 'console'>
  enabled: boolean
}

/**
 * Monitoring service interface
 */
export interface MonitoringService {
  trackError(metrics: ErrorMetrics): Promise<void>
  getErrorRate(timeWindow: number): Promise<ErrorRateMetrics>
  getPerformanceImpact(operation?: string): Promise<PerformanceImpact[]>
  createAlert(config: AlertConfig): Promise<string>
  removeAlert(alertId: string): Promise<void>
}

/**
 * In-memory monitoring implementation for development
 */
class InMemoryMonitoring implements MonitoringService {
  private errors: ErrorMetrics[] = []
  private alerts: Map<string, AlertConfig> = new Map()
  private alertCounter = 0

  async trackError(metrics: ErrorMetrics): Promise<void> {
    this.errors.push(metrics)

    // Clean up old entries (keep last 10000)
    if (this.errors.length > 10000) {
      this.errors = this.errors.slice(-10000)
    }

    // Check alerts
    await this.checkAlerts(metrics)

    // Log for development
    if (metrics.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR:', {
        code: metrics.errorCode,
        operation: metrics.operation,
        requestId: metrics.requestId,
        timestamp: metrics.timestamp
      })
    } else if (metrics.severity === 'high') {
      console.warn('⚠️  HIGH SEVERITY ERROR:', {
        code: metrics.errorCode,
        operation: metrics.operation,
        requestId: metrics.requestId
      })
    }
  }

  async getErrorRate(timeWindow: number): Promise<ErrorRateMetrics> {
    const windowStart = new Date(Date.now() - timeWindow * 60 * 1000)
    const windowEnd = new Date()

    const recentErrors = this.errors.filter(
      error => error.timestamp >= windowStart && error.timestamp <= windowEnd
    )

    // Assuming we track all requests (including successful ones)
    // For now, we'll estimate based on error frequency
    const totalErrors = recentErrors.length
    const totalRequests = Math.max(totalErrors * 10, 100) // Estimate
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1
      return acc
    }, {} as Record<ErrorCategory, number>)

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const errorCounts = recentErrors.reduce((acc, error) => {
      acc[error.errorCode] = (acc[error.errorCode] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => ({
        code,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
      }))

    return {
      windowStart,
      windowEnd,
      totalRequests,
      totalErrors,
      errorRate,
      errorsByCategory,
      errorsBySeverity,
      topErrors
    }
  }

  async getPerformanceImpact(operation?: string): Promise<PerformanceImpact[]> {
    const errors = operation
      ? this.errors.filter(e => e.operation === operation)
      : this.errors

    const operationGroups = errors.reduce((acc, error) => {
      const op = error.operation || 'unknown'
      if (!acc[op]) {
        acc[op] = []
      }
      acc[op].push(error)
      return acc
    }, {} as Record<string, ErrorMetrics[]>)

    return Object.entries(operationGroups).map(([op, errorList]) => {
      const responseTimes = errorList
        .filter(e => e.responseTime)
        .map(e => e.responseTime!)

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0

      const uniqueUsers = new Set(errorList.filter(e => e.userId).map(e => e.userId)).size

      return {
        operation: op,
        avgResponseTime,
        errorResponseTime: avgResponseTime,
        impactFactor: errorList.length / 100, // Simplified calculation
        affectedUsers: uniqueUsers,
        frequency: errorList.length
      }
    })
  }

  async createAlert(config: AlertConfig): Promise<string> {
    const alertId = `alert_${++this.alertCounter}`
    this.alerts.set(alertId, config)
    console.log(`📊 Alert created: ${alertId}`, config)
    return alertId
  }

  async removeAlert(alertId: string): Promise<void> {
    this.alerts.delete(alertId)
    console.log(`📊 Alert removed: ${alertId}`)
  }

  private async checkAlerts(metrics: ErrorMetrics): Promise<void> {
    for (const [alertId, config] of this.alerts) {
      if (!config.enabled) continue

      const matches = this.matchesAlertCriteria(metrics, config)
      if (matches) {
        const recentErrors = this.getRecentErrors(config.threshold.timeWindow)
        const shouldTrigger = this.shouldTriggerAlert(recentErrors, config)

        if (shouldTrigger) {
          await this.triggerAlert(alertId, config, metrics, recentErrors)
        }
      }
    }
  }

  private matchesAlertCriteria(metrics: ErrorMetrics, config: AlertConfig): boolean {
    if (config.errorCode && metrics.errorCode !== config.errorCode) return false
    if (config.category && metrics.category !== config.category) return false
    if (config.severity && metrics.severity !== config.severity) return false
    return true
  }

  private getRecentErrors(timeWindowMinutes: number): ErrorMetrics[] {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000)
    return this.errors.filter(error => error.timestamp >= cutoff)
  }

  private shouldTriggerAlert(recentErrors: ErrorMetrics[], config: AlertConfig): boolean {
    if (config.threshold.count && recentErrors.length >= config.threshold.count) {
      return true
    }

    if (config.threshold.rate) {
      // Simplified rate calculation
      const errorRate = recentErrors.length / Math.max(config.threshold.timeWindow, 1)
      return errorRate >= config.threshold.rate
    }

    return false
  }

  private async triggerAlert(
    alertId: string,
    config: AlertConfig,
    triggeringError: ErrorMetrics,
    recentErrors: ErrorMetrics[]
  ): Promise<void> {
    const alertMessage = {
      alertId,
      trigger: triggeringError.errorCode,
      severity: triggeringError.severity,
      count: recentErrors.length,
      timeWindow: config.threshold.timeWindow,
      operation: triggeringError.operation,
      timestamp: new Date(),
      recentErrors: recentErrors.slice(-5) // Last 5 errors
    }

    for (const channel of config.channels) {
      switch (channel) {
        case 'console':
          console.error('🚨 ALERT TRIGGERED:', alertMessage)
          break
        case 'email':
          // TODO: Integrate with email service
          console.log('📧 Email alert would be sent:', alertMessage)
          break
        case 'slack':
          // TODO: Integrate with Slack
          console.log('💬 Slack alert would be sent:', alertMessage)
          break
        case 'webhook':
          // TODO: Send to webhook endpoint
          console.log('🔗 Webhook alert would be sent:', alertMessage)
          break
      }
    }
  }
}

/**
 * Global monitoring instance
 */
let monitoringService: MonitoringService = new InMemoryMonitoring()

/**
 * Set custom monitoring service (for production integrations)
 */
export function setMonitoringService(service: MonitoringService): void {
  monitoringService = service
}

/**
 * Track error in monitoring system
 */
export async function trackError(
  error: StandardizedError,
  context: ErrorContext,
  responseTime?: number
): Promise<void> {
  const metrics: ErrorMetrics = {
    timestamp: new Date(),
    errorCode: error.error.code,
    category: error.error.category,
    severity: error.error.severity,
    userId: context.userId,
    operation: context.operation,
    resource: context.resource,
    responseTime,
    requestId: error.error.requestId,
    userAgent: context.userAgent,
    clientIp: context.clientIp,
    stack: error.error.stack
  }

  await monitoringService.trackError(metrics)
}

/**
 * Get error rate statistics
 */
export async function getErrorRate(timeWindowMinutes: number = 60): Promise<ErrorRateMetrics> {
  return monitoringService.getErrorRate(timeWindowMinutes)
}

/**
 * Get performance impact analysis
 */
export async function getPerformanceImpact(operation?: string): Promise<PerformanceImpact[]> {
  return monitoringService.getPerformanceImpact(operation)
}

/**
 * Create error alert
 */
export async function createAlert(config: AlertConfig): Promise<string> {
  return monitoringService.createAlert(config)
}

/**
 * Remove error alert
 */
export async function removeAlert(alertId: string): Promise<void> {
  return monitoringService.removeAlert(alertId)
}

/**
 * Pre-configured alerts for common scenarios
 */
export const CommonAlerts = {
  /**
   * Alert for critical errors
   */
  criticalErrors: (): AlertConfig => ({
    severity: 'critical',
    threshold: {
      count: 1,
      timeWindow: 5
    },
    channels: ['console', 'email'],
    enabled: true
  }),

  /**
   * Alert for high error rates
   */
  highErrorRate: (): AlertConfig => ({
    threshold: {
      rate: 10, // 10 errors per minute
      timeWindow: 5
    },
    channels: ['console', 'slack'],
    enabled: true
  }),

  /**
   * Alert for validation failures
   */
  validationFailures: (): AlertConfig => ({
    category: ErrorCategory.VALIDATION,
    threshold: {
      count: 50,
      timeWindow: 15
    },
    channels: ['console'],
    enabled: true
  }),

  /**
   * Alert for authentication issues
   */
  authenticationIssues: (): AlertConfig => ({
    category: ErrorCategory.AUTHENTICATION,
    threshold: {
      count: 20,
      timeWindow: 10
    },
    channels: ['console', 'email'],
    enabled: true
  }),

  /**
   * Alert for database connection issues
   */
  databaseIssues: (): AlertConfig => ({
    category: ErrorCategory.DATABASE,
    severity: 'high',
    threshold: {
      count: 5,
      timeWindow: 5
    },
    channels: ['console', 'email', 'slack'],
    enabled: true
  })
}

/**
 * Initialize default alerts
 */
export async function initializeDefaultAlerts(): Promise<string[]> {
  const alertIds = await Promise.all([
    createAlert(CommonAlerts.criticalErrors()),
    createAlert(CommonAlerts.highErrorRate()),
    createAlert(CommonAlerts.validationFailures()),
    createAlert(CommonAlerts.authenticationIssues()),
    createAlert(CommonAlerts.databaseIssues())
  ])

  console.log('📊 Initialized default error monitoring alerts:', alertIds)
  return alertIds
}

/**
 * Monitoring dashboard data
 */
export async function getDashboardData(): Promise<{
  errorRate: ErrorRateMetrics
  performanceImpact: PerformanceImpact[]
  summary: {
    totalErrors: number
    criticalErrors: number
    errorRate: number
    avgResponseTime: number
  }
}> {
  const errorRate = await getErrorRate(60)
  const performanceImpact = await getPerformanceImpact()

  const criticalErrors = errorRate.errorsBySeverity.critical || 0
  const avgResponseTime = performanceImpact.length > 0
    ? performanceImpact.reduce((sum, impact) => sum + impact.avgResponseTime, 0) / performanceImpact.length
    : 0

  return {
    errorRate,
    performanceImpact,
    summary: {
      totalErrors: errorRate.totalErrors,
      criticalErrors,
      errorRate: errorRate.errorRate,
      avgResponseTime
    }
  }
}
