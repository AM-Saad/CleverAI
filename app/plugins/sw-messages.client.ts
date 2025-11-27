/**
 * Global listener for Service Worker messages
 * Handles error/warning notifications from SW
 */

export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  const toast = useToast()
  const router = useRouter()

  // Track which messages we've shown to avoid spam
  const shownMessages = new Set<string>()

  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data

    if (!message || typeof message !== 'object') return

    const { type, data } = message

    // Handle storage/IDB errors
    if (type === 'warning' && data?.identifier === 'storage-backing-store-error') {
      // Only show once per session
      if (shownMessages.has(data.identifier)) return
      shownMessages.add(data.identifier)

      toast.add({
        title: 'Storage Issue Detected',
        description: data.message || 'Browser storage is having issues.',
        color: 'warning',
        actions: data.action
          ? [
              {
                label: 'Fix Now',
                onClick: () => {
                  router.push(data.action)
                }
              }
            ]
          : undefined
      })
    }

    // Handle general IDB failures
    if (type === 'error' && data?.identifier === 'idb-init-failed') {
      if (shownMessages.has(data.identifier)) return
      shownMessages.add(data.identifier)

      toast.add({
        title: 'Offline Storage Unavailable',
        description: data.message || 'Offline features may not work properly.',
        color: 'error'
      })
    }

    // Handle SW update available
    if (type === 'update-available') {
      toast.add({
        title: 'Update Available',
        description: 'A new version is available. Refresh to update.',
        color: 'info',
        actions: [
          {
            label: 'Refresh',
            onClick: () => {
              window.location.reload()
            }
          }
        ]
      })
    }
  })
})
