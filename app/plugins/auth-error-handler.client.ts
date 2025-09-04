// plugins/auth-error-handler.client.ts
export default defineNuxtPlugin({
  name: 'auth-error-handler',
  setup(nuxtApp) {
    // Handle authentication-related fetch errors
    nuxtApp.hook('app:error', (error: unknown) => {
      const err = error as Error

      // Check if it's a session-related error
      if (err.message?.includes('session') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('ERR_INTERNET_DISCONNECTED') ||
          err.message?.includes('Unauthorized')) {

        console.warn('Auth session error detected:', err.message)

        // Don't throw the error for session failures - handle gracefully
        if (err.message?.includes('getServerSession') ||
            err.message?.includes('/api/auth/session') ||
            err.message?.includes('ERR_INTERNET_DISCONNECTED')) {

          console.log('Handling session fetch error gracefully')

          // Clear any cached session data
          if (import.meta.client) {
            // Clear auth-related storage
            try {
              localStorage.removeItem('auth-token')
              sessionStorage.removeItem('auth-session')
            } catch {
              // Storage might not be available
            }
          }

          // Prevent the error from propagating
          return
        }
      }

      // For other auth errors, log but don't interfere
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        console.warn('Authentication required for this action')
      }
    })

    // Handle Vue errors specifically
    nuxtApp.hook('vue:error', (error: unknown, _instance, _info) => {
      const err = error as Error
      if (err.message?.includes('session') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('ERR_INTERNET_DISCONNECTED')) {
        console.warn('Vue auth error handled:', err.message)
        return
      }
    })

    // Handle fetch errors specifically
    if (import.meta.client) {
      // Override global fetch to handle auth errors gracefully
      const originalFetch = window.fetch

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const response = await originalFetch(input, init)

          // Handle 401/500 auth errors gracefully
          if (response.status === 401 ||
             (response.status === 500 && input.toString().includes('/api/auth/session'))) {

            console.warn(`Auth endpoint returned ${response.status}:`, input.toString())

            // Return a valid response to prevent app crashes
            if (input.toString().includes('/api/auth/session')) {
              return new Response(JSON.stringify(null), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              })
            }
          }

          return response
        } catch (error) {
          // Handle network errors for auth endpoints
          if (input.toString().includes('/api/auth/')) {
            console.warn('Network error for auth endpoint:', error)

            // Return empty session for session endpoint failures
            if (input.toString().includes('/api/auth/session')) {
              return new Response(JSON.stringify(null), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              })
            }
          }

          throw error
        }
      }
    }
  }
})
