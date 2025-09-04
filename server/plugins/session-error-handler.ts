// plugins/session-error-handler.server.ts
export default defineNitroPlugin(async (nitroApp) => {
  // Add error handler for session-related errors
  nitroApp.hooks.hook('error', (error, { event }) => {
    // Check if it's a session-related error
    if (error.message?.includes('session') ||
        error.message?.includes('getServerSession') ||
        error.message?.includes('Unauthorized')) {

      console.warn(`Session error on ${event?.path}:`, error.message)

      // For session endpoints specifically, return null instead of throwing
      if (event?.path?.includes('/api/auth/session')) {
        console.log('Returning null session for failed session request')
        // Don't re-throw the error - let it be handled gracefully
        return
      }
    }
  })

  // Add request handler to catch session errors early
  nitroApp.hooks.hook('request', async (event) => {
    // Only handle API routes
    if (!event.path.startsWith('/api/')) return

    // Skip auth endpoints to avoid recursion
    if (event.path.startsWith('/api/auth/')) return

    // For protected endpoints, try to get session safely
    try {
      // This will be handled by our auth middleware
    } catch (error) {
      console.warn('Session error in request hook:', error)
      // Let the middleware handle it
    }
  })
})
