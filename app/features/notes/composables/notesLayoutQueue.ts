import type { NoteLayoutChange } from "@@/shared/utils/note-sync.contract";
import type { LayoutQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteLayoutChange,
  loadPendingNoteLayoutChange,
  queueNoteLayoutChange,
} from "~/utils/idb";
import { registerNotesSync } from "~/utils/sync/offlineSync";

export type NotesLayoutQueue = LayoutQueue<NoteLayoutChange>;

export function createIndexedDbNotesLayoutQueue(): NotesLayoutQueue {
  return {
    save: queueNoteLayoutChange,
    load: loadPendingNoteLayoutChange,
    remove: deletePendingNoteLayoutChange,
    registerBackgroundSync: registerNotesSync,
  };
}
