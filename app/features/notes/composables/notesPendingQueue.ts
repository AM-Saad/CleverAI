import type { PendingNoteChange } from "@@/shared/utils/note-sync.contract";
import type { PendingQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteChanges,
  loadPendingNoteChanges,
  queueNoteChange,
} from "~/utils/idb";
import { registerNotesSync } from "~/utils/sync/offlineSync";

export type NotesPendingQueue = PendingQueue<PendingNoteChange>;

export function createIndexedDbNotesPendingQueue(): NotesPendingQueue {
  return {
    add: queueNoteChange,
    load: loadPendingNoteChanges,
    remove: deletePendingNoteChanges,
    registerBackgroundSync: registerNotesSync,
  };
}
