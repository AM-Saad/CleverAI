import type { PendingNoteChange } from "@@/shared/utils/note-sync.contract";
import type { PendingQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteChanges,
  loadPendingNoteChanges,
  queueNoteChange,
} from "~/utils/idb";
import { SYNC_TAGS } from "~/utils/constants/pwa";
import { getServiceWorkerReadyRegistration } from "~/utils/serviceWorkerRuntime";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export type NotesPendingQueue = PendingQueue<PendingNoteChange>;

async function registerOfflineV2Sync() {
  const registration = await getServiceWorkerReadyRegistration(1500);
  if (registration && "sync" in registration) {
    // @ts-expect-error SyncManager is absent from some DOM lib versions.
    await registration.sync.register(SYNC_TAGS.OFFLINE_V2);
  }
}

export function createIndexedDbNotesPendingQueue(): NotesPendingQueue {
  return {
    add: async (change) => {
      await queueNoteChange(change);
      // Legacy storage is a crash-safe intake buffer only. Move every write
      // into the account-scoped outbox immediately so reconnect does not rely
      // on the old Notes-specific sync protocol.
      if (typeof useAuth === "function") {
        const offline = useOfflineRuntime();
        if (offline.accountId.value) await offline.migrateLegacyNotes();
      }
    },
    load: loadPendingNoteChanges,
    remove: deletePendingNoteChanges,
    registerBackgroundSync: registerOfflineV2Sync,
  };
}
