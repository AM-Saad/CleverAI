import type { NoteState } from "./noteTransforms";
import type { LocalRepository } from "../../../utils/local-first/ports";
import {
  deleteNoteFromIndexedDB,
  loadNotesFromIndexedDB,
  saveNoteToIndexedDB,
  saveNotesToIndexedDB,
} from "~/utils/idb";

export type NotesLocalRepository = LocalRepository<NoteState>;

export function createIndexedDbNotesLocalRepository(): NotesLocalRepository {
  return {
    save: saveNoteToIndexedDB,
    saveMany: saveNotesToIndexedDB,
    loadByWorkspace: loadNotesFromIndexedDB as (workspaceId: string) => Promise<NoteState[]>,
    delete: deleteNoteFromIndexedDB,
  };
}
