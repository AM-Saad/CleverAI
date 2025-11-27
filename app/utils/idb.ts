// shared/idb.ts
/**
 * Shared IndexedDB helper for consistent database operations between client and service worker.
 * Ensures identical schema handling and non-destructive migrations.
 */

import { DB_CONFIG, IDB_RETRY_CONFIG } from "./constants/pwa";

// Unified DB open promise (singleton) to avoid repeated upgrade races.
let unifiedDbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens the IndexedDB database ensuring ALL declared stores exist.
 * This runs on version 4+; earlier versions used lazy per-store creation which
 * could fail to create additional stores if the first opener did not request them.
 */
export function openUnifiedDB(): Promise<IDBDatabase> {
  // If we already have a promise, ensure its resulting DB isn't stale (version check after resolution).
  if (unifiedDbPromise) return unifiedDbPromise;
  unifiedDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Create required stores if missing. KeyPath defaults to 'id'.
      const { STORES } = DB_CONFIG;
      const ensureStore = (name: string) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      ensureStore(STORES.FORMS);
      ensureStore(STORES.NOTES);
      ensureStore(STORES.PENDING_NOTES);

      // Add indexes for NOTES store if missing.
      try {
        if (db.objectStoreNames.contains(STORES.NOTES)) {
          const tx = req.transaction; // upgrade transaction
          if (tx) {
            const notesStore = tx.objectStore(STORES.NOTES);
            if (!notesStore.indexNames.contains('folderId')) {
              notesStore.createIndex('folderId', 'folderId', { unique: false });
            }
            if (!notesStore.indexNames.contains('updatedAt')) {
              notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
          }
        }
        // Add indexes for PENDING_NOTES store if missing.
        if (db.objectStoreNames.contains(STORES.PENDING_NOTES)) {
          const tx = req.transaction; // upgrade transaction
          if (tx) {
            const pending = tx.objectStore(STORES.PENDING_NOTES);
            if (!pending.indexNames.contains('updatedAt')) {
              pending.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            if (!pending.indexNames.contains('folderId')) {
              pending.createIndex('folderId', 'folderId', { unique: false });
            }
            if (!pending.indexNames.contains('conflicted')) {
              pending.createIndex('conflicted', 'conflicted', { unique: false });
            }
          }
        }
      } catch (e) {
        console.warn('[IDB] Failed creating indexes during upgrade:', e);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        // Post-open verification: if stores missing despite version, force rebuild.
        const required = [DB_CONFIG.STORES.FORMS, DB_CONFIG.STORES.NOTES, DB_CONFIG.STORES.PENDING_NOTES];
        const missing = required.filter(s => !db.objectStoreNames.contains(s));
        if (missing.length) {
          console.warn('[IDB] Detected missing stores post-open:', missing, 'forcing rebuild');
          db.close();
          // Force a version bump migration attempt by reopening with +1 temp version then desired version.
          const tempReq = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION + 1);
          tempReq.onupgradeneeded = () => {
            const udb = tempReq.result;
            for (const s of required) {
              if (!udb.objectStoreNames.contains(s)) udb.createObjectStore(s, { keyPath: 'id' });
            }
          };
          tempReq.onerror = () => resolve(db); // fallback
          tempReq.onsuccess = () => {
            const upgraded = tempReq.result;
            upgraded.close();
            // Final reopen at canonical version
            const finalReq = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);
            finalReq.onupgradeneeded = () => {
              const fdb = finalReq.result;
              for (const s of required) {
                if (!fdb.objectStoreNames.contains(s)) fdb.createObjectStore(s, { keyPath: 'id' });
              }
            };
            finalReq.onerror = () => resolve(db); // fallback to original
            finalReq.onsuccess = () => {
              resolve(finalReq.result);
            };
          };
          return;
        }
      } catch (e) {
        console.warn('[IDB] Post-open verification failed:', e);
      }
      resolve(db);
    };
    req.onerror = () => {
      // Handle scenario where live DB has a higher version than our constant (after a repair bump).
      if (req.error?.name === 'VersionError') {
        console.warn('[IDB] VersionError opening DB at version', DB_CONFIG.VERSION, '— attempting fallback open without explicit version');
        try {
          const fallbackReq = indexedDB.open(DB_CONFIG.NAME);
          fallbackReq.onsuccess = () => resolve(fallbackReq.result);
          fallbackReq.onerror = () => reject(fallbackReq.error);
          return;
        } catch (e) {
          // If fallback fails, propagate original error.
        }
      }
      reject(req.error);
    };
  });
  return unifiedDbPromise;
}

