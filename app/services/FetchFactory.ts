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

class FetchFactory {
  private $fetch: $Fetch
  private baseUrl: string
  private retries: number

  constructor(fetcher: $Fetch, baseUrl = "", retries = 0) {
    this.$fetch = fetcher
    this.baseUrl = baseUrl
    this.retries = retries
  }

  async call<T>(
    method: string,
    url: string,
    data?: object,
    fetchOptions: FetchOptions<"json"> = {},
    validator?: z.ZodTypeAny,
  ): Promise<T> {
    try {
      const rawResp: MaybeEnvelope<unknown> = await this.$fetch(`${this.baseUrl}${url}`, {
        method,
        body: data,
        ...fetchOptions,
        onResponseError({ response }) {
          console.log("🔥 FF: onResponseError fired", response.status, response._data)
        },
      })

      // Unified contract
      if (rawResp && typeof rawResp === 'object' && 'success' in rawResp) {
        const env = rawResp as SuccessEnvelope<unknown> | FailureEnvelope
        if ('success' in env && env.success === true) {
          let payload: unknown = env.data
          if (validator) {
            try {
              payload = validator.parse(payload) as unknown
            } catch (zErr) {
              const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
              throw new APIError("ZOD:Response Validation failed", {
                message: firstMsg || "Invalid response shape",
                code: "INVALID_RESPONSE",
                status: 500,
              })
            }
          }
          return payload as T
        }
        if ('success' in env && env.success === false) {
          const e = (env as FailureEnvelope).error
          throw new APIError(e.message, { message: e.message, status: e.statusCode, code: e.code })
        }
      }

      // Legacy raw body path
      let legacyPayload: unknown = rawResp
      if (validator) {
        try {
          legacyPayload = validator.parse(legacyPayload) as unknown
        } catch (zErr) {
          const firstMsg = (zErr as { errors?: Array<{ message: string }> }).errors?.[0]?.message
          throw new APIError("ZOD:Response Validation failed", {
            message: firstMsg || "Invalid response shape",
            code: "INVALID_RESPONSE",
            status: 500,
          })
        }
      }
      return legacyPayload as T
    } catch (err) {
      console.log("🔥 FF: Caught in FetchFactory", err)

      if (err && typeof err === 'object') {
        const anyErr = err as Record<string, unknown>
        // New contract bubbled error
        if ('error' in anyErr && anyErr.error && typeof anyErr.error === 'object') {
          const ne = anyErr.error as { message?: string; statusCode?: number; code?: string }
          if (ne.message) {
            throw new APIError(ne.message, { message: ne.message, status: ne.statusCode, code: ne.code })
          }
        }
        if ('data' in anyErr && anyErr.data && typeof anyErr.data === 'object') {
          const d = anyErr.data as Record<string, unknown>
          if ('error' in d && d.error && typeof d.error === 'object') {
            const pe = d.error as { message?: string; statusCode?: number; code?: string }
            if (pe.message) {
              throw new APIError(pe.message, { message: pe.message, status: pe.statusCode, code: pe.code })
            }
          }
          const message = (d.message as string) || 'Unhandled server error'
          const status = (d.status as number) || (d.statusCode as number | undefined)
          const code = d.code as string | undefined
          throw new APIError(message, { message, status, code })
        }
      }

      throw err
    }
  }
}

export default FetchFactory
