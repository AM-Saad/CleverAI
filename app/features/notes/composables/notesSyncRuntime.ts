import type { Note } from "@@/shared/utils/note.contract";
import type {
  NoteLayoutChange,
  NotesSyncRequest,
  NotesSyncResponse,
  PendingNoteChange,
} from "@@/shared/utils/note-sync.contract";
import type { Ref } from "vue";
import type { Result } from "../../../types/Result";
import type { NotesConflictResolver } from "./notesConflictResolver";
import type { NotesGroupQueue } from "./notesGroupQueue";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { logNotesOperation } from "./notesOperationLog";
import { createNotesSyncEngine, type NotesSyncReason } from "./notesSyncEngine";
import type { NotesSyncCoordinator } from "./notesSyncCoordinator";
import {
  normalizeLocalNote,
  noteStateFromServer,
  type NoteState,
} from "./noteTransforms";
import type { NotesLayoutStatus } from "./notesLayoutController";

export interface NotesSyncRuntime {
  hydrateLocalNotes(): Promise<void>;
  refreshFromServer(): Promise<void>;
  syncWithServer(): Promise<void>;
  syncPendingChanges(reason?: NotesSyncReason): Promise<boolean>;
  refreshLayoutPendingCount(): Promise<void>;
  remapGroupIds(groupIdMap: Record<string, string>): Promise<void>;
  resolveNoteId(id: string | null): string | null;
}

