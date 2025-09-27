/**
 * Centralized Error Handler for CleverAI
 *
 * This module provides a unified error handling system that:
 * - Creates standardized error responses
 * - Logs errors with correlation tracking
 * - Maps different error types to appropriate HTTP responses
 * - Provides error recovery suggestions
 * - Integrates with monitoring systems
 */

import { createError, type H3Error } from 'h3'
import { ZodError, type ZodIssue } from 'zod'
// import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library'
import {
  ErrorCode,
  ErrorCategory,
  getErrorDefinition,
  type ErrorDefinition
} from './errorTaxonomy'
import { trackError } from './errorMonitoring'

// Error correlation and tracking
let errorCounter = 0

export interface ErrorContext {
  requestId?: string
  userId?: string
  operation?: string
  resource?: string
  metadata?: Record<string, unknown>
  clientIp?: string
  userAgent?: string
  timestamp?: Date
}

export interface StandardizedError {
  success: false
  error: {
    code: ErrorCode
    category: ErrorCategory
    message: string
    userMessage: string
    developerMessage: string
    suggestedAction?: string
    timestamp: string
    requestId: string
    retryable: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    details?: unknown
    stack?: string[]
  }
  metadata?: {
    httpStatus: number
    headers?: Record<string, string>
    retryDelay?: number
  }
}

export interface ValidationErrorDetails {
  field: string
  code: string
  message: string
  received?: unknown
  expected?: unknown
}

/**
 * Generate a unique correlation ID for error tracking
 */
function generateCorrelationId(context?: ErrorContext): string {
  const timestamp = Date.now()
  const counter = ++errorCounter
  const prefix = context?.requestId?.slice(-4) || 'req'
  return `err_${prefix}_${timestamp}_${counter.toString().padStart(4, '0')}`
}

/**
 * Enhanced error logger with structured logging
 */
function logError(
  error: Error | H3Error | unknown,
  errorCode: ErrorCode,
  correlationId: string,
  context: ErrorContext = {}
): void {
  const definition = getErrorDefinition(errorCode)
  const timestamp = new Date().toISOString()

  // Determine log level based on severity
  const logLevel = definition.severity === 'critical' ? 'error' :
                  definition.severity === 'high' ? 'error' :
                  definition.severity === 'medium' ? 'warn' : 'info'

  // Create structured log entry
  const logEntry = {
    level: logLevel,
    timestamp,
    correlationId,
    error: {
      code: errorCode,
      category: definition.category,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      httpStatus: definition.httpStatus
    },
    context: {
      userId: context.userId,
      operation: context.operation,
      resource: context.resource,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      metadata: context.metadata
    },
    severity: definition.severity,
    retryable: definition.retryable
  }

  // Log based on severity
  switch (definition.severity) {
    case 'critical':
      console.error('🚨 CRITICAL ERROR', JSON.stringify(logEntry, null, 2))
      // TODO: Integrate with alerting system (PagerDuty, Slack, etc.)
      break
    case 'high':
      console.error('🔥 HIGH PRIORITY ERROR', JSON.stringify(logEntry, null, 2))
      // TODO: Send to error tracking service (Sentry, DataDog, etc.)
      break
    case 'medium':
      console.warn('⚠️ MEDIUM PRIORITY ERROR', JSON.stringify(logEntry, null, 2))
      break
    case 'low':
      console.info('ℹ️ LOW PRIORITY ERROR', JSON.stringify(logEntry, null, 2))
      break
  }

  // TODO: Send to external monitoring/logging service
  // Example: await sendToMonitoringService(logEntry)
}

/**
 * Convert Zod validation errors to standardized validation details
 */
function parseZodValidationErrors(zodError: ZodError): ValidationErrorDetails[] {
  return zodError.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
    received: 'received' in issue ? issue.received : undefined,
    expected: getExpectedValue(issue)
  }))
}

function getExpectedValue(issue: ZodIssue): unknown {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected
    case 'invalid_union':
      return (issue as unknown as { options?: unknown }).options
    case 'too_small':
      return `minimum ${issue.minimum}`
    case 'too_big':
      return `maximum ${issue.maximum}`
    case 'invalid_format':
      return (issue as unknown as { validation?: unknown }).validation
    default:
      return undefined
  }
}

