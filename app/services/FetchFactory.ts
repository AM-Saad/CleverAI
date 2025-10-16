import type { $Fetch, FetchOptions } from "ofetch"
import type * as z from "zod"
import type { Result } from "~/types/Result"
import { Result as R } from "~/types/Result"
export class APIError extends Error {
  public status: number | undefined
  public code: string | undefined
  public details: unknown | undefined
  public override cause:
    | { message?: string; status?: number; code?: string, details?: unknown }
    | undefined

  constructor(
    message: string,
    cause: { message?: string; status?: number; code?: string, details?: unknown } | undefined,
  ) {
    super(message)
    this.name = "APIError"
    this.cause = cause
    this.status = cause?.status
    this.code = cause?.code
    this.details = cause?.details
  }
}

interface SuccessEnvelope<D = unknown> { success: true; data: D }
interface FailureEnvelope { success: false; error: { message: string; statusCode?: number; code?: string } }

type MaybeEnvelope<T> = T | SuccessEnvelope<T> | FailureEnvelope

type OnErrorHook = (error: APIError) => void | Promise<void>

class FetchFactory {
  private $fetch: $Fetch
  private baseUrl: string
  private retries: number
  private onErrorHook?: OnErrorHook

  constructor(fetcher: $Fetch, baseUrl = "", retries = 0, onErrorHook?: OnErrorHook) {
    this.$fetch = fetcher
    this.baseUrl = baseUrl
    this.retries = retries
    this.onErrorHook = onErrorHook
  }

  setOnError(h: OnErrorHook) { this.onErrorHook = h }

  // Convenience helper for consumers wanting cancellation support
  static controller() { return new AbortController() }

  // Overloads for better inference when a validator is provided
  async call<T>(method: string, url: string, data?: object, fetchOptions?: FetchOptions<"json">): Promise<Result<T>>

  async call<TSchema extends z.ZodTypeAny>(method: string, url: string, data: object | undefined, fetchOptions: FetchOptions<"json"> | undefined, validator: TSchema): Promise<Result<z.infer<TSchema>>>

  async call<T, TSchema extends z.ZodTypeAny>(
    method: string,
    url: string,
    data?: object,
    fetchOptions: FetchOptions<"json"> = {},
    validator?: TSchema,
  ): Promise<Result<TSchema extends z.ZodTypeAny ? z.infer<TSchema> : T>> {
    const attemptLimit = this.retries + 1
    const attempt = 0
    let lastError: APIError | null = null

    while (attempt < attemptLimit) {
      try {
        const rawResp: MaybeEnvelope<unknown> = await this.$fetch(`${this.baseUrl}${url}`, {
          method,
            body: data,
            ...fetchOptions,
        })

        // Unified envelope path
        if (rawResp && typeof rawResp === 'object' && 'success' in rawResp) {
          const env = rawResp as SuccessEnvelope<unknown> | FailureEnvelope
          if ((env as SuccessEnvelope).success === true) {
            let payload: unknown = (env as SuccessEnvelope).data
            if (validator) {
              try {
                payload = validator.parse(payload)
              } catch (zErr) {
                const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
                const validationError = new APIError('ZOD:Response Validation failed', {
                  message: firstMsg || 'Invalid response shape',
                  status: 500,
                  code: 'INVALID_RESPONSE'
                })
                return R.error(validationError)
              }
            }
            return R.success(payload as (TSchema extends z.ZodTypeAny ? z.infer<TSchema> : T))
          }
          if ((env as FailureEnvelope).success === false) {
            const e = (env as FailureEnvelope).error
            const apiError = new APIError(e.message, { message: e.message, status: e.statusCode, code: e.code })
            return R.error(apiError)
          }
        }

        // Legacy path
        let legacyPayload: unknown = rawResp
        if (validator) {
          try {
            legacyPayload = validator.parse(legacyPayload)
          } catch (zErr) {
            const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
            const validationError = new APIError('ZOD:Response Validation failed', {
              message: firstMsg || 'Invalid response shape',
              status: 500,
              code: 'INVALID_RESPONSE'
            })
            return R.error(validationError)
          }
        }
        return R.success(legacyPayload as (TSchema extends z.ZodTypeAny ? z.infer<TSchema> : T))
      } catch (err) {
        lastError = this.normalizeError(err)
        console.log('🔄 FetchFactory - caught error:', lastError)

        // Call error hook if provided
        if (this.onErrorHook) {
          await this.onErrorHook(lastError)
        }

        // Don't throw - we'll return the error as a Result
        break
      }
    }

    // Return the last error as a failed Result
    return R.error(lastError || new APIError('Unknown error', { code: 'UNKNOWN_ERROR', status: 500 }))
  }

  /**
   * Normalize any error into an APIError
   */
  private normalizeError(err: unknown): APIError {
    if (err && typeof err === 'object' && 'data' in err) {
      const fetchError = err as { data?: unknown; message?: string; statusCode?: number }
      const data = fetchError.data

      // Check if server sent our standard error format
      if (data && typeof data === 'object' && 'success' in data && data.success === false && 'error' in data) {
        const envelope = data as { success: false; error: { message?: string; statusCode?: number; code?: string; details?: unknown } }
        const errorInfo = envelope.error

        return new APIError(errorInfo.message || 'API Error', {
          status: errorInfo.statusCode || fetchError.statusCode,
          code: errorInfo.code,
          details: errorInfo.details,
          message: errorInfo.message
        })
      } else {
        // Fallback for other fetch errors
        return new APIError(fetchError.message || 'Network Error', {
          status: fetchError.statusCode,
          code: 'FETCH_ERROR',
          message: fetchError.message
        })
      }
    } else {
      // Fallback for non-fetch errors
      return new APIError(
        err instanceof Error ? err.message : 'Unknown Error',
        {
          status: undefined,
          code: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'Unknown Error'
        }
      )
    }
  }
}

export default FetchFactory
