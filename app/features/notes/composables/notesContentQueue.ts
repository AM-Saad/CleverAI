import type { Ref } from "vue";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { logNotesOperation } from "./notesOperationLog";
import { flushRegisteredNotesDrafts } from "./notesEditorRuntimeState";
import type { NoteState } from "./noteTransforms";

type PendingSave = {
  content: string;
  title?: string;
  timer: ReturnType<typeof setTimeout> | null;
};

export interface NotesContentQueue {
  queueContentSave(id: string, content: string, title?: string): void;
  queueContentSaveNow(
    id: string,
    content: string,
    title?: string,
  ): Promise<boolean>;
  flushDrafts(): Promise<void>;
}

export function createNotesContentQueue(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  pendingQueue: NotesPendingQueue;
  isVerifiedOnline: Ref<boolean>;
  requestSync: () => void;
  debounceMs?: number;
  flushEditorDrafts?: () => Promise<void>;
}): NotesContentQueue {
  const {
    workspaceId,
    notes,
    pendingQueue,
    isVerifiedOnline,
    requestSync,
    debounceMs = 1000,
    flushEditorDrafts = flushRegisteredNotesDrafts,
  } = input;
  const pendingSaves = new Map<string, PendingSave>();

  const patchNote = (id: string, patch: Partial<NoteState>) => {
    const note = notes.value.get(id);
    if (!note) return;
    notes.value.set(id, {
      ...note,
      ...patch,
    });
  };

  const queueContentSaveNow = async (
    id: string,
    content: string,
    title?: string,
  ): Promise<boolean> => {
    const pending = pendingSaves.get(id);
    if (pending?.timer) clearTimeout(pending.timer);
    pendingSaves.delete(id);

    const note = notes.value.get(id);
    if (!note) return false;
    const resolvedTitle = normalizeWorkspaceNoteTitle(
      title ?? note.title,
      content,
    );

    try {
      patchNote(id, {
        isLoading: true,
        error: null,
      });
      await pendingQueue.add({
        id,
        operation: "upsert",
        updatedAt: Date.now(),
        localVersion: note.localVersion ? note.localVersion + 1 : 1,
        serverVersion: note.version,
        workspaceId: note.workspaceId,
        groupId: note.groupId ?? null,
        title: resolvedTitle,
        content,
        tags: note.tags,
        noteType: note.noteType,
        metadata: note.metadata,
        order: note.order,
      });
      await pendingQueue.registerBackgroundSync();
      logNotesOperation("content-queued", {
        workspaceId: note.workspaceId,
        id,
      });
      patchNote(id, {
        isLoading: false,
        isDirty: true,
        error: null,
      });
      if (isVerifiedOnline.value) requestSync();
      return true;
    } catch {
      patchNote(id, {
        isLoading: false,
        error: "Failed to save note locally",
      });
      return false;
    }
  };

  const queueContentSave = (id: string, content: string, title?: string) => {
    const previous = pendingSaves.get(id);
    if (previous?.timer) clearTimeout(previous.timer);

    const nextSave: PendingSave = {
      content,
      title,
      timer: setTimeout(() => {
        void queueContentSaveNow(id, content, title);
      }, debounceMs),
    };
    pendingSaves.set(id, nextSave);
  };

  const flushDrafts = async () => {
    await flushEditorDrafts();
    const saves = Array.from(pendingSaves.entries());
    await Promise.allSettled(
      saves.map(([id, save]) =>
        queueContentSaveNow(id, save.content, save.title),
      ),
    );
  };

  return {
    queueContentSave,
    queueContentSaveNow,
    flushDrafts,
  };
}
