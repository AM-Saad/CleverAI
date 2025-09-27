/**
 * Standardized API Response System for CleverAI
 *
 * This module provides consistent response formats for all API endpoints:
 * - Success responses with proper metadata
 * - Error responses with detailed information
 * - Pagination support
 * - Response validation
 * - Performance metrics
 */

import type { ErrorCode } from './errorTaxonomy'

// Base response interface that all API responses extend
export interface BaseAPIResponse {
  success: boolean
  timestamp: string
  requestId?: string
}

// Success Response
export interface APISuccessResponse<T = unknown> extends BaseAPIResponse {
  success: true
  data: T
  metadata?: {
    // Pagination
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
    // Performance
    performance?: {
      duration: number
      cached?: boolean
      queries?: number
    }
    // Additional context
    context?: Record<string, unknown>
  }
}

// Error Response (matches our standardized error format)
export interface APIErrorResponse extends BaseAPIResponse {
  success: false
  error: {
    code: ErrorCode
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

// Union type for all possible API responses
export type APIResponse<T = unknown> = APISuccessResponse<T> | APIErrorResponse

// Pagination parameters for requests
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Standard pagination defaults
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  maxLimit: 100
} as const

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    requestId?: string
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
    performance?: {
      duration: number
      cached?: boolean
      queries?: number
    }
    context?: Record<string, unknown>
  } = {}
): APISuccessResponse<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
    data,
    metadata: {
      pagination: options.pagination,
      performance: options.performance,
      context: options.context
    }
  }
}

/**
 * Create standardized pagination metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
} {
  const pages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  }
}

/**
 * Create performance metadata
 */
export function createPerformanceMeta(
  startTime: number,
  cached: boolean = false,
  queryCount: number = 0
): {
  duration: number
  cached?: boolean
  queries?: number
} {
  const duration = Date.now() - startTime

  return {
    duration,
    cached,
    queries: queryCount
  }
}

/**
 * Validate and normalize pagination parameters
 */
export function normalizePagination(params: PaginationParams): {
  page: number
  limit: number
  skip: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
} {
  const page = Math.max(1, params.page || DEFAULT_PAGINATION.page)
  const limit = Math.min(
    Math.max(1, params.limit || DEFAULT_PAGINATION.limit),
    DEFAULT_PAGINATION.maxLimit
  )
  const skip = (page - 1) * limit
  const sortOrder = params.sortOrder === 'desc' ? 'desc' : 'asc'

  return {
    page,
    limit,
    skip,
    sortBy: params.sortBy,
    sortOrder
  }
}

/**
 * Response builder class for fluent API response creation
 */
export class ResponseBuilder<T = unknown> {
  private _data?: T
  private _requestId?: string
  private _startTime?: number
  private _cached = false
  private _queryCount = 0
  private _context?: Record<string, unknown>

  constructor(requestId?: string) {
    this._requestId = requestId
    this._startTime = Date.now()
  }

  /**
   * Set the response data
   */
  data(data: T): ResponseBuilder<T> {
    this._data = data
    return this
  }

  /**
   * Mark response as cached
   */
  cached(cached = true): ResponseBuilder<T> {
    this._cached = cached
    return this
  }

  /**
   * Set query count for performance tracking
   */
  queryCount(count: number): ResponseBuilder<T> {
    this._queryCount = count
    return this
  }

  /**
   * Add context information
   */
  context(context: Record<string, unknown>): ResponseBuilder<T> {
    this._context = { ...this._context, ...context }
    return this
  }

  /**
   * Build success response
   */
  success(): APISuccessResponse<T> {
    return createSuccessResponse(this._data as T, {
      requestId: this._requestId,
      performance: this._startTime ? createPerformanceMeta(
        this._startTime,
        this._cached,
        this._queryCount
      ) : undefined,
      context: this._context
    })
  }

  /**
   * Build paginated success response
   */
  paginated(page: number, limit: number, total: number): APISuccessResponse<T> {
    return createSuccessResponse(this._data as T, {
      requestId: this._requestId,
      pagination: createPaginationMeta(page, limit, total),
      performance: this._startTime ? createPerformanceMeta(
        this._startTime,
        this._cached,
        this._queryCount
      ) : undefined,
      context: this._context
    })
  }
}

/**
 * Create a response builder instance
 */
export function createResponse<T = unknown>(requestId?: string): ResponseBuilder<T> {
  return new ResponseBuilder<T>(requestId)
}

/**
 * Common response patterns for different resource types
 */
