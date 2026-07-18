import type { NoteType } from "../../../../shared/utils/note.contract";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesMemoryStore } from "./notesMemoryStore";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { createNotesTempId } from "./tempIds";
import {
  normalizeCreateContent,
  normalizeLocalNote,
  type NoteState,
} from "./noteTransforms";
import { withNotesWorkspaceMutationLock } from "./notesWorkspaceMutationLock";
import { logNotesOperation } from "./notesOperationLog";

export interface NotesCommandService {
  createNote(input: {
    workspaceId: string;
    content: string;
    tags?: string[];
    noteType?: NoteType;
    metadata?: Record<string, unknown>;
    title?: string;
    groupId?: string | null;
    deferSync?: boolean;
  }): Promise<string | null>;
  updateNoteContent(input: {
    id: string;
    note: NoteState;
    queueContentSave: (
      id: string,
      content: string,
      title?: string,
    ) => Promise<boolean>;
  }): Promise<boolean>;
  deleteNote(input: { id: string; note: NoteState }): Promise<boolean>;
}

export function createNotesCommandService(input: {
  memoryStore: NotesMemoryStore;
  localRepository: NotesLocalRepository;
  pendingQueue: NotesPendingQueue;
  registerBackgroundSync: () => Promise<void>;
  requestSync: () => void;
  resolveNoteId?: (id: string) => string;
}): NotesCommandService {
  const {
    memoryStore,
    localRepository,
    pendingQueue,
    registerBackgroundSync,
    requestSync,
    resolveNoteId = (id) => id,
  } = input;

  const createNote: NotesCommandService["createNote"] = async ({
    workspaceId,
    content,
    tags = [],
    noteType = "TEXT",
    metadata,
    title,
    groupId,
    deferSync = false,
  }) => {
    const tempId = createNotesTempId("temp");
    const resolvedContent = normalizeCreateContent(content, noteType);
    const resolvedTitle = normalizeWorkspaceNoteTitle(title, resolvedContent);
    const resolvedGroupId = groupId ?? null;
    const nextOrder = memoryStore
      .values()
      .filter((note) => (note.groupId ?? null) === resolvedGroupId).length;

    const optimisticNote = normalizeLocalNote({
      id: tempId,
      workspaceId,
      groupId: resolvedGroupId,
      title: resolvedTitle,
      content: resolvedContent,
      tags,
      order: nextOrder,
      noteType,
      metadata,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: false,
      isDirty: true,
      error: null,
    });

    memoryStore.upsert(optimisticNote);
    try {
      await withNotesWorkspaceMutationLock(workspaceId, async () => {
        await localRepository.save(optimisticNote);
        const currentNote = memoryStore.get(tempId) ?? optimisticNote;
        await pendingQueue.add({
          id: tempId,
          operation: "upsert",
          updatedAt: Date.now(),
          localVersion: 1,
          workspaceId,
          groupId: currentNote.groupId ?? null,
          title: currentNote.title,
          content: currentNote.content,
          tags: currentNote.tags,
          noteType: currentNote.noteType,
          metadata: currentNote.metadata,
          order: currentNote.order,
        });
        await registerBackgroundSync();
      });
      logNotesOperation("create-queued", { workspaceId, tempId, deferSync });
      if (!deferSync) requestSync();
    } catch (error) {
      memoryStore.remove(tempId);
      console.error(
        "[NotesCommandService] Failed to persist created note",
        error,
      );
      return null;
    }
    return tempId;
  };

  const updateNoteContent: NotesCommandService["updateNoteContent"] = async ({
    id,
    note,
    queueContentSave,
  }) => {
    const initialId = resolveNoteId(id);
    const nextNote = normalizeLocalNote({
      ...note,
      id: initialId,
      updatedAt: new Date(),
      isDirty: true,
    });
    if (initialId !== id) memoryStore.remove(id);
    memoryStore.upsert(nextNote);
    try {
      return await withNotesWorkspaceMutationLock(
        nextNote.workspaceId,
        async () => {
          // The create acknowledgement may have won the lock before this
          // debounced edit. Resolve again inside the lock so no temp-id write
          // can land after the acknowledgement.
          const durableId = resolveNoteId(id);
          const durableNote = normalizeLocalNote({
            ...nextNote,
            id: durableId,
          });
          if (durableId !== id) {
            memoryStore.remove(id);
            memoryStore.upsert(durableNote);
          }
          await localRepository.save(durableNote);
          if (durableId !== id) await localRepository.delete(id);
          const currentNote = memoryStore.get(durableId);
          if (
            !currentNote ||
            currentNote.content !== durableNote.content ||
            currentNote.title !== durableNote.title
          ) {
            // A newer editor revision owns the next durable commit.
            return true;
          }
          return await queueContentSave(
            durableId,
            durableNote.content,
            durableNote.title,
          );
        },
      );
    } catch (error) {
      memoryStore.upsert({
        ...nextNote,
        error:
          "This edit is visible in memory, but could not be saved locally. Keep this page open and retry.",
      });
      console.error("[NotesCommandService] Failed to persist note edit", error);
      return false;
    }
  };

  const deleteNote: NotesCommandService["deleteNote"] = async ({
    id,
    note,
  }) => {
    const initialId = resolveNoteId(id);
    memoryStore.remove(id);
    memoryStore.remove(initialId);
    try {
      await withNotesWorkspaceMutationLock(note.workspaceId, async () => {
        const durableId = resolveNoteId(id);
        await pendingQueue.add({
          id: durableId,
          operation: "delete",
          updatedAt: Date.now(),
          localVersion: 1,
          serverVersion: note.version,
          workspaceId: note.workspaceId,
          rollbackData: {
            ...note,
            id: durableId,
          } as unknown as Record<string, unknown>,
        });
        // A never-synced temp create followed by delete has no canonical server
        // row to retain. Server-backed notes stay in IndexedDB until ack.
        if (/^(temp-|local:)/.test(durableId)) {
          await localRepository.delete(durableId);
        }
        if (durableId !== id && /^(temp-|local:)/.test(id)) {
          await localRepository.delete(id);
        }
        await registerBackgroundSync();
      });
      requestSync();
      return true;
    } catch (error) {
      memoryStore.upsert({
        ...note,
        id: initialId,
        error:
          "Delete is visible in memory, but could not be saved locally. Retry before closing this page.",
      });
      console.error(
        "[NotesCommandService] Failed to persist delete tombstone",
        error,
      );
      return false;
    }
  };

  return {
    createNote,
    updateNoteContent,
    deleteNote,
  };
}
