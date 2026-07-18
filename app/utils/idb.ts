// shared/idb.ts
/**
 * Shared IndexedDB helper for consistent database operations between client and service worker.
 * Ensures identical schema handling and non-destructive migrations.
 */

import { DB_CONFIG, IDB_RETRY_CONFIG } from "./constants/pwa";
import { comparePosition } from "../../shared/utils/position-key";
import type { Note } from "../../shared/utils/note.contract";
import type { NoteGroup } from "../../shared/utils/note-group.contract";
import type {
  NoteLayoutChange,
  PendingNoteChange,
  PendingNoteGroupChange,
} from "../../shared/utils/note-sync.contract";
import type { LocalFirstConflictRecord } from "./local-first/types";

type STORES = (typeof DB_CONFIG)["STORES"][keyof typeof DB_CONFIG.STORES];

export type StoredNoteState = Note & {
  userId?: string;
  type?: string;
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
};

export interface NoteSyncConflictRecord extends Omit<
  LocalFirstConflictRecord,
  "scope" | "resolution"
> {
  scope: "content" | "group" | "layout";
  resolution?: "keep-local" | "keep-server" | "manual-merge";
}

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
          db.createObjectStore(name, { keyPath: "id" });
        }
      };
      ensureStore(STORES.FORMS);
      ensureStore(STORES.NOTES);
      ensureStore(STORES.NOTE_GROUPS);
      ensureStore(STORES.PENDING_NOTES);
      ensureStore(STORES.PENDING_NOTE_GROUP_CHANGES);
      ensureStore(STORES.PENDING_NOTE_LAYOUTS);
      ensureStore(STORES.NOTE_SYNC_CONFLICTS);
      ensureStore(STORES.BOARD_ITEMS);
      ensureStore(STORES.PENDING_BOARD_ITEMS);
      ensureStore(STORES.BOARD_COLUMNS);
      ensureStore(STORES.USER_TAGS);
      ensureStore(STORES.OFFLINE_ENTITIES);
      ensureStore(STORES.OFFLINE_MUTATIONS);
      ensureStore(STORES.OFFLINE_CONFLICTS);
      ensureStore(STORES.OFFLINE_PACKS);
      ensureStore(STORES.OFFLINE_BLOBS);
      ensureStore(STORES.OFFLINE_SESSIONS);
      ensureStore(STORES.OFFLINE_SYNC_META);
      ensureStore(STORES.OFFLINE_LEGACY_RECOVERY);

      // Add indexes for NOTES store if missing.
      try {
        if (db.objectStoreNames.contains(STORES.NOTES)) {
          const tx = req.transaction;
          if (tx) {
            const notesStore = tx.objectStore(STORES.NOTES);
            if (!notesStore.indexNames.contains("workspaceId")) {
              notesStore.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
            if (!notesStore.indexNames.contains("updatedAt")) {
              notesStore.createIndex("updatedAt", "updatedAt", {
                unique: false,
              });
            }
            if (!notesStore.indexNames.contains("groupId")) {
              notesStore.createIndex("groupId", "groupId", { unique: false });
            }
          }
        }
        if (db.objectStoreNames.contains(STORES.NOTE_GROUPS)) {
          const tx = req.transaction;
          if (tx) {
            const groupsStore = tx.objectStore(STORES.NOTE_GROUPS);
            if (!groupsStore.indexNames.contains("workspaceId")) {
              groupsStore.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
            if (!groupsStore.indexNames.contains("order")) {
              groupsStore.createIndex("order", "order", { unique: false });
            }
          }
        }
        // Add indexes for BOARD_ITEMS store if missing.
        if (db.objectStoreNames.contains(STORES.BOARD_ITEMS)) {
          const tx = req.transaction;
          if (tx) {
            const boardItemsStore = tx.objectStore(STORES.BOARD_ITEMS);
            if (!boardItemsStore.indexNames.contains("userId")) {
              boardItemsStore.createIndex("userId", "userId", {
                unique: false,
              });
            }
            if (!boardItemsStore.indexNames.contains("updatedAt")) {
              boardItemsStore.createIndex("updatedAt", "updatedAt", {
                unique: false,
              });
            }
            if (!boardItemsStore.indexNames.contains("workspaceId")) {
              boardItemsStore.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
          }
        }
        // Add indexes for PENDING_NOTES store if missing.
        if (db.objectStoreNames.contains(STORES.PENDING_NOTES)) {
          const tx = req.transaction; // upgrade transaction
          if (tx) {
            const pending = tx.objectStore(STORES.PENDING_NOTES);
            if (!pending.indexNames.contains("updatedAt")) {
              pending.createIndex("updatedAt", "updatedAt", { unique: false });
            }
            if (!pending.indexNames.contains("workspaceId")) {
              pending.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
            if (!pending.indexNames.contains("conflicted")) {
              pending.createIndex("conflicted", "conflicted", {
                unique: false,
              });
            }
          }
        }
        if (db.objectStoreNames.contains(STORES.PENDING_NOTE_GROUP_CHANGES)) {
          const tx = req.transaction;
          if (tx) {
            const pendingGroups = tx.objectStore(
              STORES.PENDING_NOTE_GROUP_CHANGES,
            );
            if (!pendingGroups.indexNames.contains("workspaceId")) {
              pendingGroups.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
            if (!pendingGroups.indexNames.contains("updatedAt")) {
              pendingGroups.createIndex("updatedAt", "updatedAt", {
                unique: false,
              });
            }
          }
        }
        if (db.objectStoreNames.contains(STORES.NOTE_SYNC_CONFLICTS)) {
          const tx = req.transaction;
          if (tx) {
            const conflicts = tx.objectStore(STORES.NOTE_SYNC_CONFLICTS);
            if (!conflicts.indexNames.contains("workspaceId")) {
              conflicts.createIndex("workspaceId", "workspaceId", {
                unique: false,
              });
            }
            if (!conflicts.indexNames.contains("entityId")) {
              conflicts.createIndex("entityId", "entityId", { unique: false });
            }
            if (!conflicts.indexNames.contains("scope")) {
              conflicts.createIndex("scope", "scope", { unique: false });
            }
          }
        }
        const createIndex = (
          storeName: string,
          name: string,
          keyPath: string | string[],
        ) => {
          if (!db.objectStoreNames.contains(storeName)) return;
          const tx = req.transaction;
          if (!tx) return;
          const store = tx.objectStore(storeName);
          if (!store.indexNames.contains(name))
            store.createIndex(name, keyPath, { unique: false });
        };
        createIndex(STORES.OFFLINE_ENTITIES, "accountId", "accountId");
        createIndex(STORES.OFFLINE_ENTITIES, "accountEntity", [
          "accountId",
          "entity",
        ]);
        createIndex(STORES.OFFLINE_ENTITIES, "accountWorkspace", [
          "accountId",
          "workspaceId",
        ]);
        createIndex(STORES.OFFLINE_MUTATIONS, "accountId", "accountId");
        createIndex(STORES.OFFLINE_MUTATIONS, "accountStatus", [
          "accountId",
          "status",
        ]);
        createIndex(STORES.OFFLINE_MUTATIONS, "accountEntity", [
          "accountId",
          "entity",
          "entityId",
        ]);
        createIndex(STORES.OFFLINE_MUTATIONS, "createdAt", "createdAt");
        createIndex(STORES.OFFLINE_CONFLICTS, "accountId", "accountId");
        createIndex(STORES.OFFLINE_PACKS, "accountId", "accountId");
        createIndex(STORES.OFFLINE_PACKS, "accountWorkspace", [
          "accountId",
          "workspaceId",
        ]);
        createIndex(STORES.OFFLINE_BLOBS, "accountId", "accountId");
        createIndex(STORES.OFFLINE_SYNC_META, "accountId", "accountId");
        createIndex(STORES.OFFLINE_LEGACY_RECOVERY, "accountId", "accountId");
      } catch (e) {
        console.warn("[IDB] Failed creating indexes during upgrade:", e);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        // Post-open verification: if stores missing despite version, force rebuild.
        const required = [
          DB_CONFIG.STORES.FORMS,
          DB_CONFIG.STORES.NOTES,
          DB_CONFIG.STORES.NOTE_GROUPS,
          DB_CONFIG.STORES.PENDING_NOTES,
          DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES,
          DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS,
          DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS,
          DB_CONFIG.STORES.BOARD_ITEMS,
          DB_CONFIG.STORES.PENDING_BOARD_ITEMS,
          DB_CONFIG.STORES.BOARD_COLUMNS,
          DB_CONFIG.STORES.USER_TAGS,
          DB_CONFIG.STORES.OFFLINE_ENTITIES,
          DB_CONFIG.STORES.OFFLINE_MUTATIONS,
          DB_CONFIG.STORES.OFFLINE_CONFLICTS,
          DB_CONFIG.STORES.OFFLINE_PACKS,
          DB_CONFIG.STORES.OFFLINE_BLOBS,
          DB_CONFIG.STORES.OFFLINE_SESSIONS,
          DB_CONFIG.STORES.OFFLINE_SYNC_META,
          DB_CONFIG.STORES.OFFLINE_LEGACY_RECOVERY,
        ];
        const missing = required.filter(
          (s) => !db.objectStoreNames.contains(s),
        );
        if (missing.length) {
          console.warn(
            "[IDB] Detected missing stores post-open:",
            missing,
            "forcing rebuild",
          );
          db.close();
          // Force a version bump migration attempt by reopening with +1 temp version then desired version.
          const tempReq = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION + 1);
          tempReq.onupgradeneeded = () => {
            const udb = tempReq.result;
            for (const s of required) {
              if (!udb.objectStoreNames.contains(s))
                udb.createObjectStore(s, { keyPath: "id" });
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
                if (!fdb.objectStoreNames.contains(s))
                  fdb.createObjectStore(s, { keyPath: "id" });
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
        console.warn("[IDB] Post-open verification failed:", e);
      }
      resolve(db);
    };
    req.onerror = () => {
      // Handle scenario where live DB has a higher version than our constant (after a repair bump).
      if (req.error?.name === "VersionError") {
        console.warn(
          "[IDB] VersionError opening DB at version",
          DB_CONFIG.VERSION,
          "— attempting fallback open without explicit version",
        );
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
  storeName: STORES,
): Promise<number> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve(0);
    const tx = db.transaction([storeName], "readonly");
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve((req.result as number) || 0);
    req.onerror = () => resolve(0);
  });
}

// (Removed deprecated openFormsDB/openNotesDB wrappers; use openUnifiedDB directly everywhere.)

export const saveNoteToIndexedDB = async (
  note: StoredNoteState,
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
      unifiedDbPromise = null;
      const repairDb = await openUnifiedDB();
      if (repairDb.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
        await putRecord(repairDb, DB_CONFIG.STORES.NOTES as STORES, note);
        return;
      }
      throw new Error("Notes IndexedDB store is unavailable");
    }
    // Reuse generic sanitized put
    await putRecord(db, DB_CONFIG.STORES.NOTES as STORES, note);
  } catch (error) {
    console.error("Failed to save note to IndexedDB:", error);
    throw error;
  }
};

export const saveNotesToIndexedDB = async (
  notes: StoredNoteState[],
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
      console.warn(
        "[IDB] NOTES store missing; skipping bulk save and falling back",
      );
      // If doing bulk saves, we attempt to save them individually to trigger the queueing fallback
      for (const note of notes) {
        await saveNoteToIndexedDB(note);
      }
      return;
    }
    // Perform bulk put using a single transaction
    await putAllRecords(db, DB_CONFIG.STORES.NOTES as STORES, notes);
  } catch (error) {
    console.error("Failed to save notes to IndexedDB:", error);
  }
};

