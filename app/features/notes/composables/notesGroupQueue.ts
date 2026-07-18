import type { PendingNoteGroupChange } from "@@/shared/utils/note-sync.contract";
import type { PendingQueue } from "../../../utils/local-first/ports";
import {
  deletePendingNoteGroupChanges,
  loadPendingNoteGroupChanges,
  queueNoteGroupChange,
} from "~/utils/idb";
import { registerNotesBackgroundSync } from "./notesBackgroundSync";

export type NotesGroupQueue = PendingQueue<PendingNoteGroupChange>;

export function createIndexedDbNotesGroupQueue(): NotesGroupQueue {
  return {
    add: queueNoteGroupChange,
    load: loadPendingNoteGroupChanges,
    remove: deletePendingNoteGroupChanges,
    registerBackgroundSync: registerNotesBackgroundSync,
  };
}
