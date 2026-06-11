import { DB_CONFIG, SW_MESSAGE_TYPES } from "~/utils/constants/pwa";
import {
  setupOnlineListener,
  setupSyncCompletionListener,
} from "~/utils/sync/offlineSync";

export interface NotesSyncListenerStore {
  flushDrafts(): Promise<void>;
  syncPendingChanges(): Promise<boolean>;
  hydrateLocalNotes(): Promise<void>;
}

let listenersRegistered = false;
let activeWorkspaceId: string | null = null;
let syncRefreshing = false;

export function setActiveNotesWorkspace(workspaceId: string): void {
  activeWorkspaceId = workspaceId;
}

export function registerNotesSyncListenersOnce(
  stores: ReadonlyMap<string, NotesSyncListenerStore>,
): void {
  if (!process.client || listenersRegistered) return;

  setupOnlineListener({
    pendingStoreName: DB_CONFIG.STORES.PENDING_NOTES,
    pendingStoreNames: [
      DB_CONFIG.STORES.PENDING_NOTES,
      DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES,
      DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS,
    ],
    swMessageType: SW_MESSAGE_TYPES.SYNC_NOTES,
    onOnline: () => {
      // LocalSyncStatus and the global nav own user-visible online/offline state.
    },
    onBeforeSync: async () => {
      await Promise.all(Array.from(stores.values()).map((store) => store.flushDrafts()));
    },
    onSyncDirect: async () => {
      const activeStore = activeWorkspaceId ? stores.get(activeWorkspaceId) : null;
      const orderedStores = [
        ...(activeStore ? [activeStore] : []),
        ...Array.from(stores.entries())
          .filter(([workspaceId]) => workspaceId !== activeWorkspaceId)
          .map(([, store]) => store),
      ];
      await Promise.all(orderedStores.map((store) => store.syncPendingChanges()));
    },
  });

  setupSyncCompletionListener({
    messageType: SW_MESSAGE_TYPES.NOTES_SYNCED,
    onSynced: async () => {
      if (syncRefreshing) return;
      syncRefreshing = true;
      try {
        await Promise.all(
          Array.from(stores.values()).map((store) => store.hydrateLocalNotes()),
        );
      } finally {
        syncRefreshing = false;
      }
    },
  });

  listenersRegistered = true;
}
