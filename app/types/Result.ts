// types/Result.ts

import type { APIError } from "~/services/FetchFactory"

/**
 * Result type for error handling without exceptions
 * Eliminates the need for H3Error wrapping and extraction
 */
export type Result<T, E = APIError> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Utility functions for working with Results
 */
export const Result = {
  /**
   * Create a successful result
   */
  success: <T>(data: T): Result<T> => ({ success: true, data }),

  /**
   * Create a failed result
   */
  error: <T, E = APIError>(error: E): Result<T, E> => ({ success: false, error }),

  /**
   * Check if result is successful
   */
  isSuccess: <T, E>(result: Result<T, E>): result is { success: true; data: T } =>
    result.success === true,

  /**
   * Check if result is an error
   */
  isError: <T, E>(result: Result<T, E>): result is { success: false; error: E } =>
    result.success === false,

  /**
   * Extract data from successful result, or return null
   */
  getData: <T, E>(result: Result<T, E>): T | null =>
    result.success ? result.data : null,

  /**
   * Extract error from failed result, or return null
   */
  getError: <T, E>(result: Result<T, E>): E | null =>
    result.success ? null : result.error,

  /**
   * Transform a successful result's data
   */
  map: <T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> =>
    result.success
      ? { success: true, data: fn(result.data) }
      : result,

  /**
   * Chain operations on successful results
   */
  flatMap: <T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> =>
    result.success
      ? fn(result.data)
      : result,

  /**
   * Handle both success and error cases
   */
  match: <T, E, R>(
    result: Result<T, E>,
    handlers: {
      success: (data: T) => R
      error: (error: E) => R
    }
  ): R => result.success
    ? handlers.success(result.data)
    : handlers.error(result.error)
}

/**
 * Type guard to check if a value is a Result
 */
export function isResult<T, E>(value: unknown): value is Result<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as Record<string, unknown>).success === 'boolean' &&
    ((value as Record<string, unknown>).success === true ? 'data' in value : 'error' in value)
  )
}

export default Result
