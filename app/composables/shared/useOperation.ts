import type { Result } from '~/types/Result'
import type { APIError } from '~/services/FetchFactory'

/**
 * Result-based useOperation - No more error throwing/catching!
 * Operations return Result<T> so we can handle success/failure explicitly
 */
export function useOperation<T>() {
  const pending = ref(false)
  const error = ref<APIError | null>(null)
  const data = ref<T | null>(null)

  // Since we use Result pattern, error is always an APIError when present
  const typedError = computed(() => error.value)

  const execute = async (operation: () => Promise<Result<T>>): Promise<T | null> => {
    pending.value = true
    error.value = null
    data.value = null

    try {
      const result = await operation()

      if (result.success) {
        // Success: extract data
        data.value = result.data
        return result.data
      } else {
        // Failure: extract error
        error.value = result.error
        return null
      }
    } catch (err: unknown) {
      // Fallback: if operation itself throws (shouldn't happen with Result pattern)
      console.warn('useOperation: operation threw instead of returning Result', err)
      error.value = {
        message: err instanceof Error ? err.message : 'Unknown error',
        status: 500,
        code: 'OPERATION_ERROR'
      } as APIError
      return null
    } finally {
      pending.value = false
    }
  }

  const reset = () => {
    pending.value = false
    error.value = null
    data.value = null
  }

  return {
    pending: readonly(pending),
    error: readonly(error),
    typedError,
    data: readonly(data),
    execute,
    reset
  }
}