export const ResponsePatterns = {
  /**
   * Create response for created resource (201)
   */
  created<T>(data: T, requestId?: string): APISuccessResponse<T> {
    return createResponse<T>(requestId)
      .data(data)
      .context({ action: 'create' })
      .success()
  },

  /**
   * Create response for updated resource (200)
   */
  updated<T>(data: T, requestId?: string): APISuccessResponse<T> {
    return createResponse<T>(requestId)
      .data(data)
      .context({ action: 'update' })
      .success()
  },

  /**
   * Create response for deleted resource (200)
   */
  deleted(resourceId: string, requestId?: string): APISuccessResponse<{ id: string; deleted: true }> {
    return createResponse<{ id: string; deleted: true }>(requestId)
      .data({ id: resourceId, deleted: true })
      .context({ action: 'delete' })
      .success()
  },

  /**
   * Create response for list with pagination
   */
  list<T>(
    items: T[],
    pagination: { page: number; limit: number; total: number },
    requestId?: string
  ): APISuccessResponse<T[]> {
    return createResponse<T[]>(requestId)
      .data(items)
      .context({ action: 'list', count: items.length })
      .paginated(pagination.page, pagination.limit, pagination.total)
  },

  /**
   * Create response for single resource retrieval
   */
  retrieved<T>(data: T, requestId?: string, cached = false): APISuccessResponse<T> {
    return createResponse<T>(requestId)
      .data(data)
      .cached(cached)
      .context({ action: 'retrieve' })
      .success()
  },

  /**
   * Create response for async operations
   */
  accepted(
    operationId: string,
    status: 'pending' | 'processing' | 'queued',
    requestId?: string
  ): APISuccessResponse<{ operationId: string; status: string; estimatedCompletion?: string }> {
    return createResponse<{ operationId: string; status: string; estimatedCompletion?: string }>(requestId)
      .data({
        operationId,
        status,
        estimatedCompletion: new Date(Date.now() + 30000).toISOString() // Default 30s
      })
      .context({ action: 'async', async: true })
      .success()
  },

  /**
   * Create response for count/statistics operations
   */
  count(count: number, breakdown?: Record<string, number>, requestId?: string): APISuccessResponse<{
    total: number
    breakdown?: Record<string, number>
  }> {
    return createResponse<{ total: number; breakdown?: Record<string, number> }>(requestId)
      .data({ total: count, breakdown })
      .context({ action: 'count' })
      .success()
  }
} as const

/**
 * Response validation schemas (using runtime validation)
 */
export const ResponseValidation = {
  /**
   * Validate that response has required success structure
   */
  validateSuccessResponse<T>(response: unknown): response is APISuccessResponse<T> {
    const resp = response as Record<string, unknown>
    return Boolean(
      resp &&
      resp.success === true &&
      resp.timestamp &&
      typeof resp.timestamp === 'string' &&
      resp.data !== undefined
    )
  },

  /**
   * Validate that response has required error structure
   */
  validateErrorResponse(response: unknown): response is APIErrorResponse {
    const resp = response as Record<string, unknown>
    const error = resp?.error as Record<string, unknown>

    return Boolean(
      resp &&
      resp.success === false &&
      resp.timestamp &&
      typeof resp.timestamp === 'string' &&
      error &&
      error.code &&
      error.message &&
      error.userMessage &&
      error.developerMessage
    )
  },

  /**
   * Validate pagination metadata
   */
  validatePagination(pagination: unknown): boolean {
    const p = pagination as Record<string, unknown>
    return Boolean(
      p &&
      typeof p.page === 'number' &&
      typeof p.limit === 'number' &&
      typeof p.total === 'number' &&
      typeof p.pages === 'number' &&
      typeof p.hasNext === 'boolean' &&
      typeof p.hasPrev === 'boolean'
    )
  }
} as const

/**
 * Response middleware for automatic formatting
 */
export function withStandardResponse<T>(
  handler: (event: Record<string, unknown>) => Promise<T>
) {
  return async (event: Record<string, unknown>): Promise<APISuccessResponse<T> | APIErrorResponse> => {
    const requestId = generateRequestId(event)

    const result = await handler(event)

    return createResponse<T>(requestId)
      .data(result)
      .success()
  }
}

/**
 * Generate a request ID for tracking
 */
function generateRequestId(event: Record<string, unknown>): string {
  const nodeReq = (event.node as Record<string, unknown>)?.req as Record<string, unknown>
  const headers = nodeReq?.headers as Record<string, string>
  const existingId = headers?.['x-request-id']

  if (existingId) return existingId

  // Generate new request ID
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `req_${timestamp}_${random}`
}

/**
 * Common HTTP status codes for API responses
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const
