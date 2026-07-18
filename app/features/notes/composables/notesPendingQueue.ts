import type { PendingNoteChange } from "@@/shared/utils/note-sync.contract";
import type { PendingQueue } from "../../../utils/local-first/ports";
import {
  acknowledgePendingNoteChange,
  deletePendingNoteChanges,
  loadPendingNoteChanges,
  queueNoteChange,
  type StoredNoteState,
} from "~/utils/idb";
import { registerNotesBackgroundSync } from "./notesBackgroundSync";

export type NotesPendingQueue = PendingQueue<PendingNoteChange>;

export type NotesPendingAcknowledgement = {
  remapToId?: string;
  serverVersion?: number;
  keepCurrent?: boolean;
  localMutation?:
    | { type: "delete"; id?: string }
    | { type: "remap"; fromId: string; note: StoredNoteState }
    | {
        type: "advance";
        id: string;
        serverVersion?: number;
        updatedAt?: string;
      };
};

export type RevisionAwareNotesPendingQueue = NotesPendingQueue & {
  acknowledge?: (
    sent: PendingNoteChange,
    acknowledgement?: NotesPendingAcknowledgement,
  ) => Promise<PendingNoteChange | null>;
};

/** Notes has one feature-owned, durable outbox. */
export function createIndexedDbNotesPendingQueue(): RevisionAwareNotesPendingQueue {
  return {
    add: queueNoteChange,
    load: loadPendingNoteChanges,
    remove: deletePendingNoteChanges,
    acknowledge: acknowledgePendingNoteChange,
    registerBackgroundSync: registerNotesBackgroundSync,
  };
}