export const loadNotesFromIndexedDB = async (
  workspaceId: string,
): Promise<StoredNoteState[]> => {
  try {
    const db = await openUnifiedDB();
    const tx = db.transaction([DB_CONFIG.STORES.NOTES], "readonly");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTES);

    // Use the workspaceId index when available for performance.
    // Fall back to a full-store scan filtered client-side in case the index
    // was never created (old schema) or the upgrade transaction was interrupted.
    if (store.indexNames.contains("workspaceId")) {
      const index = store.index("workspaceId");
      const request = index.getAll(workspaceId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }

    // Full-scan fallback — filter by workspaceId on the client side.
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () =>
        resolve(
          (request.result || []).filter(
            (n: any) => n.workspaceId === workspaceId,
          ),
        );
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load notes from IndexedDB:", error);
    return [];
  }
};

export const loadBoardNotesFromIndexedDB = async (
  userId: string,
): Promise<StoredNoteState[]> => {
  try {
    const db = await openUnifiedDB();
    const tx = db.transaction([DB_CONFIG.STORES.NOTES], "readonly");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTES);

    // Try to use type index if available, otherwise fall back to full scan
    try {
      const typeIndex = store.index("type");
      const request = typeIndex.getAll("BOARD");

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // Filter by userId client-side as we don't have a compound index
          const boardNotes = (request.result || []).filter(
            (note: any) => note.userId === userId,
          );
          resolve(boardNotes);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (indexError) {
      // Fallback to full scan if index doesn't exist
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const allNotes = request.result || [];
          const boardNotes = allNotes.filter(
            (note: any) => note.type === "BOARD" && note.userId === userId,
          );
          resolve(boardNotes);
        };
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error("Failed to load board notes from IndexedDB:", error);
    return [];
  }
};

