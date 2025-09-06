// app/plugins/sw-sync.client.ts
export default defineNuxtPlugin(async () => {
  if (!('serviceWorker' in navigator)) return

  // Wait until the SW is controlling the page
  const reg = await navigator.serviceWorker.ready

  // One-off Background Sync: let the SW run 'syncForm' when online
  if ('sync' in reg) {
      try {
        // @ts-expect-error Background Sync is not in some TS lib DOM versions
      await reg.sync.register('syncForm')
    } catch {
      // not supported / permission denied — ignore silently
    }
  }


  if ('periodicSync' in reg) {
    try {
      // @ts-expect-error periodicSync types are not guaranteed
      const tags = await reg.periodicSync.getTags?.()
      if (!tags?.includes('content-sync')) {
        // @ts-expect-error periodicSync types are not guaranteed
        await reg.periodicSync.register('content-sync', { minInterval: 60 * 60 * 1000 })
      }
    } catch {
      // not supported — ignore
    }
  }
})

// Bridge SW postMessage events to DOM CustomEvents for UI toasts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    const msg = (e.data || {}) as { type?: string; data?: any }
    switch (msg.type) {
      case 'SYNC_FORM':
        window.dispatchEvent(new CustomEvent('offline-form-sync-started', { detail: msg.data || {} }))
        break
      case 'FORM_SYNCED':
        window.dispatchEvent(new CustomEvent('offline-form-synced', { detail: msg.data || {} }))
        break
      case 'FORM_SYNC_ERROR':
        window.dispatchEvent(new CustomEvent('offline-form-sync-error', { detail: msg.data || {} }))
        break
    }
  })
}
