// DEPRECATED: Replaced by server/utils/error.ts and app/lib/apiClient.ts
// Kept temporarily to avoid breaking imports. Remove after migrating all usage.
import { createError } from 'h3'

export enum ErrorType {
  Validation = 'ValidationError',
  Auth = 'AuthError',
  NotFound = 'NotFoundError',
  Server = 'ServerError'
}

export class ErrorFactory {
  /**
   * @deprecated Use Errors.* helpers from server/utils/error instead.
   */
  static create(
    type: ErrorType,
    resource: string,
    message?: string,
    extraData: Record<string, unknown> = {}
  ) {
    return createError({
      statusCode: 500,
      statusMessage: message || 'Deprecated error factory',
      data: { resource, ...extraData, type, deprecated: true }
    })
  }
}
