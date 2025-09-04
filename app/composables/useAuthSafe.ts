// composables/useAuthSafe.ts
import { useAuth } from "#imports"

/**
 * Safe wrapper around useAuth that handles session fetch errors gracefully
 */
export function useAuthSafe() {
  const auth = useAuth()
  const { retryWithBackoff, isOnline } = useNetworkStatus()

  // Create reactive refs for error handling
  const sessionError = ref<string | null>(null)
  const isSessionLoading = ref(true)

  // Watch for status changes and handle errors
  watch(auth.status, (newStatus) => {
    if (newStatus === 'unauthenticated' || newStatus === 'authenticated') {
      isSessionLoading.value = false
    }

    // Clear error when status changes to authenticated
    if (newStatus === 'authenticated') {
      sessionError.value = null
    }
  }, { immediate: true })

  // Watch for data changes and handle potential errors
  watch(auth.data, (newData, oldData) => {
    // If data becomes null after being populated, it might be a session error
    if (oldData && !newData && auth.status.value === 'loading') {
      sessionError.value = 'Session expired or could not be retrieved'
    }
  })

  // Safe session getter with network awareness
  const getSessionSafe = async (options?: {
    timeout?: number
    retries?: number
  }): Promise<typeof auth.data.value> => {
    const { timeout = 5000, retries = 3 } = options || {}

    // If offline, return current session data without fetching
    if (!isOnline.value) {
      console.warn('Cannot fetch session: offline')
      return auth.data.value
    }

    const fetchWithTimeout = async (): Promise<typeof auth.data.value> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        await auth.refresh()
        clearTimeout(timeoutId)
        return auth.data.value
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Session fetch timeout')
        }
        throw error
      }
    }

    try {
      // Use retry logic with network awareness
      const result = await retryWithBackoff(fetchWithTimeout, retries)
      return result
    } catch (error) {
      console.warn('Session fetch failed:', error)
      sessionError.value = 'Failed to fetch session'
      return auth.data.value // Return cached data if available
    }
  }

  // Safe sign in wrapper
  const safeSignIn = async (provider: string, options?: Record<string, unknown>) => {
    try {
      sessionError.value = null

      // Check network status
      if (!isOnline.value) {
        throw new Error('Cannot sign in: no internet connection')
      }

      const result = await auth.signIn(provider, options)
      return result
    } catch (error) {
      console.error('Sign in error:', error)
      sessionError.value = error instanceof Error ? error.message : 'Sign in failed'
      throw error
    }
  }

  // Safe sign out wrapper
  const safeSignOut = async (options?: Record<string, unknown>) => {
    try {
      sessionError.value = null
      const result = await auth.signOut(options)
      return result
    } catch (error) {
      console.error('Sign out error:', error)
      sessionError.value = error instanceof Error ? error.message : 'Sign out failed'
      throw error
    }
  }

  // Safe refresh wrapper
  const safeRefresh = async () => {
    try {
      sessionError.value = null

      // If offline, skip refresh
      if (!isOnline.value) {
        console.warn('Cannot refresh session: offline')
        return
      }

      await auth.refresh()
    } catch (error) {
      console.error('Session refresh error:', error)
      sessionError.value = 'Failed to refresh session'

      // If refresh fails, consider the user unauthenticated
      // This helps prevent infinite loading states
      if (import.meta.client) {
        await navigateTo('/auth/signin')
      }
    }
  }

  return {
    // Original auth properties
    status: auth.status,
    data: auth.data,
    lastRefreshedAt: auth.lastRefreshedAt,

    // Enhanced properties
    sessionError: readonly(sessionError),
    isSessionLoading: readonly(isSessionLoading),
    isOnline: readonly(isOnline),

    // Safe methods
    signIn: safeSignIn,
    signOut: safeSignOut,
    refresh: safeRefresh,
    getSessionSafe,

    // Computed helpers
    isAuthenticated: computed(() => auth.status.value === 'authenticated'),
    isUnauthenticated: computed(() => auth.status.value === 'unauthenticated'),
    hasSessionError: computed(() => !!sessionError.value),

    // Clear error method
    clearSessionError: () => {
      sessionError.value = null
    }
  }
}
