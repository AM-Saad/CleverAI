import { ref, type Ref } from 'vue'
import { useRoute, useRouter, useNuxtApp } from '#app'
import { createVerificationFlow } from '@/composables/auth/_verificationBase'

export interface PasswordResetVerificationState {
  credentials: Ref<{ email: string | null; verification: string | null }>
  emailSent: Ref<boolean>
  emailsCount: Ref<number>
  countDown: Ref<number>
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
  sendResetEmail: () => Promise<void>
  verifyResetCode: () => Promise<void>
  submitForm: () => Promise<void>
}

export function usePasswordResetVerification(persistKey = 'reset-throttle'): PasswordResetVerificationState {
  const router = useRouter()
  const route = useRoute()
  const { $api } = useNuxtApp()

  const credentials = ref<{ email: string | null; verification: string | null }>({ email: null, verification: null })
  const emailSent = ref(false)
  const emailsCount = ref(0)
  const countDown = ref(30)
  const remainingAttempts = ref<number | null>(null)
  const verified = ref(false)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref('')

  const flow = createVerificationFlow({
    send: (email) => $api.auth.requestPasswordReset(email),
    verify: (email, code) => $api.auth.verifyForgotPassword(email, code),
    persistKey,
    initialSeconds: 0,
    onVerifySuccess: (payload, ctx) => {
      ctx.success.value = payload.message
      ctx.verified.value = true
      if (payload.token) {
        ctx.token.value = payload.token
        ctx.router.push({ query: { token: payload.token } })
      }
    }
  })

  // Initialize from route
  if (route.query.email) flow.credentials.value.email = route.query.email as string
  if (route.query.token && typeof route.query.token === 'string') {
    flow.token.value = route.query.token
    flow.verified.value = true
  }
  if (route.query.verification && typeof route.query.verification === 'string') {
    flow.credentials.value.verification = route.query.verification
    flow.emailSent.value = true
  }

  return {
    credentials: flow.credentials,
    emailSent: flow.emailSent,
    emailsCount: flow.emailsCount,
    countDown: flow.seconds,
    remainingAttempts: flow.remainingAttempts,
    verified: flow.verified,
    token: flow.token,
    loading: flow.loading,
    error: flow.error,
    success: flow.success,
    canResend: flow.canResend,
    inlineHintVisible: flow.inlineHintVisible,
    progressPercent: flow.progressPercent,
    showToast: flow.showToast,
    sendResetEmail: flow.handleSendEmail,
    verifyResetCode: flow.handleSubmit,
    submitForm: flow.submitForm,
  }
}
