// app/composables/useCreditsStore.ts
export const useCreditsStore = defineStore('credits', () => {
  const balance = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchBalance() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/credits/balance')
      balance.value = data.balance
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Failed to fetch credit balance'
      console.error('[credits] fetchBalance error:', err)
    } finally {
      loading.value = false
    }
  }

  async function spendCredit(): Promise<boolean> {
    try {
      const { ok } = await $fetch('/api/credits/spend', { method: 'POST' })
      if (ok) balance.value = Math.max(0, balance.value - 1)
      return ok
    } catch {
      return false
    }
  }

  const hasCredits = computed(() => balance.value > 0)

  return { balance, loading, error, hasCredits, fetchBalance, spendCredit }
})