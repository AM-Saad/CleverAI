/**
 * Client-side Error Handling Utilities
 *
 * Provides consistent error display and user messaging for the frontend
 * Handles standardized API error responses and provides user-friendly notifications
 */

// Error categories (matching server-side enum)
export type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'RATE_LIMITING'
  | 'BUSINESS_LOGIC'
  | 'EXTERNAL_API'
  | 'DATABASE'
  | 'NETWORK'
  | 'INTERNAL_SERVER'
  | 'SECURITY'
  | 'QUOTA'
  | 'MAINTENANCE'

/**
 * Standardized API error response (client-side interface)
 */
export interface APIErrorResponse {
  success: false
  error: {
    code: string
    category: ErrorCategory
    message: string
    userMessage: string
    developerMessage: string
    suggestedAction?: string
    timestamp: string
    requestId: string
    retryable: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    details?: unknown
    stack?: string[]
  }
  metadata?: {
    httpStatus: number
    headers?: Record<string, string>
    retryDelay?: number
  }
}

/**
 * Validation error details for form handling
 */
export interface ValidationError {
  field: string
  code: string
  message: string
  userMessage: string
  received?: unknown
  constraint?: {
    type: 'min' | 'max' | 'pattern' | 'enum' | 'custom'
    value?: unknown
    expected?: unknown
  }
}

/**
 * Error display configuration
 */
export interface ErrorDisplayConfig {
  showDeveloperInfo?: boolean
  showRequestId?: boolean
  showRetryButton?: boolean
  showSuggestedAction?: boolean
  theme?: 'light' | 'dark'
  position?: 'top' | 'bottom' | 'center'
  autoClose?: number // milliseconds
}

/**
 * Error notification types
 */
export type ErrorNotificationType = 'toast' | 'modal' | 'banner' | 'inline'

/**
 * Client-side error handler class
 */
export class ClientErrorHandler {
  private static instance: ClientErrorHandler
  private config: ErrorDisplayConfig
  private notifications: Map<string, { element: HTMLElement; timeout?: NodeJS.Timeout }> = new Map()

