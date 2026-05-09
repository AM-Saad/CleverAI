import type { NoteState } from "./noteTransforms";
import {
  deleteNoteFromIndexedDB,
  loadNotesFromIndexedDB,
  saveNoteToIndexedDB,
  saveNotesToIndexedDB,
} from "~/utils/idb";

export interface NotesLocalRepository {
  save(note: NoteState): Promise<void>;
  saveMany(notes: NoteState[]): Promise<void>;
  loadByWorkspace(workspaceId: string): Promise<NoteState[]>;
  delete(id: string): Promise<void>;
}

export function createIndexedDbNotesLocalRepository(): NotesLocalRepository {
  return {
    save: saveNoteToIndexedDB,
    saveMany: saveNotesToIndexedDB,
    loadByWorkspace: loadNotesFromIndexedDB as (workspaceId: string) => Promise<NoteState[]>,
    delete: deleteNoteFromIndexedDB,
  };
}
