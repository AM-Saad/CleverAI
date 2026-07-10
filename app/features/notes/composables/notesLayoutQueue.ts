import type { NoteLayoutChange } from "@@/shared/utils/note-sync.contract";
import type { LayoutQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteLayoutChange,
  loadPendingNoteLayoutChange,
  queueNoteLayoutChange,
} from "~/utils/idb";
import { SYNC_TAGS } from "~/utils/constants/pwa";
import { getServiceWorkerReadyRegistration } from "~/utils/serviceWorkerRuntime";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export type NotesLayoutQueue = LayoutQueue<NoteLayoutChange>;

async function registerOfflineV2Sync() {
  const registration = await getServiceWorkerReadyRegistration(1500);
  if (registration && "sync" in registration) {
    // @ts-expect-error SyncManager is absent from some DOM lib versions.
    await registration.sync.register(SYNC_TAGS.OFFLINE_V2);
  }
}

export function createIndexedDbNotesLayoutQueue(): NotesLayoutQueue {
  return {
    save: async (change) => {
      await queueNoteLayoutChange(change);
      if (typeof useAuth === "function") {
        const offline = useOfflineRuntime();
        if (offline.accountId.value) await offline.migrateLegacyNotes();
      }
    },
    load: loadPendingNoteLayoutChange,
    remove: deletePendingNoteLayoutChange,
    registerBackgroundSync: registerOfflineV2Sync,
  };
}
