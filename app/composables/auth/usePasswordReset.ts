import type { APIError } from '@/services/FetchFactory'

interface PasswordResetCredentials {
  email: string | null
  verification: string | null
}

interface UsePasswordReset {
  credentials: Ref<PasswordResetCredentials>
  emailSent: Ref<boolean>
  emailsCount: Ref<number>
  countDown: Ref<number>
  verified: Ref<boolean>
  token: Ref<string | null>
  loading: Ref<boolean>
  error: Ref<APIError | null>
  success: Ref<string>
  sendResetEmail: () => Promise<void>
  verifyResetCode: () => Promise<void>
  reset: () => void
}

/**
 * Composable for password reset flow using useOperation pattern
 * Handles:
 * 1. Sending password reset email
 * 2. Verifying reset code
 * 3. Managing countdown timer for resend
 */
export function usePasswordReset(): UsePasswordReset {
  const router = useRouter()
  const route = useRoute()
  const { $api } = useNuxtApp()

  // State
  const credentials = ref<PasswordResetCredentials>({
    email: null,
    verification: null,
  })

  const emailSent = ref(false)
  const emailsCount = ref(0)
  const countDown = ref(30)
  const verified = ref(false)
  const token = ref<string | null>(null)
  const success = ref('')

  // Use operation pattern for sending email
  const sendEmailOperation = useOperation<{ message: string }>()

  // Use operation pattern for verifying code
  const verifyCodeOperation = useOperation<{ message: string; token?: string }>()

  // Computed loading state (true if any operation is pending)
  const loading = computed(() => sendEmailOperation.pending.value || verifyCodeOperation.pending.value)

  // Computed error state (show whichever operation has an error)
  const error = computed(() => sendEmailOperation.error.value || verifyCodeOperation.error.value)

  /**
   * Send password reset email
   */
  const sendResetEmail = async (): Promise<void> => {
    success.value = ''

    // Validation
    if (!credentials.value.email) {
      sendEmailOperation.execute(async () => ({
        success: false,
        error: { message: 'Please add your email', status: 400, code: 'VALIDATION_ERROR' } as APIError,
      }))
      return
    }

    // Adjust countdown for resends
    if (emailsCount.value > 0) {
      countDown.value += 30 * emailsCount.value
    }

    // Execute operation
    const result = await sendEmailOperation.execute(async () => {
      return await $api.auth.requestPasswordReset(credentials.value.email!)
    })

    if (result) {
      emailSent.value = true
      success.value = result.message
      emailsCount.value++

      // Start countdown timer
      const interval = setInterval(() => {
        if (countDown.value === 0) {
          clearInterval(interval)
          return
        }
        countDown.value--
      }, 1000) // Fixed: always 1 second, not multiplied by emailsCount
    }
  }

  /**
   * Verify password reset code
   */
  const verifyResetCode = async (): Promise<void> => {
    success.value = ''

    // Validation
    if (!credentials.value.email || !credentials.value.verification) {
      verifyCodeOperation.execute(async () => ({
        success: false,
        error: { message: 'Please add your information', status: 400, code: 'VALIDATION_ERROR' } as APIError,
      }))
      return
    }

    // Execute operation
    const result = await verifyCodeOperation.execute(async () => {
      return await $api.auth.verifyForgotPassword(
        credentials.value.email!,
        credentials.value.verification!
      )
    })

    if (result) {
      success.value = result.message
      verified.value = true
      token.value = result.token || null

      // Update URL with token
      if (result.token) {
        router.push({ query: { token: result.token } })
      }
    }
  }

  /**
   * Reset all state
   */
  const reset = () => {
    credentials.value = { email: null, verification: null }
    emailSent.value = false
    emailsCount.value = 0
    countDown.value = 30
    verified.value = false
    token.value = null
    success.value = ''
    sendEmailOperation.reset()
    verifyCodeOperation.reset()
  }

  // Initialize from route query params
  onMounted(() => {
    if (route.query.email) {
      credentials.value.email = route.query.email as string
    }
    if (route.query.token && typeof route.query.token === 'string') {
      // If token is already in URL, we're verified
      token.value = route.query.token
      verified.value = true
    }
    if (route.query.verification && typeof route.query.verification === 'string') {
      // Pre-fill verification code from email link
      credentials.value.verification = route.query.verification
      emailSent.value = true
    }
  })

  return {
    credentials,
    emailSent,
    emailsCount,
    countDown,
    verified,
    token,
    loading,
    error,
    success,
    sendResetEmail,
    verifyResetCode,
    reset,
  }
}
