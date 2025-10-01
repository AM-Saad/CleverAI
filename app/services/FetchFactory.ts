import type { $Fetch, FetchOptions } from "ofetch"
import type * as z from "zod"
export class APIError extends Error {
  public status: number | undefined
  public code: string | undefined
  public override cause:
    | { message?: string; status?: number; code?: string }
    | undefined

  constructor(
    message: string,
    cause: { message?: string; status?: number; code?: string } | undefined,
  ) {
    super(message)
    this.name = "APIError"
    this.cause = cause
    this.status = cause?.status
    this.code = cause?.code
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
  async call<T>(method: string, url: string, data?: object, fetchOptions?: FetchOptions<"json">): Promise<T>
  async call<TSchema extends z.ZodTypeAny>(method: string, url: string, data: object | undefined, fetchOptions: FetchOptions<"json"> | undefined, validator: TSchema): Promise<z.infer<TSchema>>
  async call<T, TSchema extends z.ZodTypeAny>(
    method: string,
    url: string,
    data?: object,
    fetchOptions: FetchOptions<"json"> = {},
    validator?: TSchema,
  ): Promise<T | z.infer<TSchema>> {
    const attemptLimit = this.retries + 1
    let attempt = 0
    let lastError: unknown

    while (attempt < attemptLimit) {
      try {
        const rawResp: MaybeEnvelope<unknown> = await this.$fetch(`${this.baseUrl}${url}`, {
          method,
            body: data,
            ...fetchOptions,
            // Don't throw on HTTP error responses - we want to process the error envelope
            ignoreResponseError: true,
            onResponseError: ({ response }) => {
              if (import.meta.dev) console.log("🔥 FF: onResponseError", response.status, response._data)
            },
        })

        // Unified envelope path
        if (rawResp && typeof rawResp === 'object' && 'success' in rawResp) {
          const env = rawResp as SuccessEnvelope<unknown> | FailureEnvelope
          if ((env as SuccessEnvelope).success === true) {
            let payload: unknown = (env as SuccessEnvelope).data
            if (validator) {
              try { payload = validator.parse(payload) } catch (zErr) {
                const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
                throw new APIError('ZOD:Response Validation failed', { message: firstMsg || 'Invalid response shape', status: 500, code: 'INVALID_RESPONSE' })
              }
            }
            return payload as (TSchema extends z.ZodTypeAny ? z.infer<TSchema> : T)
          }
          if ((env as FailureEnvelope).success === false) {
            const e = (env as FailureEnvelope).error
            throw new APIError(e.message, { message: e.message, status: e.statusCode, code: e.code })
          }
        }

        // Legacy path
        let legacyPayload: unknown = rawResp
        if (validator) {
          try { legacyPayload = validator.parse(legacyPayload) } catch (zErr) {
            const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
            throw new APIError('ZOD:Response Validation failed', { message: firstMsg || 'Invalid response shape', status: 500, code: 'INVALID_RESPONSE' })
          }
        }
        return legacyPayload as T
      } catch (err) {
        lastError = err
        // Normalize network / transport errors (TypeError from fetch, AbortError, etc.)
        if (err instanceof Error) {
          const isAbort = err.name === 'AbortError'
          const isNetworkLike = err.name === 'FetchError' || err instanceof TypeError
          if (isAbort) {
            const apiErr = new APIError('Request aborted', { message: 'Request aborted', status: 499, code: 'ABORTED' })
            if (this.onErrorHook) { await this.onErrorHook(apiErr) }
            throw apiErr
          }
          if (isNetworkLike) {
            const apiErr = new APIError('Network error', { message: err.message || 'Network error', status: 0, code: 'NETWORK_ERROR' })
            if (this.onErrorHook) { await this.onErrorHook(apiErr) }
            throw apiErr
          }
          // If already APIError, consider retry logic
          if (err instanceof APIError) {
            const status = err.status
            if (status && (status === 429 || status === 503) && attempt < attemptLimit - 1) {
              const backoff = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 250
              await new Promise(r => setTimeout(r, backoff))
              attempt++
              continue
            }
            if (this.onErrorHook) { await this.onErrorHook(err) }
            throw err
          }
          // Extract structured h3 error style objects
          const anyErr = err as unknown as Record<string, unknown>
          if ('error' in anyErr && anyErr.error && typeof anyErr.error === 'object') {
            const ne = anyErr.error as { message?: string; statusCode?: number; code?: string }
            if (ne.message) {
              const apiErr = new APIError(ne.message, { message: ne.message, status: ne.statusCode, code: ne.code })
              if (this.onErrorHook) { await this.onErrorHook(apiErr) }
              throw apiErr
            }
          }
          if ('data' in anyErr && anyErr.data && typeof anyErr.data === 'object') {
            const d = anyErr.data as Record<string, unknown>
            if ('error' in d && d.error && typeof d.error === 'object') {
              const pe = d.error as { message?: string; statusCode?: number; code?: string }
              if (pe.message) {
                const apiErr = new APIError(pe.message, { message: pe.message, status: pe.statusCode, code: pe.code })
                if (this.onErrorHook) { await this.onErrorHook(apiErr) }
                throw apiErr
              }
            }
            const message = (d.message as string) || 'Unhandled server error'
            const status = (d.status as number) || (d.statusCode as number | undefined)
            const code = d.code as string | undefined
            const apiErr = new APIError(message, { message, status, code })
            if (this.onErrorHook) { await this.onErrorHook(apiErr) }
            throw apiErr
          }
        }
        // Fallback untyped error; wrap & throw
        const apiErr = new APIError('Unknown error', { message: 'Unknown error', status: 500, code: 'UNKNOWN' })
        if (this.onErrorHook) { await this.onErrorHook(apiErr) }
        throw apiErr
      }
    }
    // Exhausted attempts
    throw lastError
  }
}

export default FetchFactory
