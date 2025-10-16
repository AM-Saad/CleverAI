/* Simple centralized error utilities */
import { createError } from 'h3'

export interface APIErrorPayload {
  code: string
  message: string
  details?: unknown
  statusCode: number
}

export function apiError(code: string, message: string, statusCode = 400, details?: unknown) {
  return createError<APIErrorPayload>({
    statusCode,
    statusMessage: message,
    data: { code, message, details, statusCode }
  })
}

export const Errors = {
  badRequest: (message = 'Bad request', details?: unknown) => apiError('BAD_REQUEST', message, 400, details),
  paymentRequired: (message = 'Payment required', details?: unknown) => apiError('PAYMENT_REQUIRED', message, 402, details),
  unauthorized: (message = 'Unauthorized') => apiError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Forbidden') => apiError('FORBIDDEN', message, 403),
  notFound: (resource = 'resource') => apiError('NOT_FOUND', `${resource} not found`, 404),
  methodNotAllowed: (message = 'Method not allowed') => apiError('METHOD_NOT_ALLOWED', message, 405),
  conflict: (message = 'Conflict') => apiError('CONFLICT', message, 409),
  rateLimit: (message = 'Too many requests') => apiError('RATE_LIMIT', message, 429),
  server: (message = 'Internal server error', details?: unknown) => apiError('INTERNAL_SERVER_ERROR', message, 500, details)
} as const

export type AppSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> }
export type AppFailure = { success: false; error: APIErrorPayload }
export type AppResponse<T> = AppSuccess<T> | AppFailure

export function success<T>(data: T, meta?: Record<string, unknown>): AppSuccess<T> {
  return { success: true, data, meta }
}

// Narrow h3 error shape we care about
interface H3LikeError {
  statusCode?: number
  statusMessage?: string
  data?: unknown
}

// Utility to normalize unknown errors
export function normalizeError(err: unknown): AppFailure {
  if (typeof err === 'object' && err !== null) {
    const e = err as H3LikeError
    if (typeof e.statusCode === 'number') {
      // If data already matches our payload
      const payload = e.data as Partial<APIErrorPayload> | undefined
      if (payload && typeof payload.code === 'string' && typeof payload.message === 'string') {
        return { success: false, error: {
          code: payload.code,
          message: payload.message,
          statusCode: payload.statusCode ?? e.statusCode ?? 500,
          details: payload.details
        } }
      }
      return { success: false, error: {
        code: 'UNHANDLED_ERROR',
        message: e.statusMessage || 'Unexpected error',
        statusCode: e.statusCode || 500,
        details: e.data
      } }
    }
  }
  return { success: false, error: {
    code: 'UNEXPECTED',
    message: err instanceof Error ? err.message : 'Unknown error',
    statusCode: 500
  } }
}