/**
 * Map Prisma errors to standardized error codes
 */
function mapPrismaError(error: Record<string, unknown>): ErrorCode {
  // Handle Prisma errors by checking error code property
  const errorCode = error.code as string

  switch (errorCode) {
    case 'P2002': // Unique constraint failed
      return ErrorCode.DUPLICATE_RESOURCE
    case 'P2025': // Record not found
      return ErrorCode.RESOURCE_NOT_FOUND
    case 'P2003': // Foreign key constraint failed
      return ErrorCode.DATABASE_CONSTRAINT_VIOLATION
    case 'P2014': // Relation violation
      return ErrorCode.DATABASE_CONSTRAINT_VIOLATION
    case 'P1001': // Connection error
      return ErrorCode.DATABASE_CONNECTION_FAILED
    case 'P1008': // Operations timed out
      return ErrorCode.DATABASE_TIMEOUT
    default:
      return ErrorCode.DATABASE_ERROR
  }
}

/**
 * Determine error code from various error types
 */
function determineErrorCode(error: unknown): ErrorCode {
  // Zod validation errors
  if (error instanceof ZodError) {
    return ErrorCode.VALIDATION_FAILED
  }

  // Prisma database errors (check for Prisma error properties)
  if (error && typeof error === 'object' && 'code' in error && typeof (error as Record<string, unknown>).code === 'string') {
    const errorCode = (error as Record<string, unknown>).code as string
    if (errorCode.startsWith('P')) {
      return mapPrismaError(error as Record<string, unknown>)
    }
  }

  // Cast to any for property access - we need to check properties dynamically
  const err = error as Record<string, unknown>

  // H3 errors with custom data
  if (err?.data && typeof err.data === 'object') {
    const data = err.data as Record<string, unknown>
    const customCode = data.code || data.type
    if (typeof customCode === 'string' && Object.values(ErrorCode).includes(customCode as ErrorCode)) {
      return customCode as ErrorCode
    }
  }

  // HTTP status code mapping
  if (typeof err?.statusCode === 'number') {
    switch (err.statusCode) {
      case 400:
        return ErrorCode.VALIDATION_FAILED
      case 401:
        return ErrorCode.AUTH_REQUIRED
      case 403:
        return ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS
      case 404:
        return ErrorCode.RESOURCE_NOT_FOUND
      case 409:
        return ErrorCode.RESOURCE_CONFLICT
      case 422:
        return ErrorCode.BUSINESS_RULE_VIOLATION
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED
      case 500:
        return ErrorCode.INTERNAL_SERVER_ERROR
      case 502:
        return ErrorCode.EXTERNAL_API_ERROR
      case 503:
        return ErrorCode.SERVICE_UNAVAILABLE
      case 504:
        return ErrorCode.TIMEOUT_ERROR
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR
    }
  }

  // AI service errors (common patterns)
  if (
    (typeof err?.message === 'string' && err.message.includes('quota')) ||
    err?.status === 429
  ) {
    return ErrorCode.AI_GENERATION_FAILED
  }

  // Email service errors
  if (typeof err?.message === 'string' && err.message.toLowerCase().includes('email')) {
    return ErrorCode.EMAIL_SEND_FAILED
  }

  // Network/connection errors
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
    return ErrorCode.NETWORK_ERROR
  }

  // Default to internal server error
  return ErrorCode.INTERNAL_SERVER_ERROR
}

/**
 * Create a standardized error response
 */
