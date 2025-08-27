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
      const response = await this.$fetch<T>(`${this.baseUrl}${url}`, {
        method,
        body: data,
        ...fetchOptions,
        onResponseError({ response }) {
          console.log("🔥 FF: onResponseError fired", response.status, response._data)
        },
      })

      if (validator) {
        console.log("🔥 FF: Validating response with Zod schema", validator);
        console.log("🔥 FF: Response data", response);
        try {
          return validator.parse(response)
        } catch (zodError: any) {
          throw new APIError("ZOD:Response Validation failed", {
            message: zodError.errors?.[0]?.message || "Invalid response shape",
            code: "INVALID_RESPONSE",
            status: 500,
          })
        }
      }

      return response
    } catch (err: any) {
      console.log("🔥 FF: Caught in FetchFactory", err)

      if (err && typeof err === "object" && "data" in err) {
        throw new APIError(
          err.data?.message || "Unhandled server error",
          {
            message: err.data?.message,
            status: err.data?.status,
            code: err.data?.code,
          },
        )
      }

      throw err
    }
  }
}

export default FetchFactory
