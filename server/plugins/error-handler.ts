/**
 * Global Error Handler Plugin for H3/Nitro
 *
 * This plugin configures H3 to automatically use our standardized error handling
 * system for all unhandled errors in API endpoints.
 */

import { handleError, getErrorContextFromEvent } from '../utils/standardErrorHandler'

export default defineNitroPlugin(async (nitroApp) => {
  // Hook into the global error event
  nitroApp.hooks.hook('error', (error, { event }) => {
    console.log('🔍 Global error hook triggered:', {
      error: error?.message || error,
      path: event?.path,
      method: event?.node?.req?.method
    })

    // Skip if this is already a handled H3 error with our standardized format
    const errorWithData = error as unknown as { data?: { success?: boolean, error?: { code?: string } } }
    if (errorWithData?.data?.success === false && errorWithData?.data?.error?.code) {
      console.log('✅ Already a standardized error, skipping')
      return
    }

    // Skip client-side routes and static assets
    if (!event?.path?.startsWith('/api/')) {
      console.log('⏭️ Not an API route, using default handling')
      return
    }

    // Skip auth endpoints to avoid conflicts with auth middleware
    if (event?.path?.startsWith('/api/auth/')) {
      console.log('⏭️ Auth endpoint, using default handling')
      return
    }

    try {
      // Extract error context from the H3 event
      const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

      console.log('🔄 Processing error through standardized handler:', {
        errorType: error?.constructor?.name,
        context: {
          operation: context.operation,
          requestId: context.requestId
        }
      })

      // Use our standardized error handler
      handleError(error, context)
    } catch (handledError) {
      // Our handleError throws an H3Error - this is expected
      console.log('✅ Error standardized and re-thrown as H3Error')
      throw handledError
    }
  })

  // Hook into request lifecycle for additional context
  nitroApp.hooks.hook('request', async (event) => {
    // Add correlation ID for error tracking if not already present
    if (event.path.startsWith('/api/') && !event.context.requestId) {
      event.context.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  })

  console.log('🚀 Global error handler plugin initialized')
})