export function createStandardizedError(
  error: unknown,
  context: ErrorContext = {}
): StandardizedError {
  const errorCode = determineErrorCode(error)
  const definition = getErrorDefinition(errorCode)
  const correlationId = generateCorrelationId(context)

  // Log the error
  logError(error, errorCode, correlationId, context)

  // Handle validation errors specially
  let validationDetails: ValidationErrorDetails[] | undefined
  if (error instanceof ZodError) {
    validationDetails = parseZodValidationErrors(error)
  }

  // Create standardized response
  const standardizedError: StandardizedError = {
    success: false,
    error: {
      code: errorCode,
      category: definition.category,
      message: definition.userMessage,
      userMessage: definition.userMessage,
      developerMessage: definition.developerMessage,
      suggestedAction: definition.suggestedAction,
      timestamp: new Date().toISOString(),
      requestId: correlationId,
      retryable: definition.retryable,
      severity: definition.severity,
      details: validationDetails || ((error as Record<string, unknown>)?.data || undefined),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.stack?.split('\n').map(line => line.trim())
        : undefined
    },
    metadata: {
      httpStatus: definition.httpStatus,
      headers: createErrorHeaders(definition),
      retryDelay: definition.retryable ? getRetryDelay(errorCode) : undefined
    }
  }

  // Track error in monitoring system (async, non-blocking)
  trackError(standardizedError, context).catch(err => {
    console.warn('Failed to track error in monitoring system:', err)
  })

  return standardizedError
}

/**
 * Create appropriate HTTP headers for error responses
 */
function createErrorHeaders(definition: ErrorDefinition): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Error-Code': definition.code,
    'X-Error-Category': definition.category,
    'X-Error-Retryable': definition.retryable.toString(),
    'X-Error-Severity': definition.severity
  }

  // Add cache control for different error types
  switch (definition.category) {
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.VALIDATION:
      headers['Cache-Control'] = 'no-cache'
      break
    case ErrorCategory.RATE_LIMITING:
      headers['Cache-Control'] = 'no-store'
      headers['Retry-After'] = '60' // Suggest 60 seconds
      break
    case ErrorCategory.INTERNAL_SERVER:
    case ErrorCategory.DATABASE:
      headers['Cache-Control'] = 'no-store'
      break
    default:
      headers['Cache-Control'] = 'no-cache'
  }

  return headers
}

/**
 * Get retry delay in seconds for retryable errors
 */
function getRetryDelay(errorCode: ErrorCode, attempt: number = 1): number {
  const definition = getErrorDefinition(errorCode)

  if (!definition.retryable) return 0

  // Different retry strategies based on error category
  switch (definition.category) {
    case ErrorCategory.RATE_LIMITING:
      return Math.min(Math.pow(2, attempt - 1) * 60, 1800) // Exponential backoff, max 30 min

    case ErrorCategory.EXTERNAL_API:
    case ErrorCategory.AI_SERVICE:
      return Math.min(30 * attempt, 600) // Linear backoff, max 10 min

    case ErrorCategory.DATABASE:
    case ErrorCategory.INTERNAL_SERVER:
      return Math.min(120 * attempt, 3600) // Longer delays, max 60 min

    default:
      return 60 * attempt // Default 1 minute per attempt
  }
}

/**
 * Main error handler function - converts any error to H3Error with standardized response
 */
export function handleError(
  error: unknown,
  context: ErrorContext = {}
): never {
  const standardizedError = createStandardizedError(error, context)

  // Create H3 error with standardized format
  throw createError({
    statusCode: standardizedError.metadata!.httpStatus,
    statusMessage: standardizedError.error.userMessage,
    data: standardizedError
  })
}

/**
 * Async wrapper for error handling in event handlers
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    handleError(error, context)
  }
}

/**
 * Helper interface for errors with custom data
 */
interface ErrorWithData extends Error {
  data: Record<string, unknown>
}

/**
 * Create specific error types for common scenarios
 */
