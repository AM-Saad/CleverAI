// shared/idb.ts
/**
 * Shared IndexedDB helper for consistent database operations between client and service worker.
 * Ensures identical schema handling and non-destructive migrations.
 */

import { DB_CONFIG } from "./constants/pwa";

export interface IDBHelperOptions {
  storeName: STORES;
  keyPath?: string;
  indexes?: Array<{
    name: string;
    keyPath: string;
    options?: IDBIndexParameters;
  }>;
}

/**
 * Opens IndexedDB with non-destructive schema management.
 * Creates stores and indexes only if missing; never deletes existing data.
 */
export function openIDB(options: IDBHelperOptions): Promise<IDBDatabase> {
  const { storeName, keyPath = "id", indexes = [] } = options;
  console.log("[IDB] Opening DB:", DB_CONFIG.NAME, "Store:", storeName);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);
    console.log("[IDB] Open request initiated.");
    req.onupgradeneeded = () => {
      const db = req.result;
      console.log("[IDB] Upgrade needed for DB:", db);
      // Non-destructive: only create store if missing
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(storeName)) {
        console.log("[IDB] Creating object store:", storeName);
        store = db.createObjectStore(storeName, { keyPath });
      } else {
        // Access existing store via upgrade transaction
        console.log(
          "[IDB] Object store exists:",
          storeName,
          db.objectStoreNames
        );
        try {
          const tx = req.transaction;
          if (tx) {
            store = tx.objectStore(storeName);
          } else {
            // Fallback: store exists, no upgrade needed
            return;
          }
        } catch {
          // Best-effort; continue even if accessing store fails
          return;
        }
      }

      // Ensure indexes exist (non-destructive)
      if (store && indexes.length > 0) {
        try {
          for (const { name, keyPath: indexKeyPath, options } of indexes) {
            if (!store.indexNames.contains(name)) {
              store.createIndex(name, indexKeyPath, options);
            }
          }
        } catch (error) {
          // Index creation failed; log but don't reject
          console.warn("[IDB] Index creation failed:", error);
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Simplified helper for common form storage operations.
 */
export async function openFormsDB(): Promise<IDBDatabase> {
  return openIDB({
    storeName: DB_CONFIG.STORES.FORMS,
    keyPath: "id",
    // Future: add indexes when needed
    indexes: [{ name: "email", keyPath: "email", options: { unique: false } }],
  });
}

// IndexedDB helpers for persistent local storage
export const openNotesDB = async (): Promise<IDBDatabase> => {
  return openIDB({
    storeName: DB_CONFIG.STORES.NOTES,
    keyPath: "id",
    indexes: [
      { name: "folderId", keyPath: "folderId", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  });
};


export const saveNoteToIndexedDB = async (note: NoteState): Promise<void> => {
  try {
    const db = await openNotesDB();
    const tx = db.transaction([DB_CONFIG.STORES.NOTES], "readwrite");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTES);
    store.put(note);
  } catch (error) {
    console.error("Failed to save note to IndexedDB:", error);
  }
};

export const loadNotesFromIndexedDB = async (
  folderId: string
): Promise<NoteState[]> => {
  try {
    const db = await openNotesDB();
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

export const deleteNoteFromIndexedDB = async (
  noteId: string
): Promise<void> => {
  try {
    const db = await openNotesDB();
    const tx = db.transaction([DB_CONFIG.STORES.NOTES], "readwrite");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTES);
    await store.delete(noteId);
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);

    // Sanitize the record before storing
    const sanitizedRecord = sanitizeForIDB(record);

    store.put(sanitizedRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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

/**
 * Generic delete operation for any store.
 */
export async function deleteRecord(
  db: IDBDatabase,
  storeName: STORES,
  key: IDBValidKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
