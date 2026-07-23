/**
 * Composable for managing App Icon Badging (navigator.setAppBadge / navigator.clearAppBadge)
 * Gracefully degrades on platforms or browsers that do not support badging.
 */
export function useAppBadging() {
  const isSupported = computed(() => {
    return import.meta.client && typeof navigator !== 'undefined' && 'setAppBadge' in navigator
  })

  const currentBadgeCount = ref<number>(0)

  const setBadge = async (count: number) => {
    currentBadgeCount.value = Math.max(0, count)
    if (!isSupported.value) return

    try {
      if (currentBadgeCount.value > 0) {
        await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(currentBadgeCount.value)
      } else {
        await clearBadge()
      }
    } catch (err) {
      console.warn('[PWA Badging] Failed to set app badge:', err)
    }
  }

  const clearBadge = async () => {
    currentBadgeCount.value = 0
    if (!isSupported.value) return

    try {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge()
    } catch (err) {
      console.warn('[PWA Badging] Failed to clear app badge:', err)
    }
  }

  return {
    isSupported,
    badgeCount: readonly(currentBadgeCount),
    setBadge,
    clearBadge,
  }
}