export const deleteNoteFromIndexedDB = async (
  noteId: string,
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
      unifiedDbPromise = null;
      const repairDb = await openUnifiedDB();
      if (!repairDb.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
        throw new Error("Notes store is unavailable");
      }
      await deleteRecord(repairDb, DB_CONFIG.STORES.NOTES as STORES, noteId);
      return;
    }
    await deleteRecord(db, DB_CONFIG.STORES.NOTES as STORES, noteId);
  } catch (error) {
    console.error("Failed to delete note from IndexedDB:", error);
    throw error;
  }
};

export const saveNoteGroupToIndexedDB = async (
  group: NoteGroup,
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_GROUPS)) return;
    await putRecord(db, DB_CONFIG.STORES.NOTE_GROUPS as STORES, group);
  } catch (error) {
    console.error("Failed to save note group to IndexedDB:", error);
  }
};

export const saveNoteGroupsToIndexedDB = async (
  groups: NoteGroup[],
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_GROUPS)) return;
    await putAllRecords(db, DB_CONFIG.STORES.NOTE_GROUPS as STORES, groups);
  } catch (error) {
    console.error("Failed to save note groups to IndexedDB:", error);
  }
};

export const loadNoteGroupsFromIndexedDB = async (
  workspaceId: string,
): Promise<NoteGroup[]> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_GROUPS)) return [];
    const tx = db.transaction([DB_CONFIG.STORES.NOTE_GROUPS], "readonly");
    const store = tx.objectStore(DB_CONFIG.STORES.NOTE_GROUPS);

    if (store.indexNames.contains("workspaceId")) {
      const request = store.index("workspaceId").getAll(workspaceId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () =>
          resolve((request.result || []).sort(comparePosition));
        request.onerror = () => reject(request.error);
      });
    }

    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () =>
        resolve(
          (request.result || [])
            .filter((group: NoteGroup) => group.workspaceId === workspaceId)
            .sort(comparePosition),
        );
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load note groups from IndexedDB:", error);
    return [];
  }
};

