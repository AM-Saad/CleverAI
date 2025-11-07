import { ref, type Ref } from 'vue'
import { useRouter } from '#app'
import { useResendThrottle } from '@/composables/auth/useResendThrottle'
import type { Result } from '~/types/Result'

export interface VerificationBaseOptions<TSend, TVerify> {
  // Called to send the code to the provided email
  send: (email: string) => Promise<Result<TSend>>
  // Called to verify the code for the email
  verify: (email: string, code: string) => Promise<Result<TVerify>>
  // sessionStorage key to persist throttle state
  persistKey: string
  // Initial countdown seconds before server returns authoritative resetSeconds
  initialSeconds?: number
  // On verify success: handle redirect/token specifics if needed
  onVerifySuccess?: (payload: TVerify, ctx: { router: ReturnType<typeof useRouter>, token: Ref<string | null>, verified: Ref<boolean>, success: Ref<string> }) => void
}

export interface VerificationBaseState<TSend, TVerify> {
  credentials: Ref<{ email: string | null; verification: string | null }>
  emailSent: Ref<boolean>
  emailsCount: Ref<number>
  seconds: Ref<number>
  remainingAttempts: Ref<number | null>
  verified: Ref<boolean>
  token: Ref<string | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  success: Ref<string>
  // throttle/computed helpers
  canResend: Readonly<Ref<boolean>>
  inlineHintVisible: Readonly<Ref<boolean>>
  progressPercent: Readonly<Ref<number>>
  showToast: Readonly<Ref<boolean>>
  // actions
  handleSendEmail: () => Promise<void>
  handleSubmit: () => Promise<void>
  submitForm: () => Promise<void>
}

export function createVerificationFlow<TSend extends { message: string; remainingAttempts?: number; resetSeconds?: number }, TVerify extends { message: string; redirect?: string; token?: string }>(
  opts: VerificationBaseOptions<TSend, TVerify>
): VerificationBaseState<TSend, TVerify> {
  const router = useRouter()

  const credentials = ref<{ email: string | null; verification: string | null }>({ email: null, verification: null })
  const emailSent = ref(false)
  const emailsCount = ref(0)
  const seconds = ref(opts.initialSeconds ?? 0)
  const remainingAttempts = ref<number | null>(null)
  const verified = ref(false)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref('')

  const { showToast, canResend, inlineHintVisible, progressPercent, wrapResend } = useResendThrottle({ seconds, attempts: remainingAttempts, persistKey: opts.persistKey })

  const startCountDown = (): void => {
    const interval = setInterval(() => {
      if (seconds.value === 0) {
        clearInterval(interval)
        return
      }
      seconds.value--
    }, 1000)
  }

  const handleSendEmail = async (): Promise<void> => {
    error.value = null
    success.value = ''

    loading.value = false

    if (!credentials.value.email) {
      error.value = 'Please add your email'
      return
    }

    if (emailsCount.value > 0) {
      // Local backoff; server remains authoritative via resetSeconds
      seconds.value += 30 * emailsCount.value
    }

    loading.value = true
    try {
      const resp = await wrapResend(async () => opts.send(credentials.value!.email!))
      if (!resp.success) throw resp.error
      emailSent.value = true
      success.value = resp.data.message
      emailsCount.value++
      if (seconds.value > 0) startCountDown()
    } catch (err: any) {
      error.value = err?.message || 'An error occurred'
    } finally {
      loading.value = false
    }
  }

  const handleSubmit = async (): Promise<void> => {
    error.value = ''

    if (!credentials.value.email || !credentials.value.verification) {
      error.value = 'Please add your information'
      return
    }

    loading.value = true
    try {
      const resp = await opts.verify(credentials.value.email!, credentials.value.verification!)
      if (!resp.success) throw resp.error
      const payload = resp.data
      success.value = payload.message
      if (opts.onVerifySuccess) {
        opts.onVerifySuccess(payload, { router, token, verified, success })
      } else if (payload.redirect) {
        setTimeout(() => router.push(payload.redirect!), 800)
      }
    } catch (err: any) {
      error.value = err?.message || 'An error occurred'
    } finally {
      loading.value = false
    }
  }

  const submitForm = async (): Promise<void> => {
    if (!emailSent.value) await handleSendEmail()
    else await handleSubmit()
  }

  return {
    credentials,
    emailSent,
    emailsCount,
    seconds,
    remainingAttempts,
    verified,
    token,
    loading,
    error,
    success,
    canResend,
    inlineHintVisible,
    progressPercent,
    showToast,
    handleSendEmail,
    handleSubmit,
    submitForm,
  }
}
