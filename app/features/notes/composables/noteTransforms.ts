import type { Note, NoteType } from "../../../../shared/utils/note.contract";
import type { PendingNoteChange } from "../../../../shared/utils/note-sync.contract";
import {
  normalizeWorkspaceNoteContent,
  normalizeWorkspaceNoteTitle,
} from "../../../../shared/utils/workspaceNote";

export interface NoteState extends Note {
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
  isInFilteredList?: boolean;
  localVersion?: number;
  /** Monotonic server version for optimistic concurrency — incremented on every server write */
  version: number;
}

const NOTE_TYPES = new Set<NoteType>(["TEXT", "MATH", "CANVAS"]);

export const toNoteType = (value: string | undefined): NoteType =>
  NOTE_TYPES.has(value as NoteType) ? (value as NoteType) : "TEXT";

export const normalizeLocalNote = <
  T extends { content: string; title?: string | null; version?: number },
>(
  note: T,
): T & { title: string; version: number } => ({
  ...note,
  title: normalizeWorkspaceNoteTitle(note.title, note.content),
  version: note.version ?? 1,
});

export const normalizeCreateContent = (
  content: string,
  noteType: NoteType,
): string => (noteType === "TEXT" ? normalizeWorkspaceNoteContent(content) : content);

export function noteStateFromServer(note: Note): NoteState {
  return {
    ...normalizeLocalNote(note),
    version: note.version ?? 1,
    isLoading: false,
    isDirty: false,
    lastSaved: new Date(),
    error: null,
  };
}

export function noteStateFromPendingChange(
  change: PendingNoteChange,
  order: number,
): NoteState {
  return {
    id: change.id,
    workspaceId: change.workspaceId!,
    groupId: change.groupId ?? null,
    title: normalizeWorkspaceNoteTitle(change.title, change.content),
    content: change.content || "",
    tags: change.tags || [],
    order,
    noteType: toNoteType(change.noteType),
    metadata: change.metadata,
    version: change.serverVersion ?? 1,
    createdAt: new Date(change.updatedAt),
    updatedAt: new Date(change.updatedAt),
    isDirty: true,
    isLoading: false,
    error: null,
  };
}