export const ErrorFactory = {
  validation(message?: string, details?: unknown, context: ErrorContext = {}): never {
    const error = new Error(message || 'Validation failed') as ErrorWithData
    error.data = { code: ErrorCode.VALIDATION_FAILED, details }
    handleError(error, context)
  },

  notFound(resource: string, context: ErrorContext = {}): never {
    const errorCode = resource === 'folder' ? ErrorCode.FOLDER_NOT_FOUND :
                     resource === 'user' ? ErrorCode.USER_NOT_FOUND :
                     resource === 'material' ? ErrorCode.MATERIAL_NOT_FOUND :
                     resource === 'flashcard' ? ErrorCode.FLASHCARD_NOT_FOUND :
                     resource === 'review' ? ErrorCode.REVIEW_NOT_FOUND :
                     ErrorCode.RESOURCE_NOT_FOUND

    const error = new Error(`${resource} not found`) as ErrorWithData
    error.data = { code: errorCode }
    handleError(error, { ...context, resource })
  },

  unauthorized(message?: string, context: ErrorContext = {}): never {
    const error = new Error(message || 'Authentication required') as ErrorWithData
    error.data = { code: ErrorCode.AUTH_REQUIRED }
    handleError(error, context)
  },

  forbidden(message?: string, context: ErrorContext = {}): never {
    const error = new Error(message || 'Access denied') as ErrorWithData
    error.data = { code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS }
    handleError(error, context)
  },

  quotaExceeded(type: 'generation' | 'storage' | 'general' = 'general', context: ErrorContext = {}): never {
    const errorCode = type === 'generation' ? ErrorCode.QUOTA_GENERATION_EXCEEDED :
                     type === 'storage' ? ErrorCode.QUOTA_STORAGE_EXCEEDED :
                     ErrorCode.QUOTA_EXCEEDED

    const error = new Error('Quota exceeded') as ErrorWithData
    error.data = { code: errorCode }
    handleError(error, context)
  },

  rateLimit(context: ErrorContext = {}): never {
    const error = new Error('Rate limit exceeded') as ErrorWithData
    error.data = { code: ErrorCode.RATE_LIMIT_EXCEEDED }
    handleError(error, context)
  },

  businessRule(rule: string, context: ErrorContext = {}): never {
    const error = new Error(`Business rule violation: ${rule}`) as ErrorWithData
    error.data = { code: ErrorCode.BUSINESS_RULE_VIOLATION }
    handleError(error, { ...context, metadata: { rule } })
  },

  externalService(service: string, originalError?: unknown, context: ErrorContext = {}): never {
    const errorCode = service.toLowerCase().includes('ai') ? ErrorCode.AI_GENERATION_FAILED :
                     service.toLowerCase().includes('email') ? ErrorCode.EMAIL_SEND_FAILED :
                     ErrorCode.EXTERNAL_API_ERROR

    const error = new Error(`${service} service error`) as ErrorWithData
    error.data = { code: errorCode, originalError }
    handleError(error, { ...context, metadata: { service, originalError } })
  }
} as const

/**
 * Utility to check if an error is from our standardized system
 */
export function isStandardizedError(error: unknown): error is { data: StandardizedError } {
  const err = error as Record<string, unknown>
  return Boolean(err?.data &&
         typeof err.data === 'object' &&
         (err.data as Record<string, unknown>)?.success === false &&
         (err.data as Record<string, unknown>)?.error)
}

/**
 * Extract error context from H3 event
 */
export function getErrorContextFromEvent(event: Record<string, unknown>): ErrorContext {
  const nodeReq = (event.node as Record<string, unknown>)?.req as Record<string, unknown>
  const headers = nodeReq?.headers as Record<string, string>
  const context = event.context as Record<string, unknown>
  const user = context?.user as Record<string, unknown>

  return {
    requestId: context?.requestId as string || headers?.['x-request-id'],
    userId: user?.id as string,
    clientIp: getClientIP(event),
    userAgent: headers?.['user-agent'],
    operation: `${nodeReq?.method} ${nodeReq?.url}`,
    timestamp: new Date()
  }
}

/**
 * Get client IP from various possible headers
 */
function getClientIP(event: Record<string, unknown>): string | undefined {
  const nodeReq = (event.node as Record<string, unknown>)?.req as Record<string, unknown>
  const headers = nodeReq?.headers as Record<string, string>
  const connection = nodeReq?.connection as Record<string, unknown>
  const socket = nodeReq?.socket as Record<string, unknown>

  return headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
         headers?.['x-real-ip'] ||
         headers?.['x-client-ip'] ||
         connection?.remoteAddress as string ||
         socket?.remoteAddress as string
}