export const deleteNoteGroupFromIndexedDB = async (
  groupId: string,
): Promise<void> => {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_GROUPS)) return;
    await deleteRecord(db, DB_CONFIG.STORES.NOTE_GROUPS as STORES, groupId);
  } catch (error) {
    console.error("Failed to delete note group from IndexedDB:", error);
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
  record: T,
): Promise<void> {
  const { MAX_ATTEMPTS, BASE_DELAY_MS, FACTOR, MAX_DELAY_MS, JITTER_PCT } =
    IDB_RETRY_CONFIG;

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const calcDelay = (attempt: number) => {
    const raw = Math.min(
      BASE_DELAY_MS * Math.pow(FACTOR, attempt),
      MAX_DELAY_MS,
    );
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
          tx = activeDb.transaction([storeName], "readwrite");
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
        tx.onabort = () =>
          reject(tx.error || new Error("IDB transaction aborted"));
      });
      return; // success
    } catch (err: any) {
      lastErr = err;
      const transient =
        err &&
        (err.name === "InvalidStateError" ||
          err.name === "TransactionInactiveError");
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
 * Generic bulk put operation for any store using a single transaction.
 */
export async function putAllRecords<T>(
  db: IDBDatabase,
  storeName: STORES,
  records: T[],
): Promise<void> {
  if (!records.length) return;

  const { MAX_ATTEMPTS, BASE_DELAY_MS, FACTOR, MAX_DELAY_MS, JITTER_PCT } =
    IDB_RETRY_CONFIG;

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const calcDelay = (attempt: number) => {
    const raw = Math.min(
      BASE_DELAY_MS * Math.pow(FACTOR, attempt),
      MAX_DELAY_MS,
    );
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
          tx = activeDb.transaction([storeName], "readwrite");
        } catch (e: any) {
          return reject(e);
        }
        try {
          const store = tx.objectStore(storeName);
          for (const record of records) {
            store.put(sanitizeForIDB(record));
          }
        } catch (inner) {
          return reject(inner);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error || new Error("IDB transaction aborted"));
      });
      return; // success
    } catch (err: any) {
      lastErr = err;
      const transient =
        err &&
        (err.name === "InvalidStateError" ||
          err.name === "TransactionInactiveError");
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
  key: IDBValidKey,
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
  storeName: STORES,
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

/**
 * Queue a note change into PENDING_NOTES (coalesces by note id).
 */
export async function queueNoteChange(
  change: PendingNoteChange,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return;
  const tx = db.transaction(DB_CONFIG.STORES.PENDING_NOTES, "readwrite");
  const store = tx.objectStore(DB_CONFIG.STORES.PENDING_NOTES);
  const request = store.get(change.id);
  request.onsuccess = () => {
    const existing = request.result as PendingNoteChange | undefined;
    const serverVersion =
      existing?.serverVersion === undefined
        ? change.serverVersion
        : change.serverVersion === undefined
          ? existing.serverVersion
          : Math.max(existing.serverVersion, change.serverVersion);
    store.put(
      sanitizeForIDB({
        ...change,
        ...(serverVersion !== undefined && { serverVersion }),
        localVersion: Math.max(
          change.localVersion,
          existing ? existing.localVersion + 1 : 1,
        ),
      }),
    );
  };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Note queue transaction aborted"));
  });
}

/**
 * Revision-aware acknowledgement for the Notes outbox. The row observed by
 * the server is removed only when it is still the current row. A newer edit
 * is retained (and temp IDs are remapped) in the same IndexedDB transaction.
 */
export async function acknowledgePendingNoteChange(
  sent: PendingNoteChange,
  acknowledgement: {
    remapToId?: string;
    serverVersion?: number;
    keepCurrent?: boolean;
    localMutation?:
      | { type: "delete"; id?: string }
      | {
          type: "remap";
          fromId: string;
          note: StoredNoteState;
        }
      | {
          type: "advance";
          id: string;
          serverVersion?: number;
          updatedAt?: string;
        };
  } = {},
): Promise<PendingNoteChange | null> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES))
    return null;

  const transactionStores: STORES[] = [DB_CONFIG.STORES.PENDING_NOTES];
  const hasLocalStore = Boolean(
    acknowledgement.localMutation &&
    db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES),
  );
  if (hasLocalStore) {
    transactionStores.push(DB_CONFIG.STORES.NOTES);
  }
  const tx = db.transaction(transactionStores, "readwrite");
  const store = tx.objectStore(DB_CONFIG.STORES.PENDING_NOTES);
  const noteStore = hasLocalStore
    ? tx.objectStore(DB_CONFIG.STORES.NOTES)
    : null;
  let retained: PendingNoteChange | null = null;
  const request = store.get(sent.id);

  const applyLocalAcknowledgement = (shouldRetain: boolean) => {
    const mutation = acknowledgement.localMutation;
    if (!mutation || !noteStore) return;

    if (mutation.type === "delete") {
      if (!shouldRetain) noteStore.delete(mutation.id ?? sent.id);
      return;
    }

    if (mutation.type === "remap") {
      noteStore.delete(mutation.fromId);
      noteStore.put(
        sanitizeForIDB({
          ...mutation.note,
          id: acknowledgement.remapToId ?? mutation.note.id,
          isDirty: shouldRetain,
        }),
      );
      return;
    }

    const noteRequest = noteStore.get(mutation.id);
    noteRequest.onsuccess = () => {
      const note = noteRequest.result as StoredNoteState | undefined;
      if (!note) return;
      noteStore.put(
        sanitizeForIDB({
          ...note,
          ...(mutation.serverVersion !== undefined && {
            version: Math.max(note.version ?? 1, mutation.serverVersion),
          }),
          ...(mutation.updatedAt &&
            !shouldRetain && {
              updatedAt: new Date(mutation.updatedAt),
            }),
          isDirty: shouldRetain,
          isLoading: false,
          error: null,
          ...(!shouldRetain && { lastSaved: new Date() }),
        }),
      );
    };
  };

  request.onsuccess = () => {
    const current = request.result as PendingNoteChange | undefined;
    if (!current) {
      applyLocalAcknowledgement(false);
      return;
    }
    const isNewer =
      current.localVersion > sent.localVersion ||
      current.updatedAt > sent.updatedAt ||
      current.operation !== sent.operation;
    const shouldRetain = isNewer || acknowledgement.keepCurrent === true;
    const remapToId = acknowledgement.remapToId;

    if (!remapToId) {
      if (!shouldRetain) {
        store.delete(sent.id);
        applyLocalAcknowledgement(false);
        return;
      }
      retained = {
        ...current,
        ...(acknowledgement.serverVersion !== undefined && {
          serverVersion: acknowledgement.serverVersion,
        }),
      };
      store.put(sanitizeForIDB(retained));
      applyLocalAcknowledgement(true);
      return;
    }

    store.delete(sent.id);
    applyLocalAcknowledgement(shouldRetain);
    if (!shouldRetain) return;

    const canonicalRequest = store.get(remapToId);
    canonicalRequest.onsuccess = () => {
      const canonical = canonicalRequest.result as
        | PendingNoteChange
        | undefined;
      const remapped: PendingNoteChange = {
        ...current,
        id: remapToId,
        ...(acknowledgement.serverVersion !== undefined && {
          serverVersion: acknowledgement.serverVersion,
        }),
      };
      const next =
        canonical &&
        (canonical.localVersion > remapped.localVersion ||
          canonical.updatedAt > remapped.updatedAt)
          ? canonical
          : remapped;
      retained = next;
      store.put(sanitizeForIDB(next));
    };
  };

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Note acknowledgement transaction aborted"));
  });
  return retained;
}

