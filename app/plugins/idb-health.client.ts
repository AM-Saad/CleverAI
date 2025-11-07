import { useStorageHealth } from '../composables/useStorageHealth'
import { DB_CONFIG } from '../utils/constants/pwa'

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
    const openReq = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)
    const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      openReq.onerror = () => reject(openReq.error)
      openReq.onblocked = () => reject(new Error('blocked'))
      openReq.onsuccess = () => resolve(openReq.result)
      openReq.onupgradeneeded = () => {
        // Minimal creation path; unified upgrade logic lives elsewhere
        const db = openReq.result
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FORMS)) {
          db.createObjectStore(DB_CONFIG.STORES.FORMS, { keyPath: 'id' })
        }
      }
    })
    opened = await openPromise
  } catch (e: any) {
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
