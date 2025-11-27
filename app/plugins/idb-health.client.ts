import { useStorageHealth } from '../composables/useStorageHealth'
import { DB_CONFIG } from '../utils/constants/pwa'
import { openUnifiedDB } from '../utils/idb'

/**
 * Early IndexedDB availability + basic write test.
 * Marks storage restricted if:
 *  - indexedDB not present
 *  - open() errors synchronously/asynchronously
 *  - test transaction fails with InvalidStateError / QuotaExceededError
 */
export default defineNuxtPlugin(async () => {
  if (process.server) return
  const { setRestricted } = useStorageHealth()
  const toast = typeof useToast === 'function' ? useToast() : null

  if (!(window.indexedDB)) {
    setRestricted('IndexedDB API missing')
    toast?.add({ title: 'Limited offline support', description: 'Browser lacks IndexedDB; offline features disabled.', color: 'warning' })
    return
  }

  let opened: IDBDatabase | null = null
  try {
    // Use unified opener to ensure all stores/indexes exist consistently
    opened = await openUnifiedDB()
  } catch (e: any) {
    console.error('Failed to open IndexedDB', e)
    setRestricted('Failed to open IndexedDB')
    toast?.add({ title: 'Offline storage blocked', description: 'Browser blocked database access.', color: 'error' })
    return
  }

  // Write test (small put) to detect private mode quota issues
  try {
    const tx = opened.transaction([DB_CONFIG.STORES.FORMS], 'readwrite')
    const store = tx.objectStore(DB_CONFIG.STORES.FORMS)
    store.put({ id: '__health_check__', ts: Date.now() })
    tx.onabort = () => {
      setRestricted('Transaction aborted (likely quota)')
      toast?.add({ title: 'Offline storage limited', description: 'Browser aborted DB transaction.', color: 'warning' })
    }
    tx.onerror = () => {
      setRestricted('Transaction error (likely restricted)')
      toast?.add({ title: 'Offline storage error', description: 'Cannot persist offline data.', color: 'warning' })
    }
  } catch (err: any) {
    setRestricted('Failed to start transaction')
    toast?.add({ title: 'Offline storage unavailable', description: 'Cannot write to local database.', color: 'error' })
  }
})
