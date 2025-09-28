// Simple frontend API client wrapping fetch and normalizing errors
export interface AppAPIError {
  code: string
  message: string
  statusCode: number
  details?: unknown
}

export class AppError extends Error {
  code: string
  statusCode: number
  details?: unknown
  constructor(payload: AppAPIError) {
    super(payload.message)
    this.code = payload.code
    this.statusCode = payload.statusCode
    this.details = payload.details
  }
}

async function parseJSON(res: Response) {
  try { return await res.json() } catch { return null }
}

export async function apiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const body = await parseJSON(res)

  if (!res.ok) {
    // Expect unified shape { success:false, error:{...} }
    if (body && body.success === false && body.error) {
      throw new AppError(body.error as AppAPIError)
    }
    throw new AppError({ code: 'HTTP_ERROR', message: res.statusText || 'Request failed', statusCode: res.status })
  }

  if (body && body.success === true) return body.data as T
  // Fallback: raw body
  return body as T
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