  constructor(config: ErrorDisplayConfig = {}) {
    this.config = {
      showDeveloperInfo: process.env.NODE_ENV === 'development',
      showRequestId: process.env.NODE_ENV === 'development',
      showRetryButton: true,
      showSuggestedAction: true,
      theme: 'light',
      position: 'top',
      autoClose: 5000,
      ...config
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: ErrorDisplayConfig): ClientErrorHandler {
    if (!ClientErrorHandler.instance) {
      ClientErrorHandler.instance = new ClientErrorHandler(config)
    }
    return ClientErrorHandler.instance
  }

  /**
   * Handle API error response
   */
  handleApiError(
    error: APIErrorResponse | Error | unknown,
    options: {
      type?: ErrorNotificationType
      context?: string
      onRetry?: () => void
      onDismiss?: () => void
    } = {}
  ): void {
    const apiError = this.parseError(error)
    const { type = 'toast', context, onRetry, onDismiss } = options

    // Create error message
    const errorInfo = this.createErrorInfo(apiError, context)

    // Display based on type
    switch (type) {
      case 'toast':
        this.showToast(errorInfo, onRetry, onDismiss)
        break
      case 'modal':
        this.showModal(errorInfo, onRetry, onDismiss)
        break
      case 'banner':
        this.showBanner(errorInfo, onRetry, onDismiss)
        break
      case 'inline':
        // Return error info for inline display
        break
    }

    // Log for debugging
    if (this.config.showDeveloperInfo) {
      console.error('Client Error:', {
        error: apiError,
        context,
        requestId: apiError.error?.requestId
      })
    }
  }

  /**
   * Handle validation errors for forms
   */
  handleValidationErrors(
    errors: ValidationError[],
    formElement?: HTMLFormElement
  ): Map<string, string> {
    const fieldErrors = new Map<string, string>()

    errors.forEach(error => {
      fieldErrors.set(error.field, error.userMessage)

      // If form element provided, show field-specific errors
      if (formElement) {
        this.showFieldError(formElement, error.field, error.userMessage)
      }
    })

    return fieldErrors
  }

  /**
   * Clear all error notifications
   */
  clearAllErrors(): void {
    this.notifications.forEach(({ element, timeout }) => {
      if (timeout) clearTimeout(timeout)
      element.remove()
    })
    this.notifications.clear()
  }

  /**
   * Parse different error types into consistent format
   */
  private parseError(error: unknown): APIErrorResponse {
    // Already parsed API error
    if (this.isAPIErrorResponse(error)) {
      return error
    }

    // Fetch error with response
    if (error instanceof Error && 'response' in error) {
      // Handle fetch/axios error
      return this.parseFetchError(error as Error & { response?: Response })
    }

    // Generic Error
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          code: 'CLIENT_ERROR',
          category: 'INTERNAL_SERVER' as ErrorCategory,
          message: error.message,
          userMessage: 'An unexpected error occurred. Please try again.',
          developerMessage: error.message,
          timestamp: new Date().toISOString(),
          requestId: `client-${Date.now()}`,
          retryable: true,
          severity: 'medium'
        }
      }
    }

    // Unknown error
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        category: 'INTERNAL_SERVER' as ErrorCategory,
        message: 'Unknown error occurred',
        userMessage: 'Something went wrong. Please try again.',
        developerMessage: String(error),
        timestamp: new Date().toISOString(),
        requestId: `client-${Date.now()}`,
        retryable: true,
        severity: 'medium'
      }
    }
  }

  /**
   * Check if error is API error response
   */
  private isAPIErrorResponse(error: unknown): error is APIErrorResponse {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'success' in error &&
      (error as APIErrorResponse).success === false &&
      'error' in error
    )
  }

  /**
   * Parse fetch/HTTP error
   */
  private parseFetchError(error: Error & { response?: Response }): APIErrorResponse {
    return {
      success: false,
      error: {
        code: 'HTTP_ERROR',
        category: 'NETWORK' as ErrorCategory,
        message: error.message,
        userMessage: 'Network error occurred. Please check your connection.',
        developerMessage: error.message,
        timestamp: new Date().toISOString(),
        requestId: `http-${Date.now()}`,
        retryable: true,
        severity: 'medium'
      },
      metadata: {
        httpStatus: error.response?.status || 0
      }
    }
  }

  /**
   * Create error information object
   */
  private createErrorInfo(error: APIErrorResponse, context?: string) {
    const { error: errorData } = error

    return {
      title: this.getErrorTitle(errorData.category, errorData.severity),
      message: errorData.userMessage,
      details: this.config.showDeveloperInfo ? errorData.developerMessage : undefined,
      requestId: this.config.showRequestId ? errorData.requestId : undefined,
      suggestedAction: this.config.showSuggestedAction ? errorData.suggestedAction : undefined,
      retryable: errorData.retryable && this.config.showRetryButton,
      severity: errorData.severity,
      context
    }
  }

  /**
   * Get error title based on category and severity
   */
  private getErrorTitle(category: ErrorCategory, severity: string): string {
    if (severity === 'critical') return '🚨 Critical Error'
    if (severity === 'high') return '❌ Error'
    if (severity === 'medium') return '⚠️ Warning'

    switch (category) {
      case 'VALIDATION':
        return '📝 Validation Error'
      case 'AUTHENTICATION':
        return '🔐 Authentication Required'
      case 'AUTHORIZATION':
        return '🚫 Permission Denied'
      case 'NOT_FOUND':
        return '🔍 Not Found'
      case 'RATE_LIMITING':
        return '⏱️ Rate Limited'
      case 'NETWORK':
        return '🌐 Network Error'
      default:
        return 'ℹ️ Notice'
    }
  }

  /**
   * Show toast notification
   */
  private showToast(
    errorInfo: ReturnType<typeof this.createErrorInfo>,
    onRetry?: () => void,
    onDismiss?: () => void
  ): void {
    const toast = document.createElement('div')
    toast.className = `error-toast error-${errorInfo.severity} ${this.config.theme}`
    toast.innerHTML = this.createToastHTML(errorInfo, !!onRetry)

    // Position toast
    toast.style.cssText = `
      position: fixed;
      ${this.config.position === 'top' ? 'top: 20px' : 'bottom: 20px'};
      right: 20px;
      max-width: 400px;
      z-index: 10000;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      padding: 16px;
      animation: slideIn 0.3s ease;
    `

    document.body.appendChild(toast)

    // Add event listeners
    const dismissBtn = toast.querySelector('.dismiss-btn')
    const retryBtn = toast.querySelector('.retry-btn')

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.dismissNotification(toast.id, onDismiss)
      })
    }

    if (retryBtn && onRetry) {
      retryBtn.addEventListener('click', () => {
        onRetry()
        this.dismissNotification(toast.id)
      })
    }

    // Auto-dismiss
    const id = `toast-${Date.now()}`
    toast.id = id

    const timeout = this.config.autoClose ? setTimeout(() => {
      this.dismissNotification(id, onDismiss)
    }, this.config.autoClose) : undefined

    this.notifications.set(id, { element: toast, timeout })
  }

  /**
   * Show modal dialog
   */
  private showModal(
    errorInfo: ReturnType<typeof this.createErrorInfo>,
    onRetry?: () => void,
    onDismiss?: () => void
  ): void {
    // Create modal backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'error-modal-backdrop'
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    const modal = document.createElement('div')
    modal.className = `error-modal error-${errorInfo.severity} ${this.config.theme}`
    modal.innerHTML = this.createModalHTML(errorInfo, !!onRetry)
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    `

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)

    // Add event listeners
    const dismissBtn = modal.querySelector('.dismiss-btn')
    const retryBtn = modal.querySelector('.retry-btn')

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.dismissNotification(backdrop.id, onDismiss)
      })
    }

    if (retryBtn && onRetry) {
      retryBtn.addEventListener('click', () => {
        onRetry()
        this.dismissNotification(backdrop.id)
      })
    }

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.dismissNotification(backdrop.id, onDismiss)
      }
    })

    const id = `modal-${Date.now()}`
    backdrop.id = id
    this.notifications.set(id, { element: backdrop })
  }

  /**
   * Show banner notification
   */
  private showBanner(
    errorInfo: ReturnType<typeof this.createErrorInfo>,
    onRetry?: () => void,
    onDismiss?: () => void
  ): void {
    const banner = document.createElement('div')
    banner.className = `error-banner error-${errorInfo.severity} ${this.config.theme}`
    banner.innerHTML = this.createBannerHTML(errorInfo, !!onRetry)
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 9999;
      background: #fee2e2;
      border-bottom: 1px solid #fca5a5;
      padding: 12px 16px;
    `

    document.body.appendChild(banner)

    // Adjust body padding
    document.body.style.paddingTop = `${banner.offsetHeight}px`

    // Add event listeners
    const dismissBtn = banner.querySelector('.dismiss-btn')
    const retryBtn = banner.querySelector('.retry-btn')

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        document.body.style.paddingTop = '0'
        this.dismissNotification(banner.id, onDismiss)
      })
    }

    if (retryBtn && onRetry) {
      retryBtn.addEventListener('click', () => {
        onRetry()
        document.body.style.paddingTop = '0'
        this.dismissNotification(banner.id)
      })
    }

    const id = `banner-${Date.now()}`
    banner.id = id
    this.notifications.set(id, { element: banner })
  }

  /**
   * Show field-specific error
   */
  private showFieldError(form: HTMLFormElement, fieldName: string, message: string): void {
    const field = form.querySelector(`[name="${fieldName}"]`) as HTMLElement
    if (!field) return

    // Remove existing error
    const existingError = form.querySelector(`.field-error[data-field="${fieldName}"]`)
    if (existingError) existingError.remove()

    // Create error element
    const errorElement = document.createElement('div')
    errorElement.className = 'field-error'
    errorElement.setAttribute('data-field', fieldName)
    errorElement.textContent = message
    errorElement.style.cssText = `
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 4px;
    `

    // Add error styling to field
    field.style.borderColor = '#dc2626'

    // Insert error after field
    field.parentNode?.insertBefore(errorElement, field.nextSibling)
  }

  /**
   * Dismiss notification
   */
  private dismissNotification(id: string, onDismiss?: () => void): void {
    const notification = this.notifications.get(id)
    if (!notification) return

    if (notification.timeout) {
      clearTimeout(notification.timeout)
    }

    notification.element.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => {
      notification.element.remove()
      this.notifications.delete(id)
      onDismiss?.()
    }, 300)
  }

  /**
   * Create toast HTML
   */
  private createToastHTML(errorInfo: ReturnType<typeof this.createErrorInfo>, hasRetry: boolean): string {
    return `
      <div class="error-header">
        <h4>${errorInfo.title}</h4>
        <button class="dismiss-btn" type="button">&times;</button>
      </div>
      <p class="error-message">${errorInfo.message}</p>
      ${errorInfo.suggestedAction ? `<p class="suggested-action"><strong>Suggestion:</strong> ${errorInfo.suggestedAction}</p>` : ''}
      ${errorInfo.details ? `<details><summary>Technical Details</summary><pre>${errorInfo.details}</pre></details>` : ''}
      ${errorInfo.requestId ? `<small class="request-id">Request ID: ${errorInfo.requestId}</small>` : ''}
      <div class="error-actions">
        ${hasRetry && errorInfo.retryable ? '<button class="retry-btn" type="button">Try Again</button>' : ''}
      </div>
    `
  }

  /**
   * Create modal HTML
   */
  private createModalHTML(errorInfo: ReturnType<typeof this.createErrorInfo>, hasRetry: boolean): string {
    return `
      <div class="modal-header">
        <h3>${errorInfo.title}</h3>
        <button class="dismiss-btn" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <p class="error-message">${errorInfo.message}</p>
        ${errorInfo.context ? `<p class="error-context"><strong>Context:</strong> ${errorInfo.context}</p>` : ''}
        ${errorInfo.suggestedAction ? `<div class="suggested-action"><strong>What you can do:</strong> ${errorInfo.suggestedAction}</div>` : ''}
        ${errorInfo.details ? `<details><summary>Technical Details</summary><pre>${errorInfo.details}</pre></details>` : ''}
        ${errorInfo.requestId ? `<small class="request-id">Request ID: ${errorInfo.requestId}</small>` : ''}
      </div>
      <div class="modal-footer">
        <button class="dismiss-btn secondary" type="button">Close</button>
        ${hasRetry && errorInfo.retryable ? '<button class="retry-btn primary" type="button">Try Again</button>' : ''}
      </div>
    `
  }

  /**
   * Create banner HTML
   */
  private createBannerHTML(errorInfo: ReturnType<typeof this.createErrorInfo>, hasRetry: boolean): string {
    return `
      <div class="banner-content">
        <span class="banner-title">${errorInfo.title}</span>
        <span class="banner-message">${errorInfo.message}</span>
        <div class="banner-actions">
          ${hasRetry && errorInfo.retryable ? '<button class="retry-btn" type="button">Retry</button>' : ''}
          <button class="dismiss-btn" type="button">Dismiss</button>
        </div>
      </div>
    `
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = ClientErrorHandler.getInstance()

/**
 * Composable for Vue/Nuxt
 */
export function useErrorHandler(config?: ErrorDisplayConfig) {
  return ClientErrorHandler.getInstance(config)
}

/**
 * Utility functions for common error scenarios
 */
export const ErrorUtils = {
  /**
   * Handle API call with automatic error handling
   */
  async handleApiCall<T>(
    apiCall: () => Promise<T>,
    options: {
      context?: string
      showError?: boolean
      errorType?: ErrorNotificationType
      onError?: (error: unknown) => void
      onRetry?: () => void
    } = {}
  ): Promise<T | null> {
    const { context, showError = true, errorType = 'toast', onError, onRetry } = options

    try {
      return await apiCall()
    } catch (error) {
      if (showError) {
        errorHandler.handleApiError(error, {
          type: errorType,
          context,
          onRetry
        })
      }

      onError?.(error)
      return null
    }
  },

  /**
   * Create user-friendly error message
   */
  getUserMessage(error: unknown): string {
    if (errorHandler['isAPIErrorResponse'](error)) {
      return error.error.userMessage
    }

    if (error instanceof Error) {
      return error.message
    }

    return 'An unexpected error occurred'
  },

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (errorHandler['isAPIErrorResponse'](error)) {
      return error.error.retryable
    }

    return true // Default to retryable for unknown errors
  },

  /**
   * Extract validation errors from API response
   */
  getValidationErrors(error: unknown): ValidationError[] {
    if (errorHandler['isAPIErrorResponse'](error) && error.error.details) {
      const details = error.error.details as { errors?: ValidationError[] }
      return details.errors || []
    }

    return []
  }
}

/**
 * CSS styles for error components (to be added to global styles)
 */
export const ERROR_STYLES = `
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

.error-toast, .error-modal, .error-banner {
  font-family: system-ui, -apple-system, sans-serif;
}

.error-toast .error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.error-toast h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.dismiss-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message {
  margin: 0 0 12px 0;
  color: #374151;
}

.suggested-action {
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 8px 0;
  font-size: 0.875rem;
}

.request-id {
  color: #6b7280;
  font-family: monospace;
}

.error-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.retry-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.retry-btn:hover {
  background: #2563eb;
}

.error-critical { border-left: 4px solid #dc2626; }
.error-high { border-left: 4px solid #ea580c; }
.error-medium { border-left: 4px solid #d97706; }
.error-low { border-left: 4px solid #65a30d; }

.modal-header, .modal-footer {
  padding: 16px 24px;
}

.modal-body {
  padding: 0 24px 16px 24px;
}

.modal-header {
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-footer {
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.primary {
  background: #3b82f6;
  color: white;
}

.secondary {
  background: #f3f4f6;
  color: #374151;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.banner-title {
  font-weight: 600;
}

.banner-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.field-error {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`