/**
 * Replace one workspace's Notes cache with a server projection while applying
 * the current Notes outbox in the same transaction. This is deliberately not
 * a blind bulk put: clean rows absent from the server are garbage-collected,
 * pending deletes stay hidden, and pending/local edits win over an older GET.
 */
export async function reconcileNotesWorkspaceProjection(
  workspaceId: string,
  serverNotes: StoredNoteState[],
  volatileNotes: StoredNoteState[] = [],
): Promise<StoredNoteState[]> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
    throw new Error("Notes IndexedDB store is unavailable");
  }

  const transactionStores: STORES[] = [DB_CONFIG.STORES.NOTES];
  const hasPendingStore = db.objectStoreNames.contains(
    DB_CONFIG.STORES.PENDING_NOTES,
  );
  if (hasPendingStore) transactionStores.push(DB_CONFIG.STORES.PENDING_NOTES);

  const tx = db.transaction(transactionStores, "readwrite");
  const noteStore = tx.objectStore(DB_CONFIG.STORES.NOTES);
  const pendingStore = hasPendingStore
    ? tx.objectStore(DB_CONFIG.STORES.PENDING_NOTES)
    : null;
  let localRecords: StoredNoteState[] | null = null;
  let pendingRecords: PendingNoteChange[] | null = hasPendingStore ? null : [];
  let finalProjection: StoredNoteState[] = [];
  let applied = false;

  const applyProjection = () => {
    if (applied || !localRecords || !pendingRecords) return;
    applied = true;

    const localById = new Map(localRecords.map((note) => [note.id, note]));
    const pendingDeleteIds = new Set<string>();
    const desired = new Map<string, StoredNoteState>(
      serverNotes.map((note) => [
        note.id,
        {
          ...note,
          isDirty: false,
          isLoading: false,
          error: null,
        } as StoredNoteState,
      ]),
    );

    // Memory-only work that happened after the GET started must survive the
    // response even if its debounce has not written the outbox yet.
    for (const note of volatileNotes) {
      if (note.workspaceId === workspaceId) desired.set(note.id, note);
    }

    for (const change of pendingRecords) {
      const belongsToWorkspace =
        change.workspaceId === workspaceId ||
        (!change.workspaceId &&
          (desired.has(change.id) || localById.has(change.id)));
      if (!belongsToWorkspace) continue;

      if (change.operation === "delete") {
        pendingDeleteIds.add(change.id);
        desired.delete(change.id);
        continue;
      }

      const base = desired.get(change.id) ?? localById.get(change.id);
      const pendingNote: StoredNoteState = {
        ...(base ?? {
          id: change.id,
          workspaceId,
          groupId: change.groupId ?? null,
          title: change.title,
          content: change.content ?? "",
          tags: change.tags ?? [],
          order: change.order ?? desired.size,
          noteType: (change.noteType as Note["noteType"]) ?? "TEXT",
          metadata: change.metadata,
          version: change.serverVersion ?? 1,
          createdAt: new Date(change.updatedAt),
          updatedAt: new Date(change.updatedAt),
        }),
        id: change.id,
        workspaceId: change.workspaceId ?? workspaceId,
        ...(change.groupId !== undefined && { groupId: change.groupId }),
        ...(change.title !== undefined && { title: change.title }),
        ...(change.content !== undefined && { content: change.content }),
        ...(change.tags !== undefined && { tags: change.tags }),
        ...(change.order !== undefined && { order: change.order }),
        ...(change.noteType !== undefined && {
          noteType: change.noteType as Note["noteType"],
        }),
        ...(change.metadata !== undefined && { metadata: change.metadata }),
        updatedAt: new Date(change.updatedAt),
        isDirty: true,
        isLoading: false,
      };
      desired.set(change.id, pendingNote);
    }

    // A local dirty row may be between its cache write and outbox write in a
    // second tab. Preserve it; the Notes drainer repairs dirty rows that lack
    // a pending command before its next request.
    for (const local of localRecords) {
      if (
        local.isDirty &&
        !pendingDeleteIds.has(local.id) &&
        !desired.has(local.id)
      )
        desired.set(local.id, local);
    }

    for (const local of localRecords) {
      if (!desired.has(local.id)) noteStore.delete(local.id);
    }
    finalProjection = Array.from(desired.values());
    for (const note of finalProjection) {
      noteStore.put(sanitizeForIDB(note));
    }
  };

  const localRequest = noteStore.indexNames.contains("workspaceId")
    ? noteStore.index("workspaceId").getAll(workspaceId)
    : noteStore.getAll();
  localRequest.onsuccess = () => {
    const records = (localRequest.result ?? []) as StoredNoteState[];
    localRecords = noteStore.indexNames.contains("workspaceId")
      ? records
      : records.filter((note) => note.workspaceId === workspaceId);
    applyProjection();
  };

  if (pendingStore) {
    const pendingRequest = pendingStore.indexNames.contains("workspaceId")
      ? pendingStore.index("workspaceId").getAll(workspaceId)
      : pendingStore.getAll();
    pendingRequest.onsuccess = () => {
      const records = (pendingRequest.result ?? []) as PendingNoteChange[];
      pendingRecords = pendingStore.indexNames.contains("workspaceId")
        ? records
        : records.filter(
            (change) =>
              !change.workspaceId || change.workspaceId === workspaceId,
          );
      applyProjection();
    };
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Notes projection transaction aborted"));
  });
  return finalProjection;
}

