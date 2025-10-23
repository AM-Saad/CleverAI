/**
 * Simple Error Utilities
 *
 * Provides basic error message extraction without complex UI generation
 * Let your UI framework (Vue/Nuxt components) handle the actual display
 */

/**
 * Standardized API error response (matches server structure)
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    userMessage?: string;
    status?: number;
    details?: unknown;
  };
}

/**
 * Extract user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  // API Error with userMessage
  if (isAPIError(error) && error.error.userMessage) {
    return error.error.userMessage;
  }

  // API Error with regular message
  if (isAPIError(error)) {
    return error.error.message;
  }

  // H3Error from Nuxt (check cause first)
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause: unknown }).cause;
    if (cause && typeof cause === "object" && cause !== null) {
      const causeObj = cause as Record<string, unknown>;
      if (typeof causeObj.userMessage === "string") return causeObj.userMessage;
      if (typeof causeObj.message === "string") return causeObj.message;
    }
  }

  // Regular Error
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback
  return "An unexpected error occurred";
}

/**
 * Extract error code from any error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isAPIError(error)) {
    return error.error.code;
  }

  // Check H3Error cause
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause: unknown }).cause;
    if (cause && typeof cause === "object" && cause !== null) {
      const causeObj = cause as Record<string, unknown>;
      if (typeof causeObj.code === "string") return causeObj.code;
    }
  }

  return undefined;
}

/**
 * Extract HTTP status from any error
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isAPIError(error) && error.error.status) {
    return error.error.status;
  }

  // Check H3Error properties
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.statusCode === "number") return err.statusCode;
    if (typeof err.status === "number") return err.status;

    // Check cause
    if (err.cause && typeof err.cause === "object" && err.cause !== null) {
      const cause = err.cause as Record<string, unknown>;
      if (typeof cause.statusCode === "number") return cause.statusCode;
      if (typeof cause.status === "number") return cause.status;
    }
  }

  return undefined;
}

/**
 * Check if error is retryable based on status/code
 */
export function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  // Network errors are usually retryable
  if (code === "NETWORK_ERROR" || code === "FETCH_ERROR") return true;

  // Server errors (5xx) are retryable
  if (status && status >= 500) return true;

  // Rate limiting is retryable (after delay)
  if (status === 429 || code === "RATE_LIMITED") return true;

  // Client errors (4xx) are generally not retryable
  if (status && status >= 400 && status < 500) return false;

  // Default to retryable for unknown errors
  return true;
}

/**
 * Type guard for API error response
 */
function isAPIError(error: unknown): error is APIErrorResponse {
  return Boolean(
    error &&
      typeof error === "object" &&
      "success" in error &&
      (error as APIErrorResponse).success === false &&
      "error" in error &&
      typeof (error as APIErrorResponse).error === "object"
  );
}

/**
 * Simple async operation wrapper with error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<{ data: T | null; error: unknown | null }> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (error) {
    onError?.(error);
    return { data: null, error };
  }
}

/**
 * Log error details in development
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`Error${context ? ` in ${context}` : ""}:`, {
      message: getErrorMessage(error),
      code: getErrorCode(error),
      status: getErrorStatus(error),
      error,
    });
  }
}
