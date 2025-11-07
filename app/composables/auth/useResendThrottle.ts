import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import type { Result } from '~/types/Result'

interface UseResendThrottleOptions {
  seconds: Ref<number>
  attempts: Ref<number | null>
  persistKey?: string
}

interface UseResendThrottle {
  showToast: Readonly<Ref<boolean>>
  canResend: Readonly<Ref<boolean>>
  inlineHintVisible: Readonly<Ref<boolean>>
  attemptsLabel: Readonly<Ref<string | null>>
  cooldownLabel: Readonly<Ref<string | null>>
  progressPercent: Readonly<Ref<number>>
  applyServerThrottle: (resetSeconds?: number, remainingAttempts?: number) => void
  wrapResend: <T extends { resetSeconds?: number; remainingAttempts?: number }>(fn: () => Promise<Result<T>>) => Promise<Result<T>>
}

export function useResendThrottle(opts: UseResendThrottleOptions): UseResendThrottle {
  const { seconds, attempts, persistKey } = opts
  const totalSeconds = ref(0)

  const showToast = computed(() => seconds.value > 0 && attempts.value !== null && attempts.value <= 0)
  const canResend = computed(() => seconds.value <= 0 && (attempts.value === null || attempts.value > 0))
  const inlineHintVisible = computed(() => attempts.value !== null && attempts.value <= 0 && seconds.value > 0)

  const attemptsLabel = computed(() => (attempts.value !== null ? `Attempts left: ${attempts.value}.` : null))
  const cooldownLabel = computed(() => (seconds.value > 0 ? `Resend available in ${seconds.value}s.` : null))
  const progressPercent = computed(() => {
    if (!totalSeconds.value || totalSeconds.value <= 0) return 0
    const done = Math.max(0, totalSeconds.value - seconds.value)
    return Math.min(100, Math.round((done / totalSeconds.value) * 100))
  })

  const applyServerThrottle = (resetSeconds?: number, remainingAttempts?: number) => {
    if (typeof resetSeconds === 'number') {
      seconds.value = resetSeconds
      totalSeconds.value = resetSeconds
    }
    if (typeof remainingAttempts === 'number') attempts.value = remainingAttempts
  }

  const wrapResend = async <T extends { resetSeconds?: number; remainingAttempts?: number }>(fn: () => Promise<Result<T>>): Promise<Result<T>> => {
    const res = await fn()
    if (res && (res as any).success && (res as any).data) {
      const data = (res as any).data as T
      applyServerThrottle(data.resetSeconds, data.remainingAttempts)
    }
    return res
  }

  // Persistence: restore on init and persist on changes
  if (persistKey) {
    try {
      const raw = sessionStorage.getItem(persistKey)
      if (raw) {
        const data = JSON.parse(raw) as { seconds: number; attempts: number | null; totalSeconds?: number; ts: number }
        if (typeof data.seconds === 'number') {
          const elapsed = Math.floor((Date.now() - (data.ts || 0)) / 1000)
          const adjusted = Math.max(0, data.seconds - elapsed)
          seconds.value = adjusted
          totalSeconds.value = data.totalSeconds || data.seconds
        }
        if (typeof data.attempts !== 'undefined') attempts.value = data.attempts
      }
    } catch {
      /* ignore */
    }
    watch([seconds, attempts, totalSeconds], () => {
      try {
        sessionStorage.setItem(
          persistKey,
          JSON.stringify({ seconds: seconds.value, attempts: attempts.value, totalSeconds: totalSeconds.value, ts: Date.now() })
        )
      } catch {
        /* ignore */
      }
    })
  }

  // Initialize totalSeconds if a countdown is already running
  watch(seconds, (val, old) => {
    if (val > 0 && (!totalSeconds.value || old === 0)) totalSeconds.value = Math.max(totalSeconds.value, val)
  }, { immediate: true })

  return { showToast, canResend, inlineHintVisible, attemptsLabel, cooldownLabel, progressPercent, applyServerThrottle, wrapResend }
}
