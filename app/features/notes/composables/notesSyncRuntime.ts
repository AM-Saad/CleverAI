import type { Note } from "@@/shared/utils/note.contract";
import type {
  NoteLayoutChange,
  PendingNoteChange,
} from "@@/shared/utils/note-sync.contract";
import type { Ref } from "vue";
import type { NotesConflictResolver } from "./notesConflictResolver";
import type { NotesGroupQueue } from "./notesGroupQueue";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesPendingQueue } from "./notesPendingQueue";
import { logNotesOperation } from "./notesOperationLog";
import { createNotesSyncEngine, type NotesSyncReason } from "./notesSyncEngine";
import type { NotesSyncCoordinator } from "./notesSyncCoordinator";
import { withNotesWorkspaceMutationLock } from "./notesWorkspaceMutationLock";
import {
  normalizeLocalNote,
  noteStateFromPendingChange,
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
    getByWorkspace(
      workspaceId: string,
    ): ReturnType<
      import("~/features/notes/services/noteService").NoteService["getByWorkspace"]
    >;
    sync(
      payload: Parameters<
        import("~/features/notes/services/noteService").NoteService["sync"]
      >[0],
    ): ReturnType<
      import("~/features/notes/services/noteService").NoteService["sync"]
    >;
  };
  flushDrafts(): Promise<void>;
  hydrateLocalGroups(): Promise<void>;
  applyGroupIdMap?(groupIdMap: Record<string, string>): Promise<void>;
  settleGroupDeletes?(input: {
    appliedIds: string[];
    conflictIds: string[];
    sentChanges: import("@@/shared/utils/note-sync.contract").PendingNoteGroupChange[];
  }): Promise<void>;
  resetSyncRetry?(): void;
  scheduleSyncRetry?(): void;
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
    hydrateLocalGroups,
    applyGroupIdMap = async () => {},
    settleGroupDeletes = async () => {},
    resetSyncRetry = () => {},
    scheduleSyncRetry = () => {},
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
    const allPendingGroupChanges = await groupQueue.load(workspaceId);
    const hasUnresolvedGroupConflicts = allPendingGroupChanges.some(
      (change) => change.conflicted,
    );
    const pendingGroupChanges = allPendingGroupChanges.filter(
      (change) => !change.conflicted,
    );
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
      layoutStatus.value =
        hasUnresolvedConflicts || hasUnresolvedGroupConflicts
          ? "conflict"
          : "synced";
      return !hasUnresolvedConflicts && !hasUnresolvedGroupConflicts;
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
      await refreshLayoutPendingCount();
      if (pendingLayout) layoutStatus.value = "queued";
      logNotesOperation("sync-failure", {
        workspaceId,
        reason: "notes-sync-api-failed",
      });
      scheduleSyncRetry();
      return false;
    }

    const hasProcessingErrors = (result.data.errors ?? []).length > 0;
    if (!hasProcessingErrors) resetSyncRetry();
    await syncCoordinator.applySyncResult(result.data, pendingChanges);
    const recordedConflicts = await conflictResolver.recordContentConflicts(
      result.data,
    );
    if (Object.keys(result.data.groupIdMap ?? {}).length) {
      await applyGroupIdMap(result.data.groupIdMap);
    }

    const currentGroups = new Map(
      (await groupQueue.load(workspaceId)).map((change) => [change.id, change]),
    );
    const sentGroups = new Map(
      pendingGroupChanges.map((change) => [change.id, change]),
    );
    const replayedGroupCreates = new Set(
      result.data.replayedGroupCreates ?? [],
    );
    for (const id of result.data.groupApplied ?? []) {
      const current = currentGroups.get(id);
      const sent = sentGroups.get(id);
      const hasNewer =
        replayedGroupCreates.has(id) ||
        Boolean(
          current &&
          sent &&
          (current.localVersion > sent.localVersion ||
            current.updatedAt > sent.updatedAt ||
            current.operation !== sent.operation),
        );
      const serverId = result.data.groupIdMap?.[id];
      if (serverId) {
        await groupQueue.remove([id]);
        if (hasNewer && current) {
          await groupQueue.add({
            ...current,
            id: serverId,
            operation: current.operation === "delete" ? "delete" : "rename",
            serverVersion: current.serverVersion ?? 1,
          });
        }
      } else if (!hasNewer) {
        await groupQueue.remove([id]);
      }
    }
    for (const conflict of result.data.groupConflicts ?? []) {
      const current =
        currentGroups.get(conflict.id) ?? sentGroups.get(conflict.id);
      if (!current) continue;
      await groupQueue.add({ ...current, conflicted: true });
    }
    await settleGroupDeletes({
      appliedIds: result.data.groupApplied ?? [],
      conflictIds: (result.data.groupConflicts ?? []).map(
        (conflict) => conflict.id,
      ),
      sentChanges: pendingGroupChanges,
    });

    const currentLayout = await layoutQueue.load(workspaceId);
    if (
      result.data.layoutApplied &&
      pendingLayout &&
      currentLayout?.localVersion === pendingLayout.localVersion &&
      currentLayout.updatedAt === pendingLayout.updatedAt
    ) {
      await layoutQueue.remove(workspaceId);
    }

    const [remainingChanges, remainingGroups, remainingLayout] =
      await Promise.all([
        pendingQueue.load(workspaceId),
        groupQueue.load(workspaceId),
        layoutQueue.load(workspaceId),
      ]);
    await refreshLayoutPendingCount();
    const hasContentConflict = remainingChanges.some(
      (change) => change.conflicted,
    );
    const hasGroupConflict = remainingGroups.some(
      (change) => change.conflicted,
    );
    const hasRetryableWork =
      remainingChanges.some((change) => !change.conflicted) ||
      remainingGroups.some((change) => !change.conflicted) ||
      Boolean(remainingLayout);
    if (hasProcessingErrors && hasRetryableWork) {
      logNotesOperation("sync-failure", {
        workspaceId,
        reason: "notes-sync-processing-error",
        errors: result.data.errors,
      });
      scheduleSyncRetry();
    }
    layoutStatus.value =
      hasContentConflict || hasGroupConflict || result.data.layoutConflict
        ? "conflict"
        : remainingLayout
          ? "queued"
          : "synced";
    lastSync.value = new Date();
    logNotesOperation("sync-success", {
      workspaceId,
      remainingChanges: remainingChanges.length,
      remainingGroups: remainingGroups.length,
      layoutPending: Boolean(remainingLayout),
    });

    return (
      !hasUnresolvedConflicts &&
      recordedConflicts === 0 &&
      !hasContentConflict &&
      !hasGroupConflict &&
      !result.data.layoutConflict &&
      !hasProcessingErrors &&
      remainingChanges.length === 0 &&
      remainingGroups.length === 0 &&
      !remainingLayout
    );
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

  const sameNoteValue = (left: NoteState, right: NoteState) =>
    left.id === right.id &&
    left.title === right.title &&
    left.content === right.content &&
    (left.groupId ?? null) === (right.groupId ?? null) &&
    left.order === right.order &&
    left.noteType === right.noteType &&
    left.version === right.version &&
    JSON.stringify(left.tags ?? []) === JSON.stringify(right.tags ?? []) &&
    JSON.stringify(left.metadata ?? null) ===
      JSON.stringify(right.metadata ?? null) &&
    Boolean(left.isDirty) === Boolean(right.isDirty) &&
    left.error === right.error;

  const mergeServerProjection = (
    serverNotes: NoteState[],
    volatileNotes: NoteState[],
    pendingChanges: PendingNoteChange[],
    suppressedIds: Set<string>,
  ): NoteState[] => {
    const projection = new Map(
      serverNotes
        .filter((note) => !suppressedIds.has(note.id))
        .map((note) => [note.id, note]),
    );
    for (const note of volatileNotes) projection.set(note.id, note);

    for (const change of pendingChanges) {
      if (change.operation === "delete") {
        projection.delete(change.id);
        continue;
      }
      const existing = projection.get(change.id);
      const pendingNote = existing
        ? normalizeLocalNote({
            ...existing,
            ...(change.groupId !== undefined && { groupId: change.groupId }),
            ...(change.title !== undefined && { title: change.title }),
            ...(change.content !== undefined && { content: change.content }),
            ...(change.tags !== undefined && { tags: change.tags }),
            ...(change.noteType !== undefined && {
              noteType: change.noteType,
            }),
            ...(change.metadata !== undefined && {
              metadata: change.metadata,
            }),
            ...(change.order !== undefined && { order: change.order }),
            updatedAt: new Date(change.updatedAt),
            isDirty: true,
          })
        : noteStateFromPendingChange(change, projection.size);
      projection.set(change.id, pendingNote as NoteState);
    }
    return Array.from(projection.values());
  };

  const runRefreshFromServer = async (): Promise<void> => {
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

      const requestSnapshot = new Map(
        Array.from(notes.value.entries()).map(([id, note]) => [
          id,
          normalizeLocalNote({ ...note }),
        ]),
      );
      const result = await notesApi.getByWorkspace(workspaceId);

      if (!result.success) return;

      await withNotesWorkspaceMutationLock(workspaceId, async () => {
        const pendingAtApply = await pendingQueue.load(workspaceId);
        const currentNotes = new Map(notes.value);
        const concurrentDeletedIds = new Set<string>();
        for (const id of requestSnapshot.keys()) {
          if (!currentNotes.has(id)) concurrentDeletedIds.add(id);
        }
        const pendingUpsertIds = new Set(
          pendingAtApply
            .filter((change) => change.operation === "upsert")
            .map((change) => change.id),
        );
        pendingAtApply
          .filter((change) => change.operation === "delete")
          .forEach((change) => pendingDeleteIds.add(change.id));
        concurrentDeletedIds.forEach((id) => pendingDeleteIds.add(id));

        const volatileNotes = Array.from(currentNotes.values()).filter(
          (note) => {
            const before = requestSnapshot.get(note.id);
            return (
              !before ||
              !sameNoteValue(before, note) ||
              Boolean(note.isDirty) ||
              Boolean(note.error) ||
              /^(temp-|local:)/.test(note.id) ||
              pendingUpsertIds.has(note.id)
            );
          },
        );
        const serverNotes = result.data.map((note) =>
          noteStateFromServer(note),
        );
        const projection = mergeServerProjection(
          serverNotes,
          volatileNotes,
          pendingAtApply,
          pendingDeleteIds,
        );

        // Publish the race-aware projection before the IndexedDB transaction.
        // A keystroke that lands while storage is settling marks its row dirty
        // and is overlaid again below instead of being overwritten.
        notes.value = new Map(projection.map((note) => [note.id, note]));

        let persistedProjection = projection;
        if (localRepository.replaceWorkspaceProjection) {
          persistedProjection =
            await localRepository.replaceWorkspaceProjection(
              workspaceId,
              serverNotes.filter((note) => !pendingDeleteIds.has(note.id)),
              volatileNotes,
            );
        } else {
          const existingLocal =
            await localRepository.loadByWorkspace(workspaceId);
          const desiredIds = new Set(projection.map((note) => note.id));
          await Promise.all(
            existingLocal
              .filter((note) => !desiredIds.has(note.id))
              .map((note) => localRepository.delete(note.id)),
          );
          await localRepository.saveMany(projection);
        }

        const editsDuringPersistence = Array.from(notes.value.values()).filter(
          (note) => note.isDirty || Boolean(note.error),
        );
        const finalProjection = new Map(
          persistedProjection.map((note) => [
            note.id,
            normalizeLocalNote(note) as NoteState,
          ]),
        );
        for (const note of editsDuringPersistence) {
          finalProjection.set(note.id, note);
        }
        notes.value = finalProjection;
        lastSync.value = new Date();
      });
    } finally {
      await refreshLayoutPendingCount();
      loadingStates.value.set(workspaceId, false);
    }
  };

  let refreshPromise: Promise<void> | null = null;
  const refreshFromServer = (): Promise<void> => {
    if (refreshPromise) return refreshPromise;
    const run = runRefreshFromServer().finally(() => {
      if (refreshPromise === run) refreshPromise = null;
    });
    refreshPromise = run;
    return run;
  };

  let syncWithServerPromise: Promise<void> | null = null;
  const syncWithServer = (): Promise<void> => {
    if (syncWithServerPromise) return syncWithServerPromise;
    const run = (async () => {
      await hydrateLocalNotes();

      if (!networkMonitor.isVerifiedOnline.value) return;

      try {
        await refreshFromServer();
      } catch {
        // IDB data from hydrateLocalNotes remains visible.
      }
    })().finally(() => {
      if (syncWithServerPromise === run) syncWithServerPromise = null;
    });
    syncWithServerPromise = run;
    return run;
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
