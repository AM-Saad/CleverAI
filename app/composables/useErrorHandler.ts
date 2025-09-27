/**
 * Vue/Nuxt Error Handling Composable
 *
 * Provides reactive error handling for Vue components
 * Integrates with the client-side error handler
 */

import { ref, computed, onUnmounted } from 'vue'
import { errorHandler, ErrorUtils, type ErrorDisplayConfig, type ErrorNotificationType } from '~/utils/errorHandler'

export interface UseErrorHandlerOptions {
  /**
   * Show errors automatically when they occur
   */
  autoShow?: boolean

  /**
   * Default error display type
   */
  defaultType?: ErrorNotificationType

  /**
   * Context for error reporting
   */
  context?: string

  /**
   * Configuration for error display
   */
  displayConfig?: ErrorDisplayConfig
}

/**
 * Error handling composable for Vue components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    autoShow = true,
    defaultType = 'toast',
    context,
    displayConfig: _displayConfig
  } = options

  // Reactive error state
  const currentError = ref<unknown>(null)
  const isError = computed(() => currentError.value !== null)
  const errorMessage = computed(() =>
    currentError.value ? ErrorUtils.getUserMessage(currentError.value) : ''
  )
  const isRetryable = computed(() =>
    currentError.value ? ErrorUtils.isRetryable(currentError.value) : false
  )

  // Error history for debugging
  const errorHistory = ref<Array<{ error: unknown; timestamp: Date; context?: string }>>([])

  // Get error handler instance
  const handler = errorHandler

  /**
   * Handle an error
   */
  const handleError = (
    error: unknown,
    options: {
      show?: boolean
      type?: ErrorNotificationType
      context?: string
      onRetry?: () => void
    } = {}
  ) => {
    const { show = autoShow, type = defaultType, context: errorContext, onRetry } = options

    // Update reactive state
    currentError.value = error

    // Add to history
    errorHistory.value.push({
      error,
      timestamp: new Date(),
      context: errorContext || context
    })

    // Keep only last 10 errors
    if (errorHistory.value.length > 10) {
      errorHistory.value = errorHistory.value.slice(-10)
    }

    // Show error if enabled
    if (show) {
      handler.handleApiError(error, {
        type,
        context: errorContext || context,
        onRetry,
        onDismiss: () => {
          clearError()
        }
      })
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Component Error:', {
        error,
        context: errorContext || context,
        component: getCurrentInstance()?.type?.name
      })
    }
  }

  /**
   * Clear current error
   */
  const clearError = () => {
    currentError.value = null
  }

  /**
   * Clear all errors and notifications
   */
  const clearAllErrors = () => {
    currentError.value = null
    errorHistory.value = []
    handler.clearAllErrors()
  }

  /**
   * Handle API call with automatic error handling
   */
  const handleApiCall = async <T>(
    apiCall: () => Promise<T>,
    options: {
      show?: boolean
      type?: ErrorNotificationType
      context?: string
      onRetry?: () => void
      onSuccess?: (data: T) => void
      onError?: (error: unknown) => void
    } = {}
  ): Promise<T | null> => {
    const { show = autoShow, type = defaultType, context: callContext, onRetry, onSuccess, onError } = options

    try {
      clearError()
      const result = await apiCall()
      onSuccess?.(result)
      return result
    } catch (error) {
      handleError(error, {
        show,
        type,
        context: callContext,
        onRetry
      })
      onError?.(error)
      return null
    }
  }

  /**
   * Handle form validation errors
   */
  const handleValidationErrors = (
    error: unknown,
    formRef?: Ref<HTMLFormElement | null>
  ) => {
    const validationErrors = ErrorUtils.getValidationErrors(error)

    if (validationErrors.length > 0 && formRef?.value) {
      const fieldErrors = handler.handleValidationErrors(validationErrors, formRef.value)
      return fieldErrors
    }

    // Fallback to regular error handling
    handleError(error, { type: 'toast' })
    return new Map<string, string>()
  }

  /**
   * Create error toast
   */
  const showToast = (message: string, options: { type?: 'error' | 'warning' | 'info'; onRetry?: () => void } = {}) => {
    const { type = 'error', onRetry } = options

    const fakeError = {
      success: false as const,
      error: {
        code: 'MANUAL_ERROR',
        category: 'INTERNAL_SERVER' as const,
        message,
        userMessage: message,
        developerMessage: message,
        timestamp: new Date().toISOString(),
        requestId: `manual-${Date.now()}`,
        retryable: !!onRetry,
        severity: type === 'error' ? 'high' as const : 'medium' as const
      }
    }

    handler.handleApiError(fakeError, {
      type: 'toast',
      onRetry
    })
  }

  /**
   * Show success toast
   */
  const showSuccess = (message: string) => {
    // Create a success "error" for consistent display
    const successNotification = {
      success: false as const,
      error: {
        code: 'SUCCESS',
        category: 'INTERNAL_SERVER' as const,
        message,
        userMessage: message,
        developerMessage: message,
        timestamp: new Date().toISOString(),
        requestId: `success-${Date.now()}`,
        retryable: false,
        severity: 'low' as const
      }
    }

    // Use a custom success toast (could be styled differently)
    handler.handleApiError(successNotification, {
      type: 'toast'
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    clearAllErrors()
  })

  return {
    // Reactive state
    currentError: readonly(currentError),
    isError,
    errorMessage,
    isRetryable,
    errorHistory: readonly(errorHistory),

    // Methods
    handleError,
    clearError,
    clearAllErrors,
    handleApiCall,
    handleValidationErrors,
    showToast,
    showSuccess,

    // Utilities
    getUserMessage: ErrorUtils.getUserMessage,
    isErrorRetryable: ErrorUtils.isRetryable,
    getValidationErrors: ErrorUtils.getValidationErrors
  }
}

