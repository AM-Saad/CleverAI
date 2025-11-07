export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  try {
    const toast = typeof useToast === 'function' ? useToast() : null
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as any
      if (!data || typeof data !== 'object') return

      if (data.type === 'error' && data.data?.identifier === 'idb-init-failed') {
        toast?.add({
          title: 'Offline storage unavailable',
          description: 'Your browser blocked IndexedDB. Offline queue is disabled.',
          color: 'error'
        })
      }

      if (data.type === 'FORM_SYNCED') {
        toast?.add({ title: 'Offline data synced', description: 'Your offline changes were sent.' })
      }
      if (data.type === 'FORM_SYNC_ERROR') {
        toast?.add({ title: 'Offline sync failed', description: 'Will retry when back online.', color: 'warning' })
      }
    })

    // Listen for early storage restriction event
    window.addEventListener('storage-restricted', (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      toast?.add({
        title: 'Limited offline capabilities',
        description: detail.reason ? String(detail.reason) : 'Local storage is restricted; offline persistence reduced.',
        color: 'warning'
      })
    })
  } catch {
    // ignore
  }
})
