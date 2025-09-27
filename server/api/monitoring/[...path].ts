/**
 * Error Monitoring Dashboard API
 * Provides endpoints for monitoring error metrics and system health
 */

import {
  getDashboardData,
  getErrorRate,
  getPerformanceImpact,
  initializeDefaultAlerts,
  createAlert,
  removeAlert,
  CommonAlerts
} from '../../utils/errorMonitoring'
import { ResponseBuilder } from '../../utils/standardAPIResponse'

/**
 * Get error monitoring dashboard data
 */
export default defineEventHandler(async (event) => {
  try {
    const method = getMethod(event)
    const url = getRouterParam(event, 'path') || ''

    switch (method) {
      case 'GET':
        return await handleGetRequest(event, url)
      case 'POST':
        return await handlePostRequest(event, url)
      case 'DELETE':
        return await handleDeleteRequest(event, url)
      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error) {
    throw error
  }
})

/**
 * Handle GET requests for monitoring data
 */
async function handleGetRequest(event: any, path: string) {
  const query = getQuery(event)

  switch (path) {
    case '':
    case 'dashboard':
      const dashboardData = await getDashboardData()
      return ResponseBuilder.success(dashboardData, {
        message: 'Dashboard data retrieved successfully'
      })

    case 'error-rate':
      const timeWindow = Number(query.timeWindow) || 60
      const errorRate = await getErrorRate(timeWindow)
      return ResponseBuilder.success(errorRate, {
        message: `Error rate for last ${timeWindow} minutes`,
        pagination: {
          timeWindow,
          windowStart: errorRate.windowStart,
          windowEnd: errorRate.windowEnd
        }
      })

    case 'performance':
      const operation = query.operation as string
      const performanceImpact = await getPerformanceImpact(operation)
      return ResponseBuilder.success(performanceImpact, {
        message: operation
          ? `Performance impact for operation: ${operation}`
          : 'Performance impact for all operations'
      })

    case 'health':
      const healthData = await getSystemHealth()
      return ResponseBuilder.success(healthData, {
        message: 'System health status'
      })

    default:
      throw createError({
        statusCode: 404,
        statusMessage: 'Monitoring endpoint not found'
      })
  }
}

/**
 * Handle POST requests for alert management
 */
async function handlePostRequest(event: any, path: string) {
  const body = await readBody(event)

  switch (path) {
    case 'alerts':
      const alertId = await createAlert(body)
      return ResponseBuilder.success(
        { alertId, config: body },
        { message: 'Alert created successfully' }
      )

    case 'alerts/init':
      const alertIds = await initializeDefaultAlerts()
      return ResponseBuilder.success(
        { alertIds },
        { message: 'Default alerts initialized' }
      )

    case 'alerts/common':
      const alertType = body.type as keyof typeof CommonAlerts
      if (!CommonAlerts[alertType]) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid alert type'
        })
      }

      const commonAlert = CommonAlerts[alertType]()
      const commonAlertId = await createAlert(commonAlert)
      return ResponseBuilder.success(
        { alertId: commonAlertId, config: commonAlert },
        { message: `${alertType} alert created` }
      )

    default:
      throw createError({
        statusCode: 404,
        statusMessage: 'Alert endpoint not found'
      })
  }
}

/**
 * Handle DELETE requests for alert removal
 */
async function handleDeleteRequest(event: any, path: string) {
  const segments = path.split('/')

  if (segments[0] === 'alerts' && segments[1]) {
    const alertId = segments[1]
    await removeAlert(alertId)
    return ResponseBuilder.success(
      { alertId },
      { message: 'Alert removed successfully' }
    )
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Delete endpoint not found'
  })
}

/**
 * Get system health status
 */
async function getSystemHealth() {
  const errorRate = await getErrorRate(5) // Last 5 minutes
  const performanceImpact = await getPerformanceImpact()

  // Calculate health score (0-100)
  let healthScore = 100

  // Deduct points for error rate
  if (errorRate.errorRate > 10) healthScore -= 30
  else if (errorRate.errorRate > 5) healthScore -= 20
  else if (errorRate.errorRate > 1) healthScore -= 10

  // Deduct points for critical errors
  const criticalErrors = errorRate.errorsBySeverity.critical || 0
  if (criticalErrors > 0) healthScore -= 20

  // Deduct points for high error frequency
  if (errorRate.totalErrors > 100) healthScore -= 20
  else if (errorRate.totalErrors > 50) healthScore -= 10

  // Determine status
  let status: 'healthy' | 'warning' | 'critical'
  if (healthScore >= 80) status = 'healthy'
  else if (healthScore >= 60) status = 'warning'
  else status = 'critical'

  return {
    status,
    healthScore: Math.max(0, healthScore),
    timestamp: new Date(),
    metrics: {
      errorRate: errorRate.errorRate,
      totalErrors: errorRate.totalErrors,
      criticalErrors,
      recentWindow: '5 minutes'
    },
    recommendations: getHealthRecommendations(errorRate, performanceImpact)
  }
}

/**
 * Get health recommendations based on current metrics
 */
function getHealthRecommendations(
  errorRate: Awaited<ReturnType<typeof getErrorRate>>,
  performanceImpact: Awaited<ReturnType<typeof getPerformanceImpact>>
) {
  const recommendations: string[] = []

  if (errorRate.errorRate > 5) {
    recommendations.push('High error rate detected - investigate recent deployments')
  }

  if (errorRate.errorsBySeverity.critical > 0) {
    recommendations.push('Critical errors present - immediate attention required')
  }

  const highImpactOps = performanceImpact.filter(op => op.impactFactor > 0.5)
  if (highImpactOps.length > 0) {
    recommendations.push(`High impact operations detected: ${highImpactOps.map(op => op.operation).join(', ')}`)
  }

  if (errorRate.topErrors.length > 0 && errorRate.topErrors[0].percentage > 50) {
    recommendations.push(`Single error type dominates: ${errorRate.topErrors[0].code} (${errorRate.topErrors[0].percentage.toFixed(1)}%)`)
  }

  if (recommendations.length === 0) {
    recommendations.push('System is operating normally')
  }

  return recommendations
}
