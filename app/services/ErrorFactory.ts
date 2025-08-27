import { createError } from "h3" // or Nuxt’s internal

export enum ErrorType {
  Validation = "ValidationError",
  Auth = "AuthError",
  NotFound = "NotFoundError",
  Server = "ServerError",
}

export class ErrorFactory {
  static create(
    type: ErrorType,
    resource: string,
    message?: string,
    extraData: Record<string, unknown> = {},
  ) {
    switch (type) {
      case ErrorType.Validation:
        return createError({
          statusCode: 400,
          statusMessage: message || "Validation failed",
          data: { resource, ...extraData, type },
        })

      case ErrorType.Auth:
        return createError({
          statusCode: 401,
          statusMessage: message || "Unauthorized",
          data: { resource, ...extraData, type },
        })

      case ErrorType.NotFound:
        return createError({
          statusCode: 404,
          statusMessage: message || `${resource} not found`,
          data: { resource, ...extraData, type },
        })

      case ErrorType.Server:
        return createError({
          statusCode: 500,
          statusMessage: message || "Server error",
          data: { resource, ...extraData, type },
        })

      default:
        throw new Error("Unsupported error type")
    }
  }
}
