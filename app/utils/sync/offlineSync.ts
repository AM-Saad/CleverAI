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
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { openUnifiedDB, getAllRecords } from "~/utils/idb";
import {
  canUseServiceWorker,
  getServiceWorkerReadyRegistration,
} from "~/utils/serviceWorkerRuntime";

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
  if (!canUseServiceWorker()) return;
  try {
    const reg = await getServiceWorkerReadyRegistration(2000);
    if (reg && "sync" in reg) {
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
  /** Optional additional stores to poll as one logical sync queue. */
  pendingStoreNames?: string[];
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
  /**
   * When provided, the listener calls this function directly instead of
   * routing through the Service Worker via postMessage. This makes the
   * client the primary sync owner, eliminating the dual-sync race
   * condition where both the client and SW read the same IDB queues and
   * POST to the same server endpoint.
   */
  onSyncDirect?: () => Promise<void> | void;
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

  const registerConnectivityListener = (cb: () => void | Promise<void>) => {
    window.addEventListener("online", cb);
    const cleanupVerifiedOnline = (() => {
      try {
        const networkMonitor = useNetworkStatus();
        return networkMonitor.onOnline(cb);
      } catch {
        return null;
      }
    })();

    return () => {
      window.removeEventListener("online", cb);
      cleanupVerifiedOnline?.();
    };
  };

  const pendingStoreNames = options.pendingStoreNames?.length
    ? options.pendingStoreNames
    : [options.pendingStoreName];
  const key = `${pendingStoreNames.join("+")}:${options.swMessageType}`;
  if (registeredOnlineListeners.has(key)) {
    // Already registered; still wire up the per-store onOnline callback via a
    // lightweight additional listener (cheap, no IDB poll).
    if (options.onOnline) {
      return registerConnectivityListener(options.onOnline);
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

      // Step 2: Check IDB for pending records across this logical queue.
      const db = await openUnifiedDB();
      let pendingCount = 0;
      for (const storeName of pendingStoreNames) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        const pending = await getAllRecords<{ id: string }>(
          db,
          storeName as typeof DB_CONFIG.STORES[keyof typeof DB_CONFIG.STORES]
        );
        pendingCount += pending.length;
      }
      if (!pendingCount && !options.onSyncDirect) return;

      // Step 3: Trigger sync — prefer direct client-side sync to avoid
      // dual-sync race with SW. Fall back to SW postMessage only if no
      // direct handler is provided.
      if (options.onSyncDirect) {
        try {
          await options.onSyncDirect();
        } catch (e) {
          console.warn('[OfflineSync] onSyncDirect failed:', e);
        }
      } else if (canUseServiceWorker() && navigator.serviceWorker.controller) {
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

  const cleanupConnectivityListener = registerConnectivityListener(handler);
  return () => {
    cleanupConnectivityListener();
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
  if (!process.client || !canUseServiceWorker()) return () => {};

  if (registeredSyncCompletionListeners.has(options.messageType)) return () => {};
  registeredSyncCompletionListeners.add(options.messageType);

  const handler = async (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || msg.type !== options.messageType) return;
    const applied: number = msg.data?.appliedCount ?? 0;
    const conflicts: number = msg.data?.conflictsCount ?? 0;
    const layouts: number = msg.data?.layoutApplied ?? 0;
    const layoutConflict: boolean = Boolean(msg.data?.layoutConflict);
    if (applied > 0 || conflicts > 0 || layouts > 0 || layoutConflict) {
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
  registerBackgroundSync(SYNC_TAGS.OFFLINE_V2);

/** Register board items Background Sync tag. */
export const registerBoardItemsSync = () =>
  registerBackgroundSync(SYNC_TAGS.OFFLINE_V2);
