import type { Ref } from "vue";
import type { NoteState } from "./noteTransforms";

export interface NotesMemoryStore {
  upsert(note: NoteState): void;
  replace(notes: NoteState[]): void;
  remove(id: string): void;
  get(id: string): NoteState | null;
  values(): NoteState[];
}

export function createNotesMemoryStore(notes: Ref<Map<string, NoteState>>): NotesMemoryStore {
  return {
    upsert(note) {
      notes.value.set(note.id, note);
    },
    replace(nextNotes) {
      notes.value.clear();
      nextNotes.forEach((note) => notes.value.set(note.id, note));
    },
    remove(id) {
      notes.value.delete(id);
    },
    get(id) {
      return notes.value.get(id) ?? null;
    },
    values() {
      return Array.from(notes.value.values());
    },
  };
}