/**
 * Count records in a store.
 */
export async function countRecords(
  db: IDBDatabase,
  storeName: STORES
): Promise<number> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve(0);
    const tx = db.transaction([storeName], 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve((req.result as number) || 0);
    req.onerror = () => resolve(0);
  });
}


// (Removed deprecated openFormsDB/openNotesDB wrappers; use openUnifiedDB directly everywhere.)


export const saveNoteToIndexedDB = async (note: NoteState): Promise<void> => {
  try {
  const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
      console.warn('[IDB] NOTES store missing; queuing note change for sync');
      // Fallback: queue for background sync so changes aren't lost
      try {
        // Attempt a repair once before queuing
        try {
          unifiedDbPromise = null; // reset
          await openUnifiedDB();
        } catch {}
  const repairDb = await openUnifiedDB();
        if (repairDb.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
          await putRecord(repairDb, DB_CONFIG.STORES.NOTES as STORES, note);
          return;
        }
        await queueNoteChange({
          id: note.id,
          operation: 'upsert',
          updatedAt: Date.now(),
          localVersion: (note as any).localVersion ? (note as any).localVersion + 1 : 1,
          folderId: (note as any).folderId,
          content: (note as any).content,
        })
      } catch {}
      return;
    }
    // Reuse generic sanitized put
    await putRecord(db, DB_CONFIG.STORES.NOTES as STORES, note);
  } catch (error) {
    console.error("Failed to save note to IndexedDB:", error);
  }
};

export const loadNotesFromIndexedDB = async (
  folderId: string
): Promise<NoteState[]> => {
  try {
  const db = await openUnifiedDB();
    const tx = db.transaction([DB_CONFIG.STORES.NOTES], "readonly");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTES);
    const index = store.index("folderId");
    const request = index.getAll(folderId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load notes from IndexedDB:", error);
    return [];
  }
};

export const deleteNoteFromIndexedDB = async (noteId: string): Promise<void> => {
  try {
  const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
      // Fallback: queue delete
      try {
        try {
          unifiedDbPromise = null;
          await openUnifiedDB();
        } catch {}
  const repairDb = await openUnifiedDB();
        if (repairDb.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
          await deleteRecord(repairDb, DB_CONFIG.STORES.NOTES as STORES, noteId);
          return;
        }
        await queueNoteChange({ id: noteId, operation: 'delete', updatedAt: Date.now(), localVersion: 1 })
      } catch {}
      return;
    }
    await deleteRecord(db, DB_CONFIG.STORES.NOTES as STORES, noteId);
  } catch (error) {
    console.error("Failed to delete note from IndexedDB:", error);
  }
};

/**
 * Sanitizes an object for IndexedDB storage by removing non-cloneable properties.
 * Only keeps primitive types, arrays, and plain objects.
 */
export function sanitizeForIDB<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== "object") return obj;

  // Handle Date objects
  if (obj instanceof Date) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForIDB(item)) as T;
  }

  // Handle plain objects
  if (obj.constructor === Object || obj.constructor === undefined) {
    const sanitized = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, symbols, and undefined values
      if (
        typeof value === "function" ||
        typeof value === "symbol" ||
        value === undefined
      ) {
        continue;
      }
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForIDB(value);
    }
    return sanitized as T;
  }

  // For other object types (DOM elements, etc.), return a safe representation
  try {
    // Try JSON serialization test - if it fails, the object is not cloneable
    JSON.stringify(obj);
    return obj;
  } catch {
    // Return a simple string representation for non-cloneable objects
    return String(obj) as T;
  }
}

