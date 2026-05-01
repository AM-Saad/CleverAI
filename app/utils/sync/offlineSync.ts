/**
 * Shared offline sync utilities for notes and board items stores.
 *
 * Extracts the identical plumbing both stores previously duplicated:
 *  - per-store offline toast deduplication state
 *  - Background Sync tag registration
 *  - once-per-app online listener that fires a SW postMessage when pending
 *    records are found in IndexedDB
 *  - once-per-app SW message listener that refreshes the store after a
 *    successful sync
 *
 * UPDATED: Supports strict sequential ordering for reconnect:
 *   1. onBeforeSync (flush debounce → await IDB write)
 *   2. Check IDB for pending records
 *   3. Trigger SW sync
 */

import { DB_CONFIG, SYNC_TAGS } from "~/utils/constants/pwa";
import { openUnifiedDB, getAllRecords } from "~/utils/idb";

// ─────────────────────────────────────────────────────────────────────────────
// Per-store toast deduplication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a simple flag for suppressing duplicate "Offline" toasts within a
 * single offline session. Call `reset()` when the app comes back online.
 */
export function createOfflineToastState() {
  let shown = false;
  return {
    isShown: () => shown,
    mark: () => { shown = true; },
    reset: () => { shown = false; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Sync registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers a Background Sync tag via the Service Worker registration.
 * Safe to call multiple times — the browser deduplicates registrations.
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      // @ts-expect-error Background Sync API is not in all TS DOM libs
      await reg.sync.register(tag);
    }
  } catch {
    /* Not supported or permission denied – degrade gracefully */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Online listener
// ─────────────────────────────────────────────────────────────────────────────

export interface OnlineListenerOptions {
  /** IDB store to poll for pending records, e.g. DB_CONFIG.STORES.PENDING_NOTES */
  pendingStoreName: string;
  /** SW message type string to post when pending records are found */
  swMessageType: string;
  /** Called for every registered store instance when the app comes online so
   *  each store can reset its offline-toast flag. */
  onOnline?: () => void;
  /**
   * Called BEFORE checking IDB and triggering sync.
   * Stores should use this to flush their debounce timers and await
   * the resulting IDB write. The listener awaits this promise before
   * proceeding to IDB check + SW sync.
   *
   * Strict ordering: onBeforeSync() → await → IDB check → SW postMessage
   */
  onBeforeSync?: () => Promise<void> | void;
}

/**
 * Registers a single `window.online` listener for a given pending-store /
 * SW-message pair.  Guards against duplicate registration via a module-scoped
 * Set so it is safe to call from every store instance creation.
 *
 * Returns a cleanup function (useful in tests).
 */
const registeredOnlineListeners = new Set<string>();

export function setupOnlineListener(options: OnlineListenerOptions): () => void {
  if (!process.client) return () => {};

  const key = `${options.pendingStoreName}:${options.swMessageType}`;
  if (registeredOnlineListeners.has(key)) {
    // Already registered; still wire up the per-store onOnline callback via a
    // lightweight additional listener (cheap, no IDB poll).
    if (options.onOnline) {
      const cb = options.onOnline;
      window.addEventListener("online", cb);
      return () => window.removeEventListener("online", cb);
    }
    return () => {};
  }

  registeredOnlineListeners.add(key);

  let syncScheduled = false;

  const handler = async () => {
    options.onOnline?.();

    if (syncScheduled) return;
    syncScheduled = true;

    try {
      // Step 1: Flush debounce — await the IDB write before checking pending
      if (options.onBeforeSync) {
        try {
          await options.onBeforeSync();
        } catch (e) {
          console.warn('[OfflineSync] onBeforeSync failed:', e);
          // Continue anyway — best effort. The pending entry may or may not
          // be in IDB yet, but we should still try to sync existing ones.
        }
      }

      // Step 2: Check IDB for pending records
      const db = await openUnifiedDB();
      if (!db.objectStoreNames.contains(options.pendingStoreName)) return;

      const pending = await getAllRecords<{ id: string }>(
        db,
        options.pendingStoreName as typeof DB_CONFIG.STORES[keyof typeof DB_CONFIG.STORES]
      );
      if (!pending.length) return;

      // Step 3: Trigger SW sync
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: options.swMessageType,
        });
      }
    } catch {
      /* ignore – best effort */
    } finally {
      syncScheduled = false;
    }
  };

  window.addEventListener("online", handler);
  return () => {
    window.removeEventListener("online", handler);
    registeredOnlineListeners.delete(key);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SW message listener for sync completion
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncCompletionListenerOptions {
  /** SW message type that signals a successful sync, e.g. "NOTES_SYNCED" */
  messageType: string;
  /** Called when the sync message arrives with appliedCount > 0 */
  onSynced: (appliedCount: number) => void | Promise<void>;
}

const registeredSyncCompletionListeners = new Set<string>();

/**
 * Wires up a SW → window message listener that calls `onSynced` when the given
 * message type arrives with `appliedCount > 0`.  Deduplicates registrations by
 * messageType so multiple store instances don't re-register the same handler.
 */
export function setupSyncCompletionListener(
  options: SyncCompletionListenerOptions
): () => void {
  if (!process.client || !("serviceWorker" in navigator)) return () => {};

  if (registeredSyncCompletionListeners.has(options.messageType)) return () => {};
  registeredSyncCompletionListeners.add(options.messageType);

  const handler = async (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || msg.type !== options.messageType) return;
    const applied: number = msg.data?.appliedCount ?? 0;
    if (applied > 0) {
      await options.onSynced(applied);
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
    registeredSyncCompletionListeners.delete(options.messageType);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience wrappers keyed to domain
// ─────────────────────────────────────────────────────────────────────────────

/** Register notes Background Sync tag. */
export const registerNotesSync = () =>
  registerBackgroundSync(SYNC_TAGS.NOTES);

/** Register board items Background Sync tag. */
export const registerBoardItemsSync = () =>
  registerBackgroundSync(SYNC_TAGS.BOARD_ITEMS);
