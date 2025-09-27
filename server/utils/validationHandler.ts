/**
 * Simplified validation error handling with user-friendly messages
 * Core validation functionality for the standardized error handling system
 */

import type { ZodIssue, ZodSchema } from 'zod'
import { handleError, type ErrorContext, ErrorFactory } from './standardErrorHandler'
import { ErrorCode } from './errorTaxonomy'

/**
 * Field-specific validation error with enhanced context
 */
export interface FieldValidationError {
  field: string
  code: string
  message: string
  userMessage: string
  received?: unknown
  constraint?: {
    type: 'min' | 'max' | 'pattern' | 'enum' | 'custom'
    value?: unknown
    expected?: unknown
  }
}

/**
 * Validation result with detailed field-level errors
 */
export interface ValidationResult<T = unknown> {
  success: boolean
  data?: T
  errors?: FieldValidationError[]
  summary?: {
    totalErrors: number
    fieldCount: number
    errorTypes: string[]
  }
}

/**
 * User-friendly validation messages
 */
const VALIDATION_MESSAGES = {
  required: 'This field is required',
  invalid_type: 'Please provide a valid value',
  string_min: (min: number) => `Must be at least ${min} characters long`,
  string_max: (max: number) => `Must be no more than ${max} characters long`,
  string_email: 'Please enter a valid email address',
  string_url: 'Please enter a valid URL',
  number_min: (min: number) => `Must be at least ${min}`,
  number_max: (max: number) => `Must be no more than ${max}`,
  array_empty: 'Please select at least one option',
  invalid_enum: 'Please select a valid option',
  invalid_date: 'Please enter a valid date'
}

/**
 * Convert Zod issue to field validation error with user-friendly messages
 */
function zodIssueToFieldError(issue: ZodIssue): FieldValidationError {
  const field = issue.path.join('.')
  const issueAny = issue as unknown as Record<string, unknown>

  let userMessage = issue.message
  let constraint: FieldValidationError['constraint']

  // Generate user-friendly messages based on validation type
  switch (issue.code) {
    case 'invalid_type':
      if (issueAny.expected === 'string' && issueAny.received === 'undefined') {
        userMessage = VALIDATION_MESSAGES.required
      } else {
        userMessage = VALIDATION_MESSAGES.invalid_type
      }
      constraint = {
        type: 'custom',
        expected: issueAny.expected,
        value: issueAny.received
      }
      break

    case 'too_small':
      if (issueAny.type === 'string') {
        userMessage = VALIDATION_MESSAGES.string_min(issueAny.minimum as number)
      } else if (issueAny.type === 'number') {
        userMessage = VALIDATION_MESSAGES.number_min(issueAny.minimum as number)
      } else if (issueAny.type === 'array' && issueAny.minimum === 1) {
        userMessage = VALIDATION_MESSAGES.array_empty
      }
      constraint = {
        type: 'min',
        value: issueAny.minimum,
        expected: issueAny.minimum
      }
      break

    case 'too_big':
      if (issueAny.type === 'string') {
        userMessage = VALIDATION_MESSAGES.string_max(issueAny.maximum as number)
      } else if (issueAny.type === 'number') {
        userMessage = VALIDATION_MESSAGES.number_max(issueAny.maximum as number)
      }
      constraint = {
        type: 'max',
        value: issueAny.maximum,
        expected: issueAny.maximum
      }
      break

    case 'invalid_union':
      userMessage = VALIDATION_MESSAGES.invalid_enum
      constraint = {
        type: 'enum',
        expected: issueAny.options
      }
      break
  }

  return {
    field,
    code: issue.code,
    message: issue.message,
    userMessage,
    received: issueAny.received,
    constraint
  }
}

/**
 * Validation function with enhanced error handling
 */
export async function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context: ErrorContext = {}
): Promise<ValidationResult<T>> {
  try {
    const result = schema.parse(data)
    return {
      success: true,
      data: result
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: ZodIssue[] }
      const fieldErrors = zodError.issues.map(zodIssueToFieldError)
      return {
        success: false,
        errors: fieldErrors,
        summary: {
          totalErrors: fieldErrors.length,
          fieldCount: new Set(fieldErrors.map(e => e.field)).size,
          errorTypes: [...new Set(fieldErrors.map(e => e.code))]
        }
      }
    }

    // Handle non-Zod errors
    throw handleError(error, {
      operation: 'validateWithSchema',
      ...context
    })
  }
}

/**
 * Safe validation that throws standardized errors
 */
export async function validateOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context: ErrorContext = {}
): Promise<T> {
  const result = await validateWithSchema(schema, data, context)

  if (!result.success) {
    const errors = result.errors || []
    ErrorFactory.validation(
      `Validation failed with ${errors.length} error${errors.length !== 1 ? 's' : ''}`,
      errors,
      context
    )
  }

  return result.data!
}

/**
 * Validation helper for HTTP request body
 */
export async function validateBody<T>(
  event: { body?: unknown },
  schema: ZodSchema<T>
): Promise<T> {
  if (!event.body) {
    throw handleError(ErrorCode.VALIDATION_FAILED, {
      operation: 'validateBody'
    })
  }

  return validateOrThrow(schema, event.body, {
    operation: 'validateBody'
  })
}

/**
 * Validation helper for query parameters
 */
export async function validateQuery<T>(
  event: { query?: unknown },
  schema: ZodSchema<T>
): Promise<T> {
  return validateOrThrow(schema, event.query || {}, {
    operation: 'validateQuery'
  })
}

/**
 * Synchronous validation for simple cases
 */
export function validateSync<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data)
    return {
      success: true,
      data: result
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: ZodIssue[] }
      const fieldErrors = zodError.issues.map(zodIssueToFieldError)
      return {
        success: false,
        errors: fieldErrors,
        summary: {
          totalErrors: fieldErrors.length,
          fieldCount: new Set(fieldErrors.map(e => e.field)).size,
          errorTypes: [...new Set(fieldErrors.map(e => e.code))]
        }
      }
    }

    return {
      success: false,
      errors: [{
        field: 'unknown',
        code: 'validation_error',
        message: 'Validation failed',
        userMessage: 'Please check your input and try again'
      }]
    }
  }
}

/**
 * Common validation error creators
 */
export const ValidationErrors = {
  folderNotFound: (folderId: string, context: ErrorContext = {}) => {
    return handleError(ErrorCode.RESOURCE_NOT_FOUND, {
      operation: 'folderValidation',
      resource: `folder:${folderId}`,
      metadata: { folderId, resourceType: 'folder' },
      ...context
    })
  },

  emailNotUnique: (email: string, context: ErrorContext = {}) => {
    const error = new Error('Email already exists') as Error & {
      code: string;
      statusCode: number;
      data?: unknown
    }
    error.code = ErrorCode.VALIDATION_FAILED
    error.statusCode = 400
    error.data = { email, field: 'email' }

    return handleError(error, {
      operation: 'emailValidation',
      metadata: { email, field: 'email' },
      ...context
    })
  },

  resourceLimitExceeded: (resourceType: string, limit: number, context: ErrorContext = {}) => {
    const error = new Error(`${resourceType} limit exceeded`) as Error & {
      code: string;
      statusCode: number;
      data?: unknown
    }
    error.code = ErrorCode.VALIDATION_FAILED
    error.statusCode = 400
    error.data = { resourceType, limit }

    return handleError(error, {
      operation: 'resourceLimitValidation',
      resource: resourceType,
      metadata: { resourceType, limit },
      ...context
    })
  }
}