/**
 * Load all pending note changes. If workspaceId is provided, filters the results.
 */
export async function loadPendingNoteChanges(
  workspaceId?: string,
): Promise<PendingNoteChange[]> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return [];
  const records = await getAllRecords<PendingNoteChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTES as STORES,
  );
  if (workspaceId) {
    return records.filter(
      (r) => !r.workspaceId || r.workspaceId === workspaceId,
    );
  }
  return records;
}

/**
 * Delete pending note changes by ids.
 */
export async function deletePendingNoteChanges(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) return;
  await Promise.all(
    ids.map((id) =>
      deleteRecord(db, DB_CONFIG.STORES.PENDING_NOTES as STORES, id),
    ),
  );
}

// -------------------- Pending Note Groups Queue --------------------

export async function queueNoteGroupChange(
  change: PendingNoteGroupChange,
): Promise<void> {
  const db = await openUnifiedDB();
  if (
    !db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES)
  )
    return;
  const existing = await getRecord<PendingNoteGroupChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES as STORES,
    change.id,
  );
  await putRecord(db, DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES as STORES, {
    ...change,
    localVersion: Math.max(
      change.localVersion,
      existing ? existing.localVersion + 1 : 1,
    ),
  });
}

export async function loadPendingNoteGroupChanges(
  workspaceId?: string,
): Promise<PendingNoteGroupChange[]> {
  const db = await openUnifiedDB();
  if (
    !db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES)
  )
    return [];
  const records = await getAllRecords<PendingNoteGroupChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES as STORES,
  );
  const scoped = workspaceId
    ? records.filter((record) => record.workspaceId === workspaceId)
    : records;
  return scoped.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function deletePendingNoteGroupChanges(
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  const db = await openUnifiedDB();
  if (
    !db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES)
  )
    return;
  await Promise.all(
    ids.map((id) =>
      deleteRecord(
        db,
        DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES as STORES,
        id,
      ),
    ),
  );
}

// -------------------- Pending Notes Layout Queue --------------------

/**
 * Queue the latest workspace note/group layout. This intentionally coalesces by
 * workspace so repeated drags do not create content-like dirty records.
 */
export async function queueNoteLayoutChange(
  change: NoteLayoutChange,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS))
    return;
  const existing = await getRecord<NoteLayoutChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
    change.workspaceId,
  );
  await putRecord(db, DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES, {
    ...change,
    id: change.workspaceId,
    localVersion: Math.max(
      change.localVersion,
      existing ? existing.localVersion + 1 : 1,
    ),
  });
}

export async function loadPendingNoteLayoutChange(
  workspaceId: string,
): Promise<NoteLayoutChange | null> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS))
    return null;
  const record = await getRecord<NoteLayoutChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
    workspaceId,
  );
  return record ?? null;
}

export async function loadPendingNoteLayoutChanges(): Promise<
  NoteLayoutChange[]
> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS))
    return [];
  return getAllRecords<NoteLayoutChange>(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
  );
}

export async function deletePendingNoteLayoutChange(
  workspaceId: string,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS))
    return;
  await deleteRecord(
    db,
    DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
    workspaceId,
  );
}