/**
 * Generic put operation for any store with automatic sanitization.
 */
export async function putRecord<T>(
  db: IDBDatabase,
  storeName: STORES,
  record: T
): Promise<void> {
  const {
    MAX_ATTEMPTS,
    BASE_DELAY_MS,
    FACTOR,
    MAX_DELAY_MS,
    JITTER_PCT,
  } = IDB_RETRY_CONFIG;

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  const calcDelay = (attempt: number) => {
    const raw = Math.min(BASE_DELAY_MS * Math.pow(FACTOR, attempt), MAX_DELAY_MS);
    const jitter = raw * JITTER_PCT * (Math.random() * 2 - 1); // +/- jitter
    return Math.max(0, Math.round(raw + jitter));
  };

  let lastErr: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const activeDb = attempt === 0 ? db : await openUnifiedDB();
      await new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = activeDb.transaction([storeName], 'readwrite');
        } catch (e: any) {
          return reject(e);
        }
        try {
          const store = tx.objectStore(storeName);
          store.put(sanitizeForIDB(record));
        } catch (inner) {
          return reject(inner);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
      });
      return; // success
    } catch (err: any) {
      lastErr = err;
      const transient = err && (err.name === 'InvalidStateError' || err.name === 'TransactionInactiveError');
      if (!transient) break; // non-transient, stop retrying
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(calcDelay(attempt));
        continue;
      }
    }
  }
  throw lastErr;
}

/**
 * Generic get operation for any store.
 */
export async function getRecord<T>(
  db: IDBDatabase,
  storeName: STORES,
  key: IDBValidKey
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic getAll operation for any store.
 */
export async function getAllRecords<T>(
  db: IDBDatabase,
  storeName: STORES
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// -------------------- Pending Notes Queue --------------------

export interface PendingNoteChange {
  id: string // note id (key)
  operation: 'upsert' | 'delete'
  updatedAt: number // client timestamp
  localVersion: number // monotonic per note
  folderId?: string
  content?: string
  conflicted?: boolean
}

/**
 * Queue a note change into PENDING_NOTES (coalesces by note id).
 */
export async function queueNoteChange(change: PendingNoteChange): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return;
  await putRecord(db, DB_CONFIG.STORES.PENDING_NOTES as STORES, change);
}

/**
 * Load all pending note changes.
 */
export async function loadPendingNoteChanges(): Promise<PendingNoteChange[]> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return [];
  return getAllRecords<PendingNoteChange>(db, DB_CONFIG.STORES.PENDING_NOTES as STORES);
}

/**
 * Delete pending note changes by ids.
 */
export async function deletePendingNoteChanges(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return;
  await Promise.all(ids.map(id => deleteRecord(db, DB_CONFIG.STORES.PENDING_NOTES as STORES, id)));
}

/**
 * Generic delete operation for any store.
 */
export async function deleteRecord(
  db: IDBDatabase,
  storeName: STORES,
  key: IDBValidKey
): Promise<void> {
  const {
    MAX_ATTEMPTS,
    BASE_DELAY_MS,
    FACTOR,
    MAX_DELAY_MS,
    JITTER_PCT,
  } = IDB_RETRY_CONFIG;
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  const calcDelay = (attempt: number) => {
    const raw = Math.min(BASE_DELAY_MS * Math.pow(FACTOR, attempt), MAX_DELAY_MS);
    const jitter = raw * JITTER_PCT * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(raw + jitter));
  };

  let lastErr: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const activeDb = attempt === 0 ? db : await openUnifiedDB();
      await new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = activeDb.transaction([storeName], 'readwrite');
        } catch (e: any) {
          return reject(e);
        }
        try {
          const store = tx.objectStore(storeName);
          store.delete(key);
        } catch (inner) {
          return reject(inner);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
      });
      return; // success
    } catch (err: any) {
      lastErr = err;
      const transient = err && (err.name === 'InvalidStateError' || err.name === 'TransactionInactiveError');
      if (!transient) break;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(calcDelay(attempt));
        continue;
      }
    }
  }
  throw lastErr;
}
