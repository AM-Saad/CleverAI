import { ref, onMounted, type Ref, nextTick } from 'vue'
import { useRoute, useNuxtApp } from '#app'
import { createVerificationFlow } from '@/composables/auth/_verificationBase'

export interface EmailVerificationState {
  credentials: Ref<{ email: string | null; verification: string | null }>
  emailSent: Ref<boolean>
  emailsCount: Ref<number>
  resendCountDown: Ref<number>
  remainingAttempts: Ref<number | null>
  loading: Ref<boolean>
  error: Ref<string>
  success: Ref<string>
  // throttle helpers
  canResend: Readonly<Ref<boolean>>
  inlineHintVisible: Readonly<Ref<boolean>>
  progressPercent: Readonly<Ref<number>>
  showToast: Readonly<Ref<boolean>>
  // actions
  handleSendEmail: () => Promise<void>
  handleSubmit: () => Promise<void>
  submitForm: () => Promise<void>
}

export function useEmailVerification(persistKey = 'verify-throttle'): EmailVerificationState {
  const route = useRoute()
  const { $api } = useNuxtApp()

  const flow = createVerificationFlow({
    send: (email) => $api.auth.sendVerificationEmail(email),
    verify: (email, code) => $api.auth.verifyAccount(email, code),
    persistKey,
    initialSeconds: route.query.code ? 30 : 0,
  })

  onMounted(() => {
    if (route.query.email) flow.credentials.value.email = route.query.email as string
    if (route.query.code) flow.emailSent.value = true
  })

  return {
    credentials: flow.credentials,
    emailSent: flow.emailSent,
    emailsCount: flow.emailsCount,
    resendCountDown: flow.seconds,
    remainingAttempts: flow.remainingAttempts,
    loading: flow.loading,
    error: flow.error as Ref<string>,
    success: flow.success,
    canResend: flow.canResend,
    inlineHintVisible: flow.inlineHintVisible,
    progressPercent: flow.progressPercent,
    showToast: flow.showToast,
    handleSendEmail: flow.handleSendEmail,
    handleSubmit: flow.handleSubmit,
    submitForm: flow.submitForm,
  }
}