export function createNotesSyncRuntime(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  loadingStates: Ref<Map<string, boolean>>;
  lastSync: Ref<Date | null>;
  layoutPendingCount: Ref<number>;
  layoutStatus: Ref<NotesLayoutStatus>;
  noteIdAliases: Ref<Map<string, string>>;
  localRepository: NotesLocalRepository;
  pendingQueue: NotesPendingQueue;
  groupQueue: NotesGroupQueue;
  layoutQueue: NotesLayoutQueue;
  syncCoordinator: NotesSyncCoordinator;
  conflictResolver: NotesConflictResolver;
  networkMonitor: {
    isVerifiedOnline: Ref<boolean>;
  };
  notesApi: {
    getByWorkspace(workspaceId: string): Promise<Result<Note[]>>;
    sync(payload: NotesSyncRequest): Promise<Result<NotesSyncResponse>>;
  };
  flushDrafts(): Promise<void>;
  resetSyncRetry(): void;
  scheduleSyncRetry(): void;
  hydrateLocalGroups(): Promise<void>;
}): NotesSyncRuntime {
  const {
    workspaceId,
    notes,
    loadingStates,
    lastSync,
    layoutPendingCount,
    layoutStatus,
    noteIdAliases,
    localRepository,
    pendingQueue,
    groupQueue,
    layoutQueue,
    syncCoordinator,
    conflictResolver,
    networkMonitor,
    notesApi,
    flushDrafts,
    resetSyncRetry,
    scheduleSyncRetry,
    hydrateLocalGroups,
  } = input;

  const refreshLayoutPendingCount = async () => {
    const pendingLayout = await layoutQueue.load(workspaceId);
    layoutPendingCount.value = pendingLayout ? 1 : 0;
    if (pendingLayout && layoutStatus.value === "idle") {
      layoutStatus.value = "queued";
    }
  };

  const buildPendingUpsertFromLocalNote = (
    note: NoteState,
  ): PendingNoteChange => ({
    id: note.id,
    operation: "upsert",
    updatedAt: Date.now(),
    localVersion: note.localVersion ? note.localVersion + 1 : 1,
    ...(!note.id.startsWith("temp-") && { serverVersion: note.version }),
    workspaceId: note.workspaceId,
    groupId: note.groupId ?? null,
    title: note.title,
    content: note.content,
    tags: note.tags,
    noteType: note.noteType,
    metadata: note.metadata,
  });

  const preparePendingLayoutForSync = async (
    pendingChanges: PendingNoteChange[],
    pendingLayout: NoteLayoutChange | null,
  ): Promise<{
    pendingChanges: PendingNoteChange[];
    pendingLayout: NoteLayoutChange | null;
  }> => {
    if (!pendingLayout) return { pendingChanges, pendingLayout };

    const pendingById = new Set(pendingChanges.map((change) => change.id));
    const layoutByNoteId = new Map(
      pendingLayout.notes.map((note) => [note.id, note]),
    );
    const nextChanges = pendingChanges.map((change) => {
      if (change.operation !== "upsert") return change;

      const layoutNote = layoutByNoteId.get(change.id);
      if (!layoutNote || change.groupId === layoutNote.groupId) return change;

      return {
        ...change,
        groupId: layoutNote.groupId,
        updatedAt: Math.max(change.updatedAt, pendingLayout.updatedAt),
      };
    });
    let nextLayout: NoteLayoutChange | null = pendingLayout;
    let layoutChanged = false;
    const patchedChanges = nextChanges.filter(
      (change, index) => change !== pendingChanges[index],
    );

    for (const layoutNote of pendingLayout.notes) {
      if (!layoutNote.id.startsWith("temp-") || pendingById.has(layoutNote.id))
        continue;

      const localNote = notes.value.get(layoutNote.id);
      if (localNote) {
        const repairedChange = buildPendingUpsertFromLocalNote(localNote);
        await pendingQueue.add(repairedChange);
        nextChanges.push(repairedChange);
        pendingById.add(layoutNote.id);
        logNotesOperation("content-queued", {
          workspaceId,
          id: layoutNote.id,
          reason: "repair-layout-temp-note",
        });
        continue;
      }

      nextLayout = {
        ...nextLayout,
        notes: nextLayout.notes.filter((note) => note.id !== layoutNote.id),
      };
      layoutChanged = true;
    }

    if (layoutChanged) {
      if (nextLayout.notes.length || nextLayout.groups.length) {
        await layoutQueue.save(nextLayout);
      } else {
        await layoutQueue.remove(workspaceId);
        nextLayout = null;
      }
    }

    for (const patchedChange of patchedChanges) {
      await pendingQueue.add(patchedChange);
    }

    return { pendingChanges: nextChanges, pendingLayout: nextLayout };
  };

  const repairDirtyNotesWithoutPending = async (
    pendingChanges: PendingNoteChange[],
  ): Promise<PendingNoteChange[]> => {
    const pendingById = new Set(pendingChanges.map((change) => change.id));
    const nextChanges = pendingChanges.slice();

    for (const note of notes.value.values()) {
      if (!note.isDirty || note.error || pendingById.has(note.id)) continue;
      if (conflictResolver.getConflict(note.id)) continue;

      const repairedChange = buildPendingUpsertFromLocalNote(note);
      await pendingQueue.add(repairedChange);
      nextChanges.push(repairedChange);
      pendingById.add(note.id);
      logNotesOperation("content-queued", {
        workspaceId,
        id: note.id,
        reason: "repair-dirty-note-without-pending-change",
      });
    }

    return nextChanges;
  };

  const drainWorkspace = async (): Promise<boolean> => {
    await flushDrafts();

    if (!networkMonitor.isVerifiedOnline.value) {
      await refreshLayoutPendingCount();
      return false;
    }

    const hasUnresolvedConflicts = await conflictResolver.hasConflicts();
    let pendingChanges = (await pendingQueue.load(workspaceId)).filter(
      (change) => !change.conflicted,
    );
    pendingChanges = await repairDirtyNotesWithoutPending(pendingChanges);
    const pendingGroupChanges = await groupQueue.load(workspaceId);
    let pendingLayout = await layoutQueue.load(workspaceId);
    ({ pendingChanges, pendingLayout } = await preparePendingLayoutForSync(
      pendingChanges,
      pendingLayout,
    ));

    if (
      !pendingChanges.length &&
      !pendingGroupChanges.length &&
      !pendingLayout
    ) {
      layoutPendingCount.value = 0;
      layoutStatus.value = "synced";
      resetSyncRetry();
      return !hasUnresolvedConflicts;
    }

    logNotesOperation("sync-start", {
      workspaceId,
      contentChanges: pendingChanges.length,
      groupChanges: pendingGroupChanges.length,
      layout: Boolean(pendingLayout),
    });
    if (pendingLayout) layoutStatus.value = "syncing";

    const result = await notesApi.sync({
      changes: pendingChanges,
      contentChanges: [],
      groupChanges: pendingGroupChanges,
      ...(pendingLayout && { layoutChange: pendingLayout }),
    });

    if (!result.success) {
      console.error("Failed to sync notes queues", { error: result.error });
      await refreshLayoutPendingCount();
      if (pendingLayout) layoutStatus.value = "failed";
      logNotesOperation("sync-failure", {
        workspaceId,
        reason: "notes-sync-api-failed",
      });
      scheduleSyncRetry();
      return false;
    }

    resetSyncRetry();

    await syncCoordinator.applySyncResult(result.data);
    const recordedConflicts = await conflictResolver.recordContentConflicts(
      result.data,
    );
    await pendingQueue.remove(result.data.applied ?? []);
    await groupQueue.remove(result.data.groupApplied ?? []);
    if (result.data.layoutApplied && pendingLayout) {
      await layoutQueue.remove(workspaceId);
    }
    await refreshLayoutPendingCount();
    layoutStatus.value = result.data.layoutConflict
      ? "conflict"
      : layoutPendingCount.value
        ? "queued"
        : "synced";
    lastSync.value = new Date();
    logNotesOperation("sync-success", {
      workspaceId,
      applied: result.data.applied.length,
      groupApplied: result.data.groupApplied.length,
      layoutApplied: result.data.layoutApplied,
      layoutConflict: result.data.layoutConflict,
    });

    return !result.data.layoutConflict && recordedConflicts === 0;
  };

  const syncEngine = createNotesSyncEngine({
    drainWorkspace: async (targetWorkspaceId) => {
      if (targetWorkspaceId !== workspaceId) return false;
      return drainWorkspace();
    },
  });

  const syncPendingChanges = (reason: NotesSyncReason = "background") =>
    syncEngine.syncWorkspace(workspaceId, reason);

  const hydrateLocalNotes = async (): Promise<void> => {
    try {
      await Promise.all([
        syncCoordinator.hydrateFromLocalState(),
        hydrateLocalGroups(),
      ]);
      await conflictResolver.hydrateConflictState();
    } finally {
      await refreshLayoutPendingCount();
    }
  };

  const refreshFromServer = async (): Promise<void> => {
    if (!networkMonitor.isVerifiedOnline.value) {
      await refreshLayoutPendingCount();
      return;
    }

    loadingStates.value.set(workspaceId, true);

    try {
      const pendingBeforeSync = await pendingQueue.load(workspaceId);
      const pendingDeleteIds = new Set(
        pendingBeforeSync
          .filter((change) => change.operation === "delete")
          .map((change) => change.id),
      );
      const hadPendingChanges = pendingBeforeSync.length > 0;
      const hadPendingGroups = (await groupQueue.load(workspaceId)).length > 0;
      const hadPendingLayout = Boolean(await layoutQueue.load(workspaceId));
      const pendingSynced = await syncPendingChanges("refresh");
      const remainingChanges = await pendingQueue.load(workspaceId);
      remainingChanges
        .filter((change) => change.operation === "delete")
        .forEach((change) => pendingDeleteIds.add(change.id));
      const remainingGroups = await groupQueue.load(workspaceId);
      const remainingLayout = await layoutQueue.load(workspaceId);

      if (
        (hadPendingChanges || hadPendingGroups || hadPendingLayout) &&
        (!pendingSynced ||
          remainingChanges.length > 0 ||
          remainingGroups.length > 0 ||
          remainingLayout)
      ) {
        return;
      }

      const pendingAfterSync = new Set(
        remainingChanges.map((change) => change.id),
      );
      const result = await notesApi.getByWorkspace(workspaceId);

      if (!result.success) return;

      const tempNotes = Array.from(notes.value.values()).filter(
        (note) => note.id.startsWith("temp-") && pendingAfterSync.has(note.id),
      );
      const dirtyNotes = new Map<string, NoteState>();
      for (const [id, note] of notes.value) {
        if (note.isDirty && !id.startsWith("temp-")) {
          dirtyNotes.set(id, note);
        }
      }

      const noteStates: NoteState[] = result.data
        .filter((note) => !pendingDeleteIds.has(note.id))
        .map((note) => noteStateFromServer(note));

      notes.value.clear();
      noteStates.forEach((note) => {
        const dirty = dirtyNotes.get(note.id);
        notes.value.set(note.id, dirty ?? note);
      });

      for (const tempNote of tempNotes) {
        notes.value.set(tempNote.id, tempNote);
      }

      await localRepository.saveMany(
        noteStates.filter((note) => !dirtyNotes.has(note.id)),
      );

      for (const tempNote of tempNotes) {
        try {
          await localRepository.delete(tempNote.id);
        } catch {
          /* best effort cleanup */
        }
      }

      lastSync.value = new Date();
    } finally {
      await refreshLayoutPendingCount();
      loadingStates.value.set(workspaceId, false);
    }
  };

  const syncWithServer = async (): Promise<void> => {
    await hydrateLocalNotes();

    if (!networkMonitor.isVerifiedOnline.value) {
      return;
    }

    try {
      await refreshFromServer();
    } catch {
      // IDB data from hydrateLocalNotes remains visible.
    }
  };

  const remapGroupIds = async (
    groupIdMap: Record<string, string>,
  ): Promise<void> => {
    if (!Object.keys(groupIdMap).length) return;
    const changedNotes: NoteState[] = [];
    const nextNotes = new Map(notes.value);

    for (const [id, note] of nextNotes) {
      if (!note.groupId || !groupIdMap[note.groupId]) continue;
      const nextNote = normalizeLocalNote({
        ...note,
        groupId: groupIdMap[note.groupId],
      });
      nextNotes.set(id, nextNote);
      changedNotes.push(nextNote);
    }

    if (!changedNotes.length) return;
    notes.value = nextNotes;
    await localRepository.saveMany(changedNotes);
  };

  const resolveNoteId = (id: string | null): string | null => {
    if (!id) return null;
    return noteIdAliases.value.get(id) ?? id;
  };

  return {
    hydrateLocalNotes,
    refreshFromServer,
    syncWithServer,
    syncPendingChanges,
    refreshLayoutPendingCount,
    remapGroupIds,
    resolveNoteId,
  };
}
