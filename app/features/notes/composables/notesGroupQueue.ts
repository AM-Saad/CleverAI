import type { PendingNoteGroupChange } from "@@/shared/utils/note-sync.contract";
import {
  deletePendingNoteGroupChanges,
  loadPendingNoteGroupChanges,
  queueNoteGroupChange,
} from "~/utils/idb";
import { registerNotesSync } from "~/utils/sync/offlineSync";

export interface NotesGroupQueue {
  add(change: PendingNoteGroupChange): Promise<void>;
  load(workspaceId?: string): Promise<PendingNoteGroupChange[]>;
  remove(ids: string[]): Promise<void>;
  registerBackgroundSync(): Promise<void>;
}

export function createIndexedDbNotesGroupQueue(): NotesGroupQueue {
  return {
    add: queueNoteGroupChange,
    load: loadPendingNoteGroupChanges,
    remove: deletePendingNoteGroupChanges,
    registerBackgroundSync: registerNotesSync,
  };
}
