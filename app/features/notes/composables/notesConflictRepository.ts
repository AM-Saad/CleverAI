import type { NoteSyncConflictRecord } from "~/utils/idb";
import type { ConflictRepository } from "../../../utils/local-first/ports";
import {
  deleteNoteSyncConflicts,
  loadNoteSyncConflicts,
  saveNoteSyncConflict,
} from "~/utils/idb";

export type NotesConflictRepository = ConflictRepository<NoteSyncConflictRecord>;

export function createIndexedDbNotesConflictRepository(): NotesConflictRepository {
  return {
    save: saveNoteSyncConflict,
    load: loadNoteSyncConflicts,
    remove: deleteNoteSyncConflicts,
  };
}
