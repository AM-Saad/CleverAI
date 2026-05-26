import type { NoteType } from "../../../../shared/utils/note.contract";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesLayoutController } from "./notesLayoutController";
import type { NotesMemoryStore } from "./notesMemoryStore";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { createNotesTempId } from "./tempIds";
import {
  normalizeCreateContent,
  normalizeLocalNote,
  type NoteState,
} from "./noteTransforms";

export interface NotesCommandService {
  createNote(input: {
    workspaceId: string;
    content: string;
    tags?: string[];
    noteType?: NoteType;
    metadata?: Record<string, unknown>;
    title?: string;
    groupId?: string | null;
  }): Promise<string>;
  updateNoteContent(input: {
    id: string;
    note: NoteState;
    queueContentSave: (id: string, content: string, title?: string) => void;
  }): Promise<boolean>;
  deleteNote(input: {
    id: string;
    note: NoteState;
  }): Promise<boolean>;
}

export function createNotesCommandService(input: {
  memoryStore: NotesMemoryStore;
  localRepository: NotesLocalRepository;
  pendingQueue: NotesPendingQueue;
  layoutController: NotesLayoutController;
  registerBackgroundSync: () => Promise<void>;
  requestSync: () => void;
}): NotesCommandService {
  const {
    memoryStore,
    localRepository,
    pendingQueue,
    layoutController,
    registerBackgroundSync,
    requestSync,
  } = input;

  const runBackground = (work: () => Promise<void>) => {
    void work().catch((error) => {
      console.error("[NotesCommandService] Background command failed", error);
    });
  };

  const createNote: NotesCommandService["createNote"] = async ({
    workspaceId,
    content,
    tags = [],
    noteType = "TEXT",
    metadata,
    title,
    groupId,
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
    runBackground(async () => {
      try {
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
        });
        await registerBackgroundSync();
        await layoutController.queueNoteLayout(
          memoryStore.values().map((note) => ({
            id: note.id,
            groupId: note.groupId ?? null,
            order: note.order,
          })),
        );
        requestSync();
      } catch (error) {
        memoryStore.upsert({
          ...optimisticNote,
          error:
            "This note is visible in memory, but could not be saved locally. Keep this page open and retry.",
        });
        throw error;
      }
    });
    return tempId;
  };

  const updateNoteContent: NotesCommandService["updateNoteContent"] = async ({
    id,
    note,
    queueContentSave,
  }) => {
    const nextNote = normalizeLocalNote({
      ...note,
      updatedAt: new Date(),
      isDirty: true,
    });
    memoryStore.upsert(nextNote);
    runBackground(async () => {
      try {
        await localRepository.save(nextNote);
        const currentNote = memoryStore.get(id);
        if (
          !currentNote ||
          currentNote.content !== nextNote.content ||
          currentNote.title !== nextNote.title
        ) {
          return;
        }
        queueContentSave(id, nextNote.content, nextNote.title);
      } catch (error) {
        memoryStore.upsert({
          ...nextNote,
          error:
            "This edit is visible in memory, but could not be saved locally. Keep this page open and retry.",
        });
        throw error;
      }
    });
    return true;
  };

  const deleteNote: NotesCommandService["deleteNote"] = async ({ id, note }) => {
    memoryStore.remove(id);
    runBackground(async () => {
      try {
        await localRepository.delete(id);
        await pendingQueue.add({
          id,
          operation: "delete",
          updatedAt: Date.now(),
          localVersion: 1,
          serverVersion: note.version,
          workspaceId: note.workspaceId,
        });
        await registerBackgroundSync();
        requestSync();
      } catch (error) {
        memoryStore.upsert({
          ...note,
          error:
            "Delete is visible in memory, but could not be saved locally. Retry before closing this page.",
        });
        throw error;
      }
    });
    return true;
  };

  return {
    createNote,
    updateNoteContent,
    deleteNote,
  };
}
