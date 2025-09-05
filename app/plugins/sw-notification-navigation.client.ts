import { defineNuxtPlugin } from '#app'

// Handles messages from the Service Worker of type NOTIFICATION_CLICK_NAVIGATE
// and routes the SPA accordingly. Debounces rapid duplicates and focuses visibility.
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const pending = new Set<string>()
  const router = useRouter()

  function handleNavigate(url: string) {
    if (!url) return
    if (pending.has(url)) return
    pending.add(url)
    // Small delay helps ensure SW activation/state is settled
    setTimeout(async () => {
      try {
        // Normalize to internal path if same-origin full URL
        try {
          const u = new URL(url, window.location.origin)
          if (u.origin === window.location.origin) url = u.pathname + u.search + u.hash
        } catch { /* ignore parse */ }
  await router.push(url as string)
      } finally {
        setTimeout(() => pending.delete(url), 1500)
      }
    }, 50)
  }

  function messageListener (evt: MessageEvent) {
    const data = evt.data
    if (!data || typeof data !== 'object') return
    if (data.type === 'NOTIFICATION_CLICK_NAVIGATE') {
      handleNavigate(data.url)
    }
  }

  navigator.serviceWorker.addEventListener('message', messageListener)

  // Cleanup on HMR / page unload
  if (import.meta.hot) {
    import.meta.hot.accept()
    import.meta.hot.dispose(() => {
      try {
        navigator.serviceWorker.removeEventListener('message', messageListener)
      } catch (e) {
        console.warn('[sw-notification-navigation] remove listener failed', e)
      }
    })
  }
})
