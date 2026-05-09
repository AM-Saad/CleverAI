import type { PendingNoteChange } from "@@/shared/utils/note-sync.contract";
import {
  deletePendingNoteChanges,
  loadPendingNoteChanges,
  queueNoteChange,
} from "~/utils/idb";
import { registerNotesSync } from "~/utils/sync/offlineSync";

export interface NotesPendingQueue {
  add(change: PendingNoteChange): Promise<void>;
  load(workspaceId?: string): Promise<PendingNoteChange[]>;
  remove(ids: string[]): Promise<void>;
  registerBackgroundSync(): Promise<void>;
}

export function createIndexedDbNotesPendingQueue(): NotesPendingQueue {
  return {
    add: queueNoteChange,
    load: loadPendingNoteChanges,
    remove: deletePendingNoteChanges,
    registerBackgroundSync: registerNotesSync,
  };
}
