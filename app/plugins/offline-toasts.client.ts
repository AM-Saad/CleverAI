// app/plugins/offline-toasts.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  const toast = useToast?.() as ReturnType<typeof useToast> | undefined

  const onSaved = (e: Event) => {
    const d = (e as CustomEvent).detail as { id?: string; email?: string } | undefined
    console.log('[Offline]', 'Form queued locally', d)
    toast?.add({
      title: 'Saved for offline',
      description: d?.email ? `We’ll send your login for ${d.email} when you’re online.` : 'Your form was queued.',
    })
  }

  const onSyncStart = (e: Event) => {
    const d = (e as CustomEvent).detail as { message?: string } | undefined
    console.log('[Offline]', 'Sync started', d)
    toast?.add({
      title: 'Syncing…',
      description: d?.message || 'Trying to send your queued form now.',
    })
  }

  const onSynced = (e: Event) => {
    const d = (e as CustomEvent).detail as { message?: string } | undefined
    console.log('[Offline]', 'Sync complete', d)
    toast?.add({
      title: 'Sent!',
      description: d?.message || 'Your queued form was delivered.',
      type: 'background',
    })
  }

  const onSyncError = (e: Event) => {
    const d = (e as CustomEvent).detail as { message?: string } | undefined
    console.warn('[Offline]', 'Sync failed', d)
    toast?.add({
      title: 'Sync failed',
      description: d?.message || 'We’ll retry when you’re back online.',
       type: 'background',
    })
  }

  window.addEventListener('offline-form-saved', onSaved)
  window.addEventListener('offline-form-sync-started', onSyncStart)
  window.addEventListener('offline-form-synced', onSynced)
  window.addEventListener('offline-form-sync-error', onSyncError)
})
