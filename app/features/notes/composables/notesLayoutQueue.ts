import type { NoteLayoutChange } from "@@/shared/utils/note-sync.contract";
import {
  deletePendingNoteLayoutChange,
  loadPendingNoteLayoutChange,
  queueNoteLayoutChange,
} from "~/utils/idb";
import { registerNotesSync } from "~/utils/sync/offlineSync";

export interface NotesLayoutQueue {
  save(change: NoteLayoutChange): Promise<void>;
  load(workspaceId: string): Promise<NoteLayoutChange | null>;
  remove(workspaceId: string): Promise<void>;
  registerBackgroundSync(): Promise<void>;
}

export function createIndexedDbNotesLayoutQueue(): NotesLayoutQueue {
  return {
    save: queueNoteLayoutChange,
    load: loadPendingNoteLayoutChange,
    remove: deletePendingNoteLayoutChange,
    registerBackgroundSync: registerNotesSync,
  };
}
