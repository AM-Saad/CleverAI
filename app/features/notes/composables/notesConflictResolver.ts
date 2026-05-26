import type { Ref } from "vue";
import type { NotesSyncResponse } from "../../../../shared/utils/note-sync.contract";
import type { NoteSyncConflictRecord } from "~/utils/idb";
import type { NotesConflictRepository } from "./notesConflictRepository";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { normalizeLocalNote, type NoteState } from "./noteTransforms";

export interface NotesConflictResolver {
  recordContentConflicts(response: NotesSyncResponse): Promise<number>;
  hydrateConflictState(): Promise<void>;
  hasConflicts(): Promise<boolean>;
}

function contentConflictId(workspaceId: string, noteId: string) {
  return `${workspaceId}:content:${noteId}`;
}

export function createNotesConflictResolver(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  conflictRepository: NotesConflictRepository;
  pendingQueue: NotesPendingQueue;
  localRepository: NotesLocalRepository;
}): NotesConflictResolver {
  const {
    workspaceId,
    notes,
    conflictRepository,
    pendingQueue,
    localRepository,
  } = input;

  const markNoteConflict = async (
    noteId: string,
    conflict: Pick<NoteSyncConflictRecord, "reason" | "serverVersion" | "clientServerVersion" | "serverSnapshot">,
  ) => {
    const note = notes.value.get(noteId);
    if (!note) return;

    const nextNote = normalizeLocalNote({
      ...note,
      version: conflict.serverVersion ?? note.version,
      isLoading: false,
      isDirty: true,
      error: "Sync conflict detected. Resolve local and server versions before syncing this note.",
    });
    notes.value.set(noteId, nextNote);
    await localRepository.save(nextNote);
  };

  const recordContentConflicts = async (response: NotesSyncResponse): Promise<number> => {
    const conflicts = response.conflicts ?? [];
    if (!conflicts.length) return 0;

    const pendingChanges = await pendingQueue.load(workspaceId);
    const pendingById = new Map(pendingChanges.map((change) => [change.id, change]));
    let recorded = 0;

    for (const conflict of conflicts) {
      const localNote = notes.value.get(conflict.id);
      const pendingChange = pendingById.get(conflict.id);
      const now = Date.now();
      const record: NoteSyncConflictRecord = {
        id: contentConflictId(workspaceId, conflict.id),
        workspaceId,
        scope: "content",
        entityId: conflict.id,
        reason: conflict.reason ?? "SYNC_CONFLICT",
        createdAt: now,
        updatedAt: now,
        localSnapshot: pendingChange ?? localNote ?? null,
        serverSnapshot: conflict.serverSnapshot ?? null,
        serverVersion: conflict.serverVersion,
        clientServerVersion: conflict.clientServerVersion,
      };

      await conflictRepository.save(record);
      if (pendingChange) {
        await pendingQueue.add({
          ...pendingChange,
          conflicted: true,
          serverVersion: conflict.serverVersion ?? pendingChange.serverVersion,
        });
      }
      await markNoteConflict(conflict.id, record);
      recorded++;
    }

    return recorded;
  };

  const hydrateConflictState = async () => {
    const conflicts = await conflictRepository.load(workspaceId);
    for (const conflict of conflicts) {
      if (conflict.scope !== "content") continue;
      await markNoteConflict(conflict.entityId, conflict);
    }
  };

  const hasConflicts = async () => {
    const conflicts = await conflictRepository.load(workspaceId);
    return conflicts.length > 0;
  };

  return {
    recordContentConflicts,
    hydrateConflictState,
    hasConflicts,
  };
}
