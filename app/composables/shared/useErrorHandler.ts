/**
 * Simplified Error Handling Composable
 *
 * Provides basic reactive error state for Vue components
 * Uses simple error utilities instead of complex UI generation
 */

/**
 * Basic error handling composable
 */
export function useErrorHandler(context?: string) {
  const currentError = ref<unknown>(null);

  const isError = computed(() => currentError.value !== null);
  const errorMessage = computed(() =>
    currentError.value ? getErrorMessage(currentError.value) : "",
  );
  const errorCode = computed(() =>
    currentError.value ? getErrorCode(currentError.value) : undefined,
  );
  const errorStatus = computed(() =>
    currentError.value ? getErrorStatus(currentError.value) : undefined,
  );

  /**
   * Set current error and log it
   */
  const setError = (error: unknown, errorContext?: string) => {
    currentError.value = error;
    logError(error, errorContext || context);
  };

  /**
   * Clear current error
   */
  const clearError = () => {
    currentError.value = null;
  };

  /**
   * Handle async operation with error catching
   */
  const handleAsync = async <T>(
    operation: () => Promise<T>,
    options: {
      onError?: (error: unknown) => void;
      onSuccess?: (data: T) => void;
    } = {},
  ): Promise<T | null> => {
    try {
      clearError();
      const result = await operation();
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      setError(error);
      options.onError?.(error);
      return null;
    }
  };

  return {
    // Reactive state
    currentError: readonly(currentError),
    isError,
    errorMessage,
    errorCode,
    errorStatus,

    // Methods
    setError,
    clearError,
    handleAsync,
  };
}
