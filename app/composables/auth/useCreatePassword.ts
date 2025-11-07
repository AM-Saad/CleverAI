import type { APIError } from '@/services/FetchFactory'
import type Result from '@/types/Result'

interface PasswordCredentials {
  password: string | null
  confirmPassword: string | null
}

interface UseCreatePassword {
  credentials: Ref<PasswordCredentials>
  loading: Ref<boolean>
  error: Ref<APIError | null>
  success: Ref<string>
  createPassword: (token: string) => Promise<void>
  reset: () => void
}

/**
 * Composable for creating/resetting password using useOperation pattern
 * Requires a JWT token from password reset or email verification flow
 */
export function useCreatePassword(): UseCreatePassword {
  const router = useRouter()
  const { $api } = useNuxtApp()

  // State
  const credentials = ref<PasswordCredentials>({
    password: null,
    confirmPassword: null,
  })
  const success = ref('')

  // Use operation pattern
  const operation = useOperation<{ message: string }>()

  // Computed states
  const loading = computed(() => operation.pending.value)
  const error = computed(() => operation.error.value)

  /**
   * Create/reset password with JWT token
   */
  const createPassword = async (token: string): Promise<void> => {
    success.value = ''

    // Validate token
    if (!token) {
      operation.execute(async () => ({
        success: false,
        error: {
          message: 'Invalid or missing token',
          status: 401,
          code: 'MISSING_TOKEN',
        } as APIError,
      }))
      return
    }

    // Client-side validation
    if (!credentials.value.password || !credentials.value.confirmPassword) {
      operation.execute(async () => ({
        success: false,
        error: {
          message: 'Please add your information',
          status: 400,
          code: 'VALIDATION_ERROR',
        } as APIError,
      }))
      return
    }

    if (credentials.value.password !== credentials.value.confirmPassword) {
      operation.execute(async () => ({
        success: false,
        error: {
          message: 'Passwords do not match',
          status: 400,
          code: 'VALIDATION_ERROR',
        } as APIError,
      }))
      return
    }

    // Execute operation through API service
    const result = await operation.execute(async () => {
      return await $api.auth.createPassword(
        token,
        credentials.value.password!,
        credentials.value.confirmPassword!
      )
    })

    if (result) {
      success.value = 'Password created successfully, redirecting to login page...'

      // Redirect to login after success
      setTimeout(() => {
        router.push('/auth/signIn')
      }, 2000)
    }
  }

  /**
   * Reset all state
   */
  const reset = () => {
    credentials.value = {
      password: null,
      confirmPassword: null,
    }
    success.value = ''
    operation.reset()
  }

  return {
    credentials,
    loading,
    error,
    success,
    createPassword,
    reset,
  }
}
