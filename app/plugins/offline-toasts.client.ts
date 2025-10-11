// app/plugins/offline-toasts.client.ts
import { watch } from 'vue'
import { useServiceWorkerBridge } from '~/composables/useServiceWorkerBridge'
import { DOM_EVENTS } from '~~/shared/constants'

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  const toast = useToast?.() as ReturnType<typeof useToast> | undefined

  // Keep immediate feedback for saving (DOM event from useOffline)
  const onSaved = (e: Event) => {
    const d = (e as CustomEvent).detail as { id?: string; email?: string } | undefined
    console.log('[Offline]', 'Form queued locally', d)
    toast?.add({
      title: 'Saved for offline',
      description: d?.email ? `We’ll send your login for ${d.email} when you’re online.` : 'Your form was queued.',
    })
  }
  window.addEventListener(DOM_EVENTS.OFFLINE_FORM_SAVED, onSaved)

  // Use the composable as the single SW message hub
  const sw = useServiceWorkerBridge()
  sw.startListening()

  watch(sw.lastFormSyncEventType, (t) => {
    if (!t) return
    const msg = sw.formSyncStatus.value || undefined
    if (t === 'SYNC_FORM') {
      console.log('[Offline]', 'Sync started', msg)
      toast?.add({ title: 'Syncing…', description: msg || 'Trying to send your queued form now.' })
    } else if (t === 'FORM_SYNCED') {
      console.log('[Offline]', 'Sync complete', msg)
      toast?.add({ title: 'Sent!', description: msg || 'Your queued form was delivered.', type: 'background' })
    } else if (t === 'FORM_SYNC_ERROR') {
      console.warn('[Offline]', 'Sync failed', msg)
      toast?.add({ title: 'Sync failed', description: msg || 'We’ll retry when you’re back online.', type: 'background' })
    }
  })
})
