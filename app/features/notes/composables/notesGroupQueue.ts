import type { PendingNoteGroupChange } from "@@/shared/utils/note-sync.contract";
import type { PendingQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteGroupChanges,
  loadPendingNoteGroupChanges,
  queueNoteGroupChange,
} from "~/utils/idb";
import { SYNC_TAGS } from "~/utils/constants/pwa";
import { getServiceWorkerReadyRegistration } from "~/utils/serviceWorkerRuntime";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export type NotesGroupQueue = PendingQueue<PendingNoteGroupChange>;

async function registerOfflineV2Sync() {
  const registration = await getServiceWorkerReadyRegistration(1500);
  if (registration && "sync" in registration) {
    // @ts-expect-error SyncManager is absent from some DOM lib versions.
    await registration.sync.register(SYNC_TAGS.OFFLINE_V2);
  }
}

export function createIndexedDbNotesGroupQueue(): NotesGroupQueue {
  return {
    add: async (change) => {
      await queueNoteGroupChange(change);
      if (typeof useAuth === "function") {
        const offline = useOfflineRuntime();
        if (offline.accountId.value) await offline.migrateLegacyNotes();
      }
    },
    load: loadPendingNoteGroupChanges,
    remove: deletePendingNoteGroupChanges,
    registerBackgroundSync: registerOfflineV2Sync,
  };
}