export async function remapPendingNoteGroupIds(
  groupIdMap: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(groupIdMap);
  if (!entries.length) return;
  const db = await openUnifiedDB();

  if (db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTES)) {
    const changes = await getAllRecords<PendingNoteChange>(
      db,
      DB_CONFIG.STORES.PENDING_NOTES as STORES,
    );
    const remapped = changes
      .filter((change) => change.groupId && groupIdMap[change.groupId])
      .map((change) => ({
        ...change,
        groupId: change.groupId
          ? (groupIdMap[change.groupId] ?? change.groupId)
          : change.groupId,
      }));
    if (remapped.length) {
      await putAllRecords(
        db,
        DB_CONFIG.STORES.PENDING_NOTES as STORES,
        remapped,
      );
    }
  }

  if (db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) {
    const notes = await getAllRecords<StoredNoteState>(
      db,
      DB_CONFIG.STORES.NOTES as STORES,
    );
    const remapped = notes
      .filter((note) => note.groupId && groupIdMap[note.groupId])
      .map((note) => ({
        ...note,
        groupId: note.groupId
          ? (groupIdMap[note.groupId] ?? note.groupId)
          : note.groupId,
      }));
    if (remapped.length) {
      await putAllRecords(db, DB_CONFIG.STORES.NOTES as STORES, remapped);
    }
  }

  if (db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS)) {
    const layouts = await getAllRecords<NoteLayoutChange>(
      db,
      DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
    );
    const remapped = layouts.map((layout) => ({
      ...layout,
      notes: layout.notes.map((note) => ({
        ...note,
        groupId: note.groupId
          ? (groupIdMap[note.groupId] ?? note.groupId)
          : note.groupId,
      })),
      groups: layout.groups.map((group) => ({
        ...group,
        id: groupIdMap[group.id] ?? group.id,
      })),
    }));
    if (remapped.length) {
      await putAllRecords(
        db,
        DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
        remapped,
      );
    }
  }
}

export async function remapPendingNoteIds(
  noteIdMap: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(noteIdMap);
  if (!entries.length) return;
  const db = await openUnifiedDB();

  if (db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS)) {
    const layouts = await getAllRecords<NoteLayoutChange>(
      db,
      DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
    );
    const remapped = layouts.map((layout) => ({
      ...layout,
      notes: layout.notes.map((note) => ({
        ...note,
        id: noteIdMap[note.id] ?? note.id,
      })),
    }));
    if (remapped.length) {
      await putAllRecords(
        db,
        DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS as STORES,
        remapped,
      );
    }
  }
}

/**
 * Reconcile a successful Offline V2 note create into the Notes view cache.
 * Remapping only the V2 outbox would leave the editor writing
 * to the temporary ID and turn later saves into additional creates.
 */
export async function reconcileOfflineV2NoteIds(
  noteIdMap: Record<string, string>,
  serverVersion?: number,
  syncedPayload?: Record<string, unknown>,
): Promise<void> {
  const entries = Object.entries(noteIdMap);
  if (!entries.length) return;
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) return;
  const tx = db.transaction(DB_CONFIG.STORES.NOTES, "readwrite");
  const transactionDone = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Note ID reconciliation was aborted"));
  });
  const noteStore = tx.objectStore(DB_CONFIG.STORES.NOTES);
  const readAll = <T>(store: IDBObjectStore): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const query = store.getAll();
      query.onsuccess = () => resolve(query.result as T[]);
      query.onerror = () => reject(query.error);
    });
  const notes = await readAll<StoredNoteState>(noteStore);

  for (const [tempId, serverId] of entries) {
    const note = notes.find((candidate) => candidate.id === tempId);
    if (note) {
      const matchesSyncedCreate =
        Boolean(syncedPayload) &&
        note.content === syncedPayload?.content &&
        note.title === syncedPayload?.title &&
        (note.groupId ?? null) === (syncedPayload?.groupId ?? null) &&
        note.order === syncedPayload?.order &&
        JSON.stringify(note.tags ?? []) ===
          JSON.stringify(syncedPayload?.tags ?? []) &&
        JSON.stringify(note.metadata ?? null) ===
          JSON.stringify(syncedPayload?.metadata ?? null);
      noteStore.delete(tempId);
      noteStore.put(
        sanitizeForIDB({
          ...note,
          id: serverId,
          ...(serverVersion !== undefined && { version: serverVersion }),
          isDirty: !matchesSyncedCreate,
          isLoading: false,
          error: null,
          lastSaved: new Date(),
        }),
      );
    }
  }
  await transactionDone;
}

/** Apply a V2 note acknowledgement without overwriting a newer local edit. */
export async function acknowledgeOfflineV2Note(
  noteId: string,
  syncedPayload: Record<string, unknown>,
  canonical?: Record<string, unknown> | null,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) return;
  const tx = db.transaction(DB_CONFIG.STORES.NOTES, "readwrite");
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Note acknowledgement was aborted"));
  });
  const store = tx.objectStore(DB_CONFIG.STORES.NOTES);
  const query = store.get(noteId);
  const note = await new Promise<StoredNoteState | undefined>(
    (resolve, reject) => {
      query.onsuccess = () =>
        resolve(query.result as StoredNoteState | undefined);
      query.onerror = () => reject(query.error);
    },
  );
  if (note) {
    const matches = [
      "title",
      "content",
      "groupId",
      "tags",
      "noteType",
      "metadata",
      "order",
    ].every((field) => {
      if (!(field in syncedPayload)) return true;
      const left = (note as unknown as Record<string, unknown>)[field];
      const right = syncedPayload[field];
      return typeof left === "object" || typeof right === "object"
        ? JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
        : (left ?? null) === (right ?? null);
    });
    store.put(
      sanitizeForIDB({
        ...note,
        ...(matches && canonical ? canonical : {}),
        id: noteId,
        isDirty: !matches,
        isLoading: false,
        error: null,
        lastSaved: new Date(),
      }),
    );
  }
  await done;
}

