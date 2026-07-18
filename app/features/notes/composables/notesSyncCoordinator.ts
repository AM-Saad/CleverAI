import type { Ref } from "vue";
import type {
  NotesSyncResponse,
  PendingNoteChange,
} from "../../../../shared/utils/note-sync.contract";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import type { RevisionAwareNotesPendingQueue } from "./notesPendingQueue";
import {
  remapPendingNoteGroupIds,
  remapPendingNoteIds,
} from "../../../utils/idb";
import {
  normalizeLocalNote,
  noteStateFromPendingChange,
  type NoteState,
} from "./noteTransforms";
import { withNotesWorkspaceMutationLock } from "./notesWorkspaceMutationLock";

export interface NotesSyncCoordinator {
  applySyncResult(
    response: NotesSyncResponse,
    sentChanges?: PendingNoteChange[],
  ): Promise<void>;
  hydrateFromLocalState(): Promise<void>;
}

export function createNotesSyncCoordinator(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  localRepository: NotesLocalRepository;
  layoutQueue: NotesLayoutQueue;
  pendingQueue: RevisionAwareNotesPendingQueue;
  onNoteIdRemapped?: (tempId: string, serverId: string) => void;
}): NotesSyncCoordinator {
  const {
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    pendingQueue,
    onNoteIdRemapped,
  } = input;

  const applySyncResult = async (
    response: NotesSyncResponse,
    sentChanges: PendingNoteChange[] = [],
  ): Promise<void> =>
    withNotesWorkspaceMutationLock(workspaceId, async () => {
      const appliedIds = response.applied ?? [];
      const appliedNoteMetadata = new Map(
        (response.appliedNotes ?? []).map((note) => [note.id, note]),
      );
      const idMap = response.idMap ?? {};
      const groupIdMap = response.groupIdMap ?? {};
      const replayedCreates = new Set(response.replayedCreates ?? []);
      const now = new Date();
      const sentById = new Map(
        sentChanges.map((change) => [change.id, change]),
      );
      const currentPending = new Map(
        (await pendingQueue.load(workspaceId)).map((change) => [
          change.id,
          change,
        ]),
      );
      const isNewerThanSent = (
        current: PendingNoteChange | undefined,
        sent: PendingNoteChange | undefined,
      ) =>
        Boolean(
          current &&
          sent &&
          (current.localVersion > sent.localVersion ||
            current.updatedAt > sent.updatedAt ||
            current.operation !== sent.operation),
        );

      for (const [tempId, serverId] of Object.entries(idMap)) {
        const sent = sentById.get(tempId);
        const current = currentPending.get(tempId);
        const tempNote =
          notes.value.get(tempId) ??
          (sent?.operation === "upsert"
            ? noteStateFromPendingChange(sent, notes.value.size)
            : null);
        if (!tempNote) continue;

        const appliedMetadata = appliedNoteMetadata.get(tempId);
        const replayedCreate = replayedCreates.has(tempId);
        const baseServerNote: NoteState = {
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
        let retainedChange: PendingNoteChange | null = null;
        if (sent && pendingQueue.acknowledge) {
          retainedChange = await pendingQueue.acknowledge(sent, {
            remapToId: serverId,
            serverVersion: appliedMetadata?.version ?? tempNote.version,
            // A recovered receipt acknowledges an earlier HTTP attempt. Retain
            // this payload once under the canonical id so it cannot be lost.
            keepCurrent: replayedCreate,
            localMutation: {
              type: "remap",
              fromId: tempId,
              note: baseServerNote,
            },
          });
        } else {
          const hasNewer = replayedCreate || isNewerThanSent(current, sent);
          await pendingQueue.remove([tempId]);
          if (hasNewer && current) {
            retainedChange = {
              ...current,
              id: serverId,
              serverVersion: appliedMetadata?.version ?? tempNote.version,
              workspaceId: current.workspaceId ?? tempNote.workspaceId,
            };
            await pendingQueue.add(retainedChange);
          }
        }
        const hasNewerLocalChange = Boolean(retainedChange);
        const hasPendingDelete = retainedChange?.operation === "delete";

        const serverNote: NoteState = {
          ...baseServerNote,
          isDirty: hasNewerLocalChange,
        };
        if (!hasPendingDelete) notes.value.set(serverId, serverNote);
        notes.value.delete(tempId);
        onNoteIdRemapped?.(tempId, serverId);
        if (!pendingQueue.acknowledge) {
          await localRepository.save(serverNote);
          await localRepository.delete(tempId);
        }
      }

      if (Object.keys(idMap).length) {
        await remapPendingNoteIds(idMap);
      }

      for (const noteId of appliedIds) {
        if (idMap[noteId]) continue;
        const sent = sentById.get(noteId);
        const current = currentPending.get(noteId);
        const localId = idMap[noteId] ?? noteId;
        const note = notes.value.get(localId);
        const appliedMetadata = appliedNoteMetadata.get(noteId);
        let retainedChange: PendingNoteChange | null = null;
        if (sent && pendingQueue.acknowledge) {
          const acknowledgedVersion =
            appliedMetadata?.version ?? sent.serverVersion;
          retainedChange = await pendingQueue.acknowledge(sent, {
            serverVersion: acknowledgedVersion,
            ...(sent.operation === "delete" && {
              localMutation: { type: "delete" as const, id: localId },
            }),
            ...(sent.operation !== "delete" && {
              localMutation: {
                type: "advance" as const,
                id: localId,
                serverVersion: acknowledgedVersion,
                updatedAt: appliedMetadata?.updatedAt,
              },
            }),
          });
        } else if (isNewerThanSent(current, sent) && current) {
          retainedChange = {
            ...current,
            serverVersion: appliedMetadata?.version ?? current.serverVersion,
          };
          await pendingQueue.add(retainedChange);
        } else {
          await pendingQueue.remove([noteId]);
        }
        if (retainedChange) {
          if (
            note &&
            retainedChange.operation !== "delete" &&
            appliedMetadata?.version !== undefined
          ) {
            notes.value.set(
              localId,
              normalizeLocalNote({
                ...note,
                version: Math.max(note.version, appliedMetadata.version),
                isDirty: true,
                isLoading: false,
                error: null,
              }),
            );
          }
          continue;
        }

        if (sent?.operation === "delete") {
          notes.value.delete(localId);
          if (!pendingQueue.acknowledge) {
            await localRepository.delete(localId);
          }
          continue;
        }
        if (!note) continue;

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

      for (const conflict of response.conflicts ?? []) {
        const sent = sentById.get(conflict.id);
        if (sent?.operation !== "delete" || !sent.rollbackData) continue;
        const restored = normalizeLocalNote({
          ...sent.rollbackData,
          id: conflict.id,
          isLoading: false,
          isDirty: true,
          error: null,
        } as NoteState);
        notes.value.set(conflict.id, restored);
        await localRepository.save(restored);
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
    });

  const hydrateFromLocalState = async (): Promise<void> =>
    withNotesWorkspaceMutationLock(workspaceId, async () => {
      const [localNotes, pendingChanges] = await Promise.all([
        localRepository.loadByWorkspace(workspaceId),
        pendingQueue.load(workspaceId),
      ]);
      const pendingLayout = await layoutQueue.load(workspaceId);

      if (
        localNotes.length === 0 &&
        pendingChanges.length === 0 &&
        !pendingLayout
      )
        return;

      const noteMap = new Map<string, NoteState>();
      localNotes.forEach((note) =>
        noteMap.set(note.id, normalizeLocalNote(note)),
      );

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
            groupId:
              change.groupId !== undefined ? change.groupId : existing.groupId,
            metadata: change.metadata ?? existing.metadata,
            isDirty: true,
          });
          continue;
        }

        if (change.workspaceId === workspaceId) {
          noteMap.set(
            change.id,
            noteStateFromPendingChange(change, noteMap.size),
          );
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
    });

  return {
    applySyncResult,
    hydrateFromLocalState,
  };
}