/**
 * Global error handling composable (singleton)
 */
let globalErrorHandler: ReturnType<typeof useErrorHandler> | null = null

export function useGlobalErrorHandler() {
  if (!globalErrorHandler) {
    globalErrorHandler = useErrorHandler({
      autoShow: true,
      defaultType: 'toast',
      context: 'global'
    })
  }
  return globalErrorHandler
}

/**
 * Form-specific error handling composable
 */
export function useFormErrorHandler(formRef: Ref<HTMLFormElement | null>) {
  const errorHandler = useErrorHandler({
    autoShow: false, // Handle validation errors manually
    defaultType: 'inline'
  })

  const fieldErrors = ref<Map<string, string>>(new Map())

  const handleSubmitError = (error: unknown) => {
    const validationErrors = ErrorUtils.getValidationErrors(error)

    if (validationErrors.length > 0) {
      fieldErrors.value = errorHandler.handleValidationErrors(error, formRef)
    } else {
      // Show general error
      errorHandler.handleError(error, { show: true, type: 'toast' })
    }
  }

  const clearFieldErrors = () => {
    fieldErrors.value.clear()

    // Clear visual errors from form
    if (formRef.value) {
      const errorElements = formRef.value.querySelectorAll('.field-error')
      errorElements.forEach(el => el.remove())

      const fields = formRef.value.querySelectorAll('input, select, textarea')
      fields.forEach(field => {
        (field as HTMLElement).style.borderColor = ''
      })
    }
  }

  const getFieldError = (fieldName: string) => {
    return fieldErrors.value.get(fieldName)
  }

  const hasFieldError = (fieldName: string) => {
    return fieldErrors.value.has(fieldName)
  }

  return {
    ...errorHandler,
    fieldErrors: readonly(fieldErrors),
    handleSubmitError,
    clearFieldErrors,
    getFieldError,
    hasFieldError
  }
}

/**
 * API loading and error state composable
 */
export function useAsyncOperation<T = unknown>() {
  const isLoading = ref(false)
  const data = ref<T | null>(null)
  const errorHandler = useErrorHandler()

  const execute = async (
    operation: () => Promise<T>,
    options: {
      context?: string
      onSuccess?: (data: T) => void
      onError?: (error: unknown) => void
    } = {}
  ) => {
    const { context, onSuccess, onError } = options

    isLoading.value = true

    try {
      const result = await operation()
      data.value = result
      onSuccess?.(result)
      return result
    } catch (error) {
      errorHandler.handleError(error, { context })
      onError?.(error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    isLoading.value = false
    data.value = null
    errorHandler.clearError()
  }

  return {
    isLoading: readonly(isLoading),
    data: readonly(data),
    error: errorHandler.currentError,
    isError: errorHandler.isError,
    execute,
    reset,
    clearError: errorHandler.clearError
  }
}
