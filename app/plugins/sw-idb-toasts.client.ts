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

      if (data.type === 'NOTES_SYNC_STARTED') {
        toast?.add({ title: 'Syncing notes…', description: data?.data?.pendingCount ? `${data.data.pendingCount} pending change(s).` : 'Pending changes are being sent now.' })
      }
      if (data.type === 'NOTES_SYNCED') {
        const applied = data?.data?.appliedCount ?? data?.data?.applied ?? 0
        const conflicts = data?.data?.conflictsCount ?? 0
        const descParts = [] as string[]
        descParts.push(applied ? `${applied} applied` : 'No changes applied')
        if (conflicts) {
          descParts.push(`${conflicts} conflict(s)`)
        } else {
          descParts.push('No conflicts')
        }
        toast?.add({ title: 'Notes sync complete', description: descParts.join(' • ') })
      }
      if (data.type === 'NOTES_SYNC_ERROR') {
        toast?.add({ title: 'Notes sync failed', description: 'Will retry when back online.', color: 'warning' })
      }
      if (data.type === 'NOTES_SYNC_CONFLICTS') {
        const conflicts = data?.data?.conflictsCount ?? 0
        toast?.add({ title: 'Notes conflicts', description: conflicts ? `${conflicts} note(s) need review.` : 'Conflicts detected.', color: 'warning' })
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