/** Restore the feature cache after a definitive V2 note rejection. */
export async function rollbackOfflineV2Note(
  noteId: string,
  operation: string,
  rollbackData?: Record<string, unknown> | null,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTES)) return;
  if (rollbackData) {
    await putRecord(db, DB_CONFIG.STORES.NOTES as STORES, {
      ...rollbackData,
      id: noteId,
      isDirty: false,
      isLoading: false,
      error: null,
    });
  } else if (operation.endsWith(".create")) {
    await deleteRecord(db, DB_CONFIG.STORES.NOTES as STORES, noteId);
  }
}

/** Remap a created note group across the Notes view caches atomically. */
export async function reconcileNoteGroupIds(
  groupIdMap: Record<string, string>,
  serverVersion?: number,
): Promise<void> {
  if (!Object.keys(groupIdMap).length) return;
  const db = await openUnifiedDB();
  const storeNames = [
    DB_CONFIG.STORES.NOTE_GROUPS,
    DB_CONFIG.STORES.NOTES,
  ].filter((name) => db.objectStoreNames.contains(name)) as STORES[];
  if (!storeNames.length) return;

  const tx = db.transaction(storeNames, "readwrite");
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Note group ID reconciliation was aborted"));
  });
  const readAll = <T>(store: IDBObjectStore): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const query = store.getAll();
      query.onsuccess = () => resolve(query.result as T[]);
      query.onerror = () => reject(query.error);
    });
  const groupStore = storeNames.includes(DB_CONFIG.STORES.NOTE_GROUPS as STORES)
    ? tx.objectStore(DB_CONFIG.STORES.NOTE_GROUPS)
    : null;
  const noteStore = storeNames.includes(DB_CONFIG.STORES.NOTES as STORES)
    ? tx.objectStore(DB_CONFIG.STORES.NOTES)
    : null;
  const [groups, notes] = await Promise.all([
    groupStore ? readAll<NoteGroup>(groupStore) : [],
    noteStore ? readAll<StoredNoteState>(noteStore) : [],
  ]);

  for (const [tempId, serverId] of Object.entries(groupIdMap)) {
    const group = groups.find((candidate) => candidate.id === tempId);
    if (group && groupStore) {
      groupStore.delete(tempId);
      groupStore.put(
        sanitizeForIDB({
          ...group,
          id: serverId,
          ...(serverVersion !== undefined && { version: serverVersion }),
        }),
      );
    }
  }
  for (const note of notes) {
    if (note.groupId && groupIdMap[note.groupId] && noteStore) {
      noteStore.put(
        sanitizeForIDB({ ...note, groupId: groupIdMap[note.groupId] }),
      );
    }
  }
  await done;
}

// Compatibility export for the generic V2 runtime while Notes uses the same
// projection helper through its feature-specific sync coordinator.
export const reconcileOfflineV2NoteGroupIds = reconcileNoteGroupIds;

// -------------------- Notes Sync Conflicts --------------------

export async function saveNoteSyncConflict(
  conflict: NoteSyncConflictRecord,
): Promise<void> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS))
    return;
  await putRecord(db, DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS as STORES, conflict);
}

export async function loadNoteSyncConflicts(
  workspaceId?: string,
): Promise<NoteSyncConflictRecord[]> {
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS))
    return [];
  const records = await getAllRecords<NoteSyncConflictRecord>(
    db,
    DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS as STORES,
  );
  return workspaceId
    ? records.filter((record) => record.workspaceId === workspaceId)
    : records;
}

export async function deleteNoteSyncConflicts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openUnifiedDB();
  if (!db.objectStoreNames.contains(DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS))
    return;
  await Promise.all(
    ids.map((id) =>
      deleteRecord(db, DB_CONFIG.STORES.NOTE_SYNC_CONFLICTS as STORES, id),
    ),
  );
}

/**
 * Generic delete operation for any store.
 */
export async function deleteRecord(
  db: IDBDatabase,
  storeName: STORES,
  key: IDBValidKey,
): Promise<void> {
  const { MAX_ATTEMPTS, BASE_DELAY_MS, FACTOR, MAX_DELAY_MS, JITTER_PCT } =
    IDB_RETRY_CONFIG;
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const calcDelay = (attempt: number) => {
    const raw = Math.min(
      BASE_DELAY_MS * Math.pow(FACTOR, attempt),
      MAX_DELAY_MS,
    );
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
          tx = activeDb.transaction([storeName], "readwrite");
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
        tx.onabort = () =>
          reject(tx.error || new Error("IDB transaction aborted"));
      });
      return; // success
    } catch (err: any) {
      lastErr = err;
      const transient =
        err &&
        (err.name === "InvalidStateError" ||
          err.name === "TransactionInactiveError");
      if (!transient) break;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(calcDelay(attempt));
        continue;
      }
    }
  }
  throw lastErr;
}
