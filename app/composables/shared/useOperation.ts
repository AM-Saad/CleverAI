import type { APIError } from '~/services/FetchFactory'

/**
 * Composable for handling operations with centralized error handling
 * All errors are constructed by FetchFactory and available via error/typedError
 */
export function useOperation<T>() {
  const pending = ref(false)
  const error = ref<unknown>(null)
  const typedError = computed(() =>
    error.value instanceof Error && (error.value as Error).name === 'APIError'
      ? error.value as APIError
      : null
  )
  const data = ref<T | null>(null)

  const execute = async (operation: () => Promise<T>): Promise<T | null> => {
    pending.value = true
    error.value = null
    data.value = null

    try {
      const result = await operation()
      data.value = result
      return result
    } catch (err: unknown) {
      // Store the error for component access
      // FetchFactory has already constructed the proper APIError
      error.value = err
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
