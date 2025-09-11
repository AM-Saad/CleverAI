// app/composables/useOffline.ts

/**
 * Minimal offline form queueing for login (or other small forms).
 * - Writes records into IndexedDB: DB 'recwide_db', store 'forms' (keyPath: 'id')
 * - Schedules a one-off Background Sync ('syncForm'); the SW will read & POST them
 * - NOTE: Do NOT store raw passwords. We only keep the email and a marker.
 */

import {
  DB_CONFIG,
  SYNC_TAGS,
  DOM_EVENTS,
  SW_MESSAGE_TYPES
} from '../../shared/constants'

type QueuedForm = {
  id: string
  email: string
  payload: Record<string, unknown>
  createdAt: number
}

// Use centralized database configuration
const { NAME: DB_NAME, VERSION: DB_VERSION, STORES: { FORMS: STORE } } = DB_CONFIG

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      // (re)create store with the right keyPath; SW expects this shape
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE)
      }
      const store = db.createObjectStore(STORE, { keyPath: 'id' })
      try { store.createIndex('email', 'email', { unique: false }) } catch {}
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putForm(record: QueuedForm): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE], 'readwrite')
    const store = tx.objectStore(STORE)
    store.put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export function useOffline(): {
  handleOfflineSubmit: (credentials: { email: string; password: string }) => Promise<void>
} {
  const handleOfflineSubmit = async (credentials: { email: string; password: string }): Promise<void> => {
    // 1) Queue a sanitized record locally
    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await putForm({
      id,
      email: credentials.email,
      // DO NOT store the raw password; keep a marker so the server knows this came from offline
      payload: { type: 'login', hasPassword: Boolean(credentials.password) },
      createdAt: Date.now(),
    })

    // Emit a UI event so the app can show immediate feedback
    try {
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.OFFLINE_FORM_SAVED, {
        detail: { id, email: credentials.email }
      }))
    } catch {
      // window may be undefined in some SSR contexts; ignore
    }

    // 2) Ask the active SW to run background sync when online
    try {
      const reg = await navigator.serviceWorker.ready
      // This tag is what the SW listens for in its 'sync' event
      // We cannot pass payload here; the SW reads from IndexedDB instead.
      // @ts-expect-error - older TS libdefs don't know about SyncManager in some targets
      await reg.sync?.register?.(SYNC_TAGS.FORM)
    } catch {
      // Not supported or denied; no-op.
    }

    console.log('Form data queued locally and Background Sync requested.')
  }

  return { handleOfflineSubmit }
}
