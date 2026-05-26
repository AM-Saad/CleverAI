import type { Ref } from "vue";
import type { NotesSyncResponse } from "../../../../shared/utils/note-sync.contract";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import type { NotesPendingQueue } from "./notesPendingQueue";
import {
  remapPendingNoteGroupIds,
  remapPendingNoteIds,
} from "../../../utils/idb";
import {
  normalizeLocalNote,
  noteStateFromPendingChange,
  type NoteState,
} from "./noteTransforms";

export interface NotesSyncCoordinator {
  applySyncResult(response: NotesSyncResponse): Promise<void>;
  hydrateFromLocalState(): Promise<void>;
}

export function createNotesSyncCoordinator(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  localRepository: NotesLocalRepository;
  layoutQueue: NotesLayoutQueue;
  pendingQueue: NotesPendingQueue;
  onNoteIdRemapped?: (tempId: string, serverId: string) => void;
}): NotesSyncCoordinator {
  const { workspaceId, notes, localRepository, layoutQueue, pendingQueue, onNoteIdRemapped } = input;

  const applySyncResult = async (response: NotesSyncResponse): Promise<void> => {
    const appliedIds = response.applied ?? [];
    const appliedNoteMetadata = new Map(
      (response.appliedNotes ?? []).map((note) => [note.id, note]),
    );
    const conflicts = response.conflicts ?? [];
    const idMap = response.idMap ?? {};
    const groupIdMap = response.groupIdMap ?? {};
    const now = new Date();

    for (const [tempId, serverId] of Object.entries(idMap)) {
      const tempNote = notes.value.get(tempId);
      if (!tempNote) continue;

      const appliedMetadata = appliedNoteMetadata.get(tempId);

      const serverNote: NoteState = {
        ...normalizeLocalNote(tempNote),
        id: serverId,
        version: appliedMetadata?.version ?? tempNote.version,
        updatedAt: appliedMetadata?.updatedAt
          ? new Date(appliedMetadata.updatedAt)
          : tempNote.updatedAt,
        isDirty: false,
        isLoading: false,
        lastSaved: now,
        error: null,
      };
      notes.value.set(serverId, serverNote);
      notes.value.delete(tempId);
      onNoteIdRemapped?.(tempId, serverId);
      await localRepository.save(serverNote);
      await localRepository.delete(tempId);
    }

    if (Object.keys(idMap).length) {
      await remapPendingNoteIds(idMap);
    }

    for (const noteId of appliedIds) {
      const localId = idMap[noteId] ?? noteId;
      const note = notes.value.get(localId);
      if (!note) continue;
      const appliedMetadata = appliedNoteMetadata.get(noteId);

      const nextNote: NoteState = normalizeLocalNote({
        ...note,
        version: appliedMetadata?.version ?? note.version,
        updatedAt: appliedMetadata?.updatedAt
          ? new Date(appliedMetadata.updatedAt)
          : note.updatedAt,
        isDirty: false,
        isLoading: false,
        lastSaved: now,
        error: null,
      });
      notes.value.set(localId, nextNote);
      await localRepository.save(nextNote);
    }

    if (Object.keys(groupIdMap).length) {
      await remapPendingNoteGroupIds(groupIdMap);
      const affectedNotes: NoteState[] = [];
      for (const [noteId, note] of notes.value) {
        if (!note.groupId || !groupIdMap[note.groupId]) continue;
        const nextNote = normalizeLocalNote({
          ...note,
          groupId: groupIdMap[note.groupId],
        });
        notes.value.set(noteId, nextNote);
        affectedNotes.push(nextNote);
      }
      if (affectedNotes.length) {
        await localRepository.saveMany(affectedNotes);
      }
    }

    for (const conflict of conflicts) {
      const note = notes.value.get(conflict.id);
      if (!note) continue;
      const pendingChanges = conflict.reason === "VERSION_MISMATCH" && conflict.serverVersion !== undefined
        ? await pendingQueue.load(workspaceId)
        : [];
      const pendingChange = pendingChanges.find((change) => change.id === conflict.id);

      if (pendingChange) {
        await pendingQueue.add({
          ...pendingChange,
          serverVersion: conflict.serverVersion,
        });
      }

      const nextNote: NoteState = normalizeLocalNote({
        ...note,
        version: conflict.serverVersion ?? note.version,
        isLoading: false,
        isDirty: true,
        error: conflict.reason === "VERSION_MISMATCH"
          ? "Server version refreshed. Retry will keep your local changes."
          : "Sync conflict detected. Review this note and retry.",
      });
      notes.value.set(conflict.id, nextNote);
      await localRepository.save(nextNote);
    }
  };

  const hydrateFromLocalState = async (): Promise<void> => {
    const [localNotes, pendingChanges] = await Promise.all([
      localRepository.loadByWorkspace(workspaceId),
      pendingQueue.load(workspaceId),
    ]);
    const pendingLayout = await layoutQueue.load(workspaceId);

    if (localNotes.length === 0 && pendingChanges.length === 0 && !pendingLayout) return;

    const noteMap = new Map<string, NoteState>();
    localNotes.forEach((note) => noteMap.set(note.id, normalizeLocalNote(note)));

    for (const change of pendingChanges) {
      if (change.operation === "delete") {
        noteMap.delete(change.id);
        continue;
      }

      if (change.operation !== "upsert") continue;

      const existing = noteMap.get(change.id);
      if (existing) {
        const existingTime = existing.updatedAt
          ? new Date(existing.updatedAt).getTime()
          : 0;
        const pendingTime = change.updatedAt || 0;
        if (existingTime > pendingTime) continue;

        noteMap.set(change.id, {
          ...existing,
          title: normalizeWorkspaceNoteTitle(
            change.title,
            change.content ?? existing.content,
          ),
          content: change.content ?? existing.content,
          tags: change.tags ?? existing.tags,
          groupId: change.groupId !== undefined ? change.groupId : existing.groupId,
          metadata: change.metadata ?? existing.metadata,
          isDirty: true,
        });
        continue;
      }

      if (change.workspaceId === workspaceId) {
        noteMap.set(change.id, noteStateFromPendingChange(change, noteMap.size));
      }
    }

    if (pendingLayout) {
      for (const layoutNote of pendingLayout.notes) {
        const existing = noteMap.get(layoutNote.id);
        if (!existing) continue;
        noteMap.set(layoutNote.id, {
          ...existing,
          groupId: layoutNote.groupId,
          order: layoutNote.order,
        });
      }
    }

    notes.value.clear();
    noteMap.forEach((note, id) => notes.value.set(id, note));
  };

  return {
    applySyncResult,
    hydrateFromLocalState,
  };
}
