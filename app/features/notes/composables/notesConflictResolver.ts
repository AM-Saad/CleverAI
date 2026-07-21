import type { Ref } from "vue";
import type { NotesSyncResponse } from "../../../../shared/utils/note-sync.contract";
import type { NoteSyncConflictRecord } from "~/utils/idb";
import type { NotesConflictRepository } from "./notesConflictRepository";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { normalizeLocalNote, toNoteType, type NoteState } from "./noteTransforms";
import { areNoteSyncStatesEquivalent } from "../../../../shared/utils/note-sync-equivalence";

export type NotesConflictResolution = "keep-local" | "keep-server" | "manual-merge";

export interface NotesConflictResolver {
  recordContentConflicts(response: NotesSyncResponse): Promise<number>;
  hydrateConflictState(): Promise<void>;
  hasConflicts(): Promise<boolean>;
  getConflict(noteId: string): NoteSyncConflictRecord | null;
  resolveContentConflict(noteId: string, resolution: NotesConflictResolution): Promise<boolean>;
}

function contentConflictId(workspaceId: string, noteId: string) {
  return `${workspaceId}:content:${noteId}`;
}

export function createNotesConflictResolver(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  conflicts: Ref<Map<string, NoteSyncConflictRecord>>;
  conflictRepository: NotesConflictRepository;
  pendingQueue: NotesPendingQueue;
  localRepository: NotesLocalRepository;
}): NotesConflictResolver {
  const {
    workspaceId,
    notes,
    conflicts: conflictRecords,
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

  const unmarkNoteConflict = async (noteId: string) => {
    const nextConflicts = new Map(conflictRecords.value);
    nextConflicts.delete(noteId);
    conflictRecords.value = nextConflicts;
    await conflictRepository.remove([contentConflictId(workspaceId, noteId)]);
  };

  const upsertConflictRecord = async (record: NoteSyncConflictRecord) => {
    await conflictRepository.save(record);
    const nextConflicts = new Map(conflictRecords.value);
    nextConflicts.set(record.entityId, record);
    conflictRecords.value = nextConflicts;
  };

  const settleConvergedConflict = async (
    noteId: string,
    pendingChange: Awaited<ReturnType<NotesPendingQueue["load"]>>[number] | undefined,
    serverSnapshot: NoteSyncConflictRecord["serverSnapshot"],
    serverVersion?: number,
  ): Promise<boolean> => {
    if (
      pendingChange?.operation !== "upsert" ||
      !serverSnapshot ||
      !areNoteSyncStatesEquivalent(pendingChange, serverSnapshot)
    ) {
      return false;
    }

    const note = notes.value.get(noteId);
    if (!note) return false;

    await pendingQueue.remove([noteId]);
    const snapshot = serverSnapshot as {
      groupId?: string | null;
      title?: string;
      content?: string;
      tags?: string[];
      noteType?: string;
      metadata?: unknown;
      updatedAt?: string;
    };
    const nextNote = normalizeLocalNote({
      ...note,
      groupId: snapshot.groupId ?? null,
      title: snapshot.title ?? note.title,
      content: snapshot.content ?? note.content,
      tags: snapshot.tags ?? note.tags,
      noteType: toNoteType(snapshot.noteType),
      metadata: snapshot.metadata as Record<string, unknown> | undefined,
      version: serverVersion ?? note.version,
      updatedAt: snapshot.updatedAt
        ? new Date(snapshot.updatedAt)
        : note.updatedAt,
      isLoading: false,
      isDirty: false,
      lastSaved: new Date(),
      error: null,
    });
    notes.value.set(noteId, nextNote);
    await localRepository.save(nextNote);
    await unmarkNoteConflict(noteId);
    return true;
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
      if (
        await settleConvergedConflict(
          conflict.id,
          pendingChange,
          conflict.serverSnapshot ?? null,
          conflict.serverVersion,
        )
      ) {
        continue;
      }
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

      await upsertConflictRecord(record);
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
    const pendingChanges = await pendingQueue.load(workspaceId);
    const pendingById = new Map(
      pendingChanges.map((change) => [change.id, change]),
    );
    const nextConflicts = new Map<string, NoteSyncConflictRecord>();
    for (const conflict of conflicts) {
      if (conflict.scope !== "content") continue;
      if (
        await settleConvergedConflict(
          conflict.entityId,
          pendingById.get(conflict.entityId),
          conflict.serverSnapshot,
          conflict.serverVersion,
        )
      ) {
        continue;
      }
      nextConflicts.set(conflict.entityId, conflict);
      await markNoteConflict(conflict.entityId, conflict);
    }
    conflictRecords.value = nextConflicts;
  };

  const hasConflicts = async () => {
    const conflicts = await conflictRepository.load(workspaceId);
    return conflicts.length > 0;
  };

  const getConflict = (noteId: string) => conflictRecords.value.get(noteId) ?? null;

  const resolveContentConflict = async (
    noteId: string,
    resolution: NotesConflictResolution,
  ): Promise<boolean> => {
    const conflict = getConflict(noteId);
    const note = notes.value.get(noteId);
    if (!conflict || !note) return false;

    const pendingChanges = await pendingQueue.load(workspaceId);
    const pendingChange = pendingChanges.find((change) => change.id === noteId);
    const serverVersion = conflict.serverVersion ?? note.version;

    if (resolution === "keep-server") {
      const serverSnapshot = conflict.serverSnapshot as {
        groupId?: string | null;
        title?: string;
        content?: string;
        tags?: string[];
        noteType?: string;
        metadata?: unknown;
        updatedAt?: string;
      } | null | undefined;
      if (!serverSnapshot) return false;

      await pendingQueue.remove([noteId]);
      const nextNote = normalizeLocalNote({
        ...note,
        ...serverSnapshot,
        id: note.id,
        workspaceId: note.workspaceId,
        groupId: serverSnapshot.groupId ?? null,
        title: serverSnapshot.title ?? note.title,
        content: serverSnapshot.content ?? "",
        tags: serverSnapshot.tags ?? [],
        noteType: toNoteType(serverSnapshot.noteType) ?? note.noteType,
        metadata: serverSnapshot.metadata as Record<string, unknown> | undefined,
        version: serverVersion,
        updatedAt: serverSnapshot.updatedAt ? new Date(serverSnapshot.updatedAt) : note.updatedAt,
        isLoading: false,
        isDirty: false,
        error: null,
      });
      notes.value.set(noteId, nextNote);
      await localRepository.save(nextNote);
      await unmarkNoteConflict(noteId);
      return true;
    }

    const source = (resolution === "keep-local"
      ? pendingChange ?? conflict.localSnapshot ?? note
      : note) as { title?: unknown; content?: unknown };
    const nextTitle = typeof source.title === "string"
      ? source.title
      : note.title;
    const nextContent = typeof source.content === "string"
      ? source.content
      : note.content;

    await pendingQueue.add({
      id: noteId,
      operation: "upsert",
      updatedAt: Date.now(),
      localVersion: note.localVersion ? note.localVersion + 1 : 1,
      serverVersion,
      workspaceId: note.workspaceId,
      groupId: note.groupId ?? null,
      title: nextTitle,
      content: nextContent,
      tags: note.tags,
      noteType: note.noteType,
      metadata: note.metadata,
      conflicted: false,
    });

    const nextNote = normalizeLocalNote({
      ...note,
      title: nextTitle,
      content: nextContent,
      version: serverVersion,
      updatedAt: new Date(),
      isLoading: false,
      isDirty: true,
      error: null,
    });
    notes.value.set(noteId, nextNote);
    await localRepository.save(nextNote);
    await unmarkNoteConflict(noteId);
    return true;
  };

  return {
    recordContentConflicts,
    hydrateConflictState,
    hasConflicts,
    getConflict,
    resolveContentConflict,
  };
}
