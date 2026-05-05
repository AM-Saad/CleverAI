// app/composables/useCreditsStore.ts
interface CreditsBalanceResponse {
  balance?: number;
  data?: {
    balance?: number;
  };
}

interface SpendCreditResponse {
  ok?: boolean;
  success?: boolean;
}

export const useCreditsStore = defineStore('credits', () => {
  const balance = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isWalletOpen = ref(false)

  async function fetchBalance() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<CreditsBalanceResponse>('/api/credits/balance')
      balance.value = data.data?.balance ?? data.balance ?? 0
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Failed to fetch credit balance'
      console.error('[credits] fetchBalance error:', err)
    } finally {
      loading.value = false
    }
  }

  async function spendCredit(): Promise<boolean> {
    try {
      const result = await $fetch<SpendCreditResponse>('/api/credits/spend', { method: 'POST' })
      const spent = result.ok ?? result.success ?? false
      if (spent) balance.value = Math.max(0, balance.value - 1)
      return spent
    } catch {
      return false
    }
  }

  function openWallet() { isWalletOpen.value = true }
  function closeWallet() { isWalletOpen.value = false }

  const hasCredits = computed(() => balance.value > 0)

  return { balance, loading, error, hasCredits, isWalletOpen, openWallet, closeWallet, fetchBalance, spendCredit }
})
