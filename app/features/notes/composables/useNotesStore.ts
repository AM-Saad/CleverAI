import type { Note, NoteType, UpdateNoteDTO } from "@@/shared/utils/note.contract";
import type { NotesSyncResponse } from "@@/shared/utils/note-sync.contract";
import { normalizeWorkspaceNoteTitle } from "@@/shared/utils/workspaceNote";
import { DB_CONFIG, SW_MESSAGE_TYPES } from "~/utils/constants/pwa";
import { evictStalePendingChanges } from "~/utils/idb";
import {
  setupOnlineListener,
  setupSyncCompletionListener,
} from "~/utils/sync/offlineSync";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { createIndexedDbNotesLocalRepository } from "./notesLocalRepository";
import {
  createNotesLayoutController,
  type NotesLayoutCommand,
  type NotesLayoutStatus,
} from "./notesLayoutController";
import { createIndexedDbNotesGroupQueue } from "./notesGroupQueue";
import { createIndexedDbNotesLayoutQueue } from "./notesLayoutQueue";
import { createIndexedDbNotesPendingQueue } from "./notesPendingQueue";
import { createNotesSyncCoordinator } from "./notesSyncCoordinator";
import { logNotesOperation } from "./notesOperationLog";
import {
  normalizeCreateContent,
  normalizeLocalNote,
  noteStateFromServer,
  type NoteState,
} from "./noteTransforms";
import { flushRegisteredNotesDrafts } from "./notesEditorRuntimeState";

export type { NoteState } from "./noteTransforms";

interface NotesStore {
  notes: Ref<Map<string, NoteState>>;
  loadingStates: Ref<Map<string, boolean>>;
  lastSync: Ref<Date | null>;
  filteredNoteIds: Ref<Set<string> | null>;
  dirtyCount: ComputedRef<number>;
  layoutPendingCount: Ref<number>;
  layoutStatus: Ref<NotesLayoutStatus>;
  errorCount: ComputedRef<number>;
  createNote: (content: string, tags?: string[], noteType?: NoteType, metadata?: Record<string, unknown>, title?: string, groupId?: string | null) => Promise<string | null>;
  updateNote: (id: string, updatedNote: NoteState) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  applyLayoutCommand: (command: NotesLayoutCommand) => Promise<boolean>;
  reorderNotes: (reorderedNotes: NoteState[] | Array<{ id: string; groupId: string | null; order: number }>) => Promise<boolean>;
  clearGroup: (groupId: string) => Promise<void>;
  hydrateLocalNotes: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  syncPendingChanges: () => Promise<boolean>;
  refreshLayoutPendingCount: () => Promise<void>;
  retryFailedNote: (id: string) => Promise<boolean>;
  clearNoteError: (id: string) => void;
  isNoteLoading: (id: string) => boolean;
  isNoteDirty: (id: string) => boolean;
  getNote: (id: string) => NoteState | null;
  setNotes?: (notes: NoteState[]) => void;
  setFilteredNoteIds: (ids: Set<string> | null) => void;
  resetOfflineToast?: () => void;
}

// Global store instance - keyed by workspaceId
const stores = new Map<string, NotesStore>();
// Ensure we only wire one 'online' listener for notes sync across the app
let notesOnlineListenerRegistered = false;

/**
 * Creates or returns a notes store for a specific workspace
 * This provides local state management with optimistic updates
 */
export function useNotesStore(workspaceId: string): NotesStore {
  // Return existing store if available
  if (stores.has(workspaceId)) {
    return stores.get(workspaceId)!;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const networkMonitor = useNetworkStatus();
  const localRepository = createIndexedDbNotesLocalRepository();
  const layoutQueue = createIndexedDbNotesLayoutQueue();
  const groupQueue = createIndexedDbNotesGroupQueue();
  const pendingQueue = createIndexedDbNotesPendingQueue();

  // Register once-per-app online listener and sync completion listener.
  if (process.client && !notesOnlineListenerRegistered) {
    // Helper: drain all stores' pending changes directly (client-owned sync).
    const drainAllStoresSync = async () => {
      for (const s of stores.values()) {
        await s.syncPendingChanges();
      }
    };

    // Helper: flush all stores' debounced saves before syncing.
    const flushAllStoresDrafts = async () => {
      await Promise.all(
        Array.from(stores.values()).map((s) => (s as any)._flushDebounce?.()),
      );
    };

    setupOnlineListener({
      pendingStoreName: DB_CONFIG.STORES.PENDING_NOTES,
      swMessageType: SW_MESSAGE_TYPES.SYNC_NOTES,
      onOnline: () => {
        // Obsolete: resetOfflineToast no longer needed, using global toast deduplication
      },
      // Step 1 of reconnect: flush all debounced saves so the latest edit
      // is written to PENDING_NOTES before the SW reads them.
      onBeforeSync: flushAllStoresDrafts,
      // Step 3 of reconnect: client-owned sync (bypasses SW to avoid dual-sync race).
      onSyncDirect: drainAllStoresSync,
    });

    setupOnlineListener({
      pendingStoreName: DB_CONFIG.STORES.PENDING_NOTE_LAYOUTS,
      swMessageType: SW_MESSAGE_TYPES.SYNC_NOTES,
      onBeforeSync: flushAllStoresDrafts,
      onSyncDirect: drainAllStoresSync,
    });

    setupOnlineListener({
      pendingStoreName: DB_CONFIG.STORES.PENDING_NOTE_GROUP_CHANGES,
      swMessageType: SW_MESSAGE_TYPES.SYNC_NOTES,
      onBeforeSync: flushAllStoresDrafts,
      onSyncDirect: drainAllStoresSync,
    });

    // Guard: avoid re-entrant sync cycles (SW synced → syncWithServer → triggers another sync → ...).
    let notesSyncRefreshing = false;

    setupSyncCompletionListener({
      messageType: SW_MESSAGE_TYPES.NOTES_SYNCED,
      onSynced: async (appliedCount: number) => {
        if (notesSyncRefreshing) return; // prevent re-entry
        notesSyncRefreshing = true;
        try {
          // Hydrate from IDB only, rather than triggering a full server refetch and loader.
          for (const s of stores.values()) {
            await (s as any).hydrateLocalNotes?.();
          }
        } finally {
          notesSyncRefreshing = false;
        }
      },
    });

    notesOnlineListenerRegistered = true;
  }

  // (Removed offline toast deduplication state)

  const { debouncedFunc: debouncedSave, flush: flushSave, isWaiting: isSaveWaiting } = useDebounce(
    (id: string, content: string, title?: string) => {
      updateNoteToServer(id, content, title);
    },
    1000
  );

  // Expose flush so the online listener can call it before sync
  const _flushDebounce = async () => {
    await flushRegisteredNotesDrafts();
    if (!isSaveWaiting.value) return; // Breaks recursive loop!
    
    // flush() calls the underlying fn immediately and cancels the timer
    const dirtyNotes = Array.from(notes.value.values()).filter(n => n.isDirty);
    await Promise.allSettled(dirtyNotes.map((n) => Promise.resolve(flushSave(n.id, n.content, n.title))));
  };

  // Local reactive state
  const notes = ref<Map<string, NoteState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);
  const filteredNoteIds = ref<Set<string> | null>(null);
  const noteValues = computed(() => Array.from(notes.value.values()));
  const dirtyCount = computed(() => noteValues.value.filter((note) => note.isDirty).length);
  const layoutPendingCount = ref(0);
  const layoutStatus = ref<NotesLayoutStatus>("idle");
  const errorCount = computed(() => noteValues.value.filter((note) => Boolean(note.error)).length);
  const syncCoordinator = createNotesSyncCoordinator({
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    pendingQueue,
  });

  // Debounced server sync to reduce API calls during typing
  const saveToServer = async (id: string, content: string, title?: string) => {
    debouncedSave(id, content, title);
  };

  const refreshLayoutPendingCount = async () => {
    const pendingLayout = await layoutQueue.load(workspaceId);
    layoutPendingCount.value = pendingLayout ? 1 : 0;
    if (pendingLayout && layoutStatus.value === "idle") {
      layoutStatus.value = "queued";
    }
  };

  let layoutSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleLayoutSync = () => {
    console.log(`🔍 [TRACE:SYNC] scheduleLayoutSync called`, { isOnline: networkMonitor.isOnline.value, isVerifiedOnline: networkMonitor.isVerifiedOnline.value });
    if (layoutSyncTimer) clearTimeout(layoutSyncTimer);
    layoutSyncTimer = setTimeout(async () => {
      layoutSyncTimer = null;
      if (!networkMonitor.isOnline.value) { console.log(`🔍 [TRACE:SYNC] scheduleLayoutSync ABORTED — offline`); return; }
      if (!networkMonitor.isVerifiedOnline.value) {
        console.log(`🔍 [TRACE:SYNC] scheduleLayoutSync — waiting for verified online...`);
        const connected = await networkMonitor.waitForConnection(1500);
        if (!connected) { console.log(`🔍 [TRACE:SYNC] scheduleLayoutSync ABORTED — connection verification failed`); return; }
      }
      console.log(`🔍 [TRACE:SYNC] scheduleLayoutSync — calling syncPendingChanges()`);
      void syncPendingChanges();
    }, 500);
  };

  const layoutController = createNotesLayoutController({
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    getGroupLayout: () => [],
    onLayoutPendingChanged: refreshLayoutPendingCount,
    requestSync: scheduleLayoutSync,
  });

  watch(layoutController.status, (status) => {
    layoutStatus.value = status;
  });

  // ── Sync retry with exponential backoff ──
  const syncRetry = {
    attempts: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 60_000,
    jitterPct: 0.2,
  };
  const calcRetryDelay = () => {
    const raw = Math.min(
      syncRetry.baseDelay * Math.pow(2, syncRetry.attempts),
      syncRetry.maxDelay,
    );
    const jitter = raw * syncRetry.jitterPct * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(raw + jitter));
  };
  const resetSyncRetry = () => {
    syncRetry.attempts = 0;
    if (syncRetry.timer) {
      clearTimeout(syncRetry.timer);
      syncRetry.timer = null;
    }
  };
  const scheduleSyncRetry = () => {
    if (syncRetry.attempts >= syncRetry.maxAttempts) {
      toast.add({
        title: "Sync failed",
        description: `${syncRetry.maxAttempts} retries exhausted. Tap to retry manually.`,
        color: "error",
      });
      return;
    }
    const delay = calcRetryDelay();
    syncRetry.attempts++;
    logNotesOperation("sync-failure", {
      workspaceId,
      reason: "scheduling-retry",
      attempt: syncRetry.attempts,
      delay,
    });
    syncRetry.timer = setTimeout(() => {
      syncRetry.timer = null;
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
    }, delay);
  };

  const syncPendingChanges = async (): Promise<boolean> => {
    console.log(`🔍 [TRACE:SYNC] syncPendingChanges START`);
    await _flushDebounce();

    if (!networkMonitor.isVerifiedOnline.value) {
      console.log(`🔍 [TRACE:SYNC] syncPendingChanges ABORTED — not verified online`);
      await refreshLayoutPendingCount();
      return false;
    }

    const pendingChanges = await pendingQueue.load(workspaceId);
    const pendingGroupChanges = await groupQueue.load(workspaceId);
    const pendingLayout = await layoutQueue.load(workspaceId);
    console.log(`🔍 [TRACE:SYNC] syncPendingChanges loaded queues`, {
      pendingChanges: pendingChanges.length,
      pendingGroupChanges: pendingGroupChanges.length,
      pendingLayout: pendingLayout ? { notes: pendingLayout.notes?.length, groups: pendingLayout.groups?.length } : null,
    });
    if (!pendingChanges.length && !pendingGroupChanges.length && !pendingLayout) {
      console.log(`🔍 [TRACE:SYNC] syncPendingChanges — nothing to sync`);
      layoutPendingCount.value = 0;
      layoutStatus.value = "synced";
      resetSyncRetry();
      return true;
    }

    // Hybrid Online Sync: if we have EXACTLY ONE content upsert, NO group/layout changes, and a non-temporary ID,
    // call PATCH /api/notes/[id] directly instead of the heavier /api/notes/sync.
    const change = pendingChanges[0];
    const isTempId = change?.id?.startsWith("temp-");
    if (
      change &&
      !pendingGroupChanges.length &&
      !pendingLayout &&
      pendingChanges.length === 1 &&
      change.operation === "upsert" &&
      !isTempId
    ) {
      console.log(`🔍 [TRACE:SYNC] syncPendingChanges — executing hybrid direct PATCH for note ${change.id}`);
      const updatePayload: UpdateNoteDTO = {
        title: change.title,
        content: change.content,
        groupId: change.groupId,
        tags: change.tags,
        noteType: change.noteType as NoteType | undefined,
        metadata: change.metadata as Record<string, unknown> | undefined,
      };

      const patchResult = await $api.notes.update(change.id, updatePayload);
      if (!patchResult.success) {
        console.error(`🔍 [TRACE:SYNC] syncPendingChanges direct PATCH FAILED`, { error: patchResult.error });
        logNotesOperation("sync-failure", {
          workspaceId,
          reason: "notes-patch-api-failed",
        });
        scheduleSyncRetry();
        return false;
      }

      console.log(`🔍 [TRACE:SYNC] syncPendingChanges direct PATCH SUCCESS`, { noteId: change.id });
      resetSyncRetry();

      // Construct a mock sync response to update local versions and clean state
      const serverNote = patchResult.data;
      const syncResult: NotesSyncResponse = {
        applied: [change.id],
        conflicts: [],
        idMap: {},
        noteIdMap: {},
        groupApplied: [],
        groupConflicts: [],
        groupIdMap: {},
        errors: [],
        layoutApplied: false,
        layoutConflict: false,
      };

      await syncCoordinator.applySyncResult(syncResult);

      // Update note version locally to match server's newly incremented version
      const note = notes.value.get(change.id);
      if (note && serverNote) {
        note.version = serverNote.version;
        await localRepository.save(note);
      }

      await pendingQueue.remove([change.id]);
      await refreshLayoutPendingCount();
      lastSync.value = new Date();

      logNotesOperation("sync-success", {
        workspaceId,
        applied: 1,
        groupApplied: 0,
        layoutApplied: false,
        layoutConflict: false,
      });
      return true;
    }

    logNotesOperation("sync-start", {
      workspaceId,
      contentChanges: pendingChanges.length,
      groupChanges: pendingGroupChanges.length,
      layout: Boolean(pendingLayout),
    });
    if (pendingLayout) layoutStatus.value = "syncing";

    console.log(`🔍 [TRACE:SYNC] syncPendingChanges — calling $api.notes.sync()`);
    const result = await $api.notes.sync({
      changes: pendingChanges,
      contentChanges: [],
      groupChanges: pendingGroupChanges,
      ...(pendingLayout && { layoutChange: pendingLayout }),
    });
    if (!result.success) {
      console.error(`🔍 [TRACE:SYNC] syncPendingChanges API FAILED`, { error: result.error });
      await refreshLayoutPendingCount();
      if (pendingLayout) layoutStatus.value = "failed";
      logNotesOperation("sync-failure", {
        workspaceId,
        reason: "notes-sync-api-failed",
      });
      scheduleSyncRetry();
      return false;
    }

    console.log(`🔍 [TRACE:SYNC] syncPendingChanges API SUCCESS`, {
      applied: result.data.applied,
      groupApplied: result.data.groupApplied,
      layoutApplied: result.data.layoutApplied,
      layoutConflict: result.data.layoutConflict,
      errors: result.data.errors,
    });

    // Success — reset retry state
    resetSyncRetry();

    await syncCoordinator.applySyncResult(result.data);
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
    return !result.data.layoutConflict;
  };

  // Queue note changes for the single sync engine. Online state only decides
  // whether we schedule a background drain, never whether the local save exists.
  const updateNoteToServer = async (
    id: string,
    content: string,
    title?: string,
  ): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note) return false;
    const resolvedTitle = normalizeWorkspaceNoteTitle(title ?? note.title, content);

    try {
      note.isLoading = true;
      note.error = null;
      await pendingQueue.add({
        id,
        operation: "upsert",
        updatedAt: Date.now(),
        localVersion: (note as any).localVersion
          ? (note as any).localVersion + 1
          : 1,
        serverVersion: note.version,
        workspaceId: note.workspaceId,
        groupId: note.groupId ?? null,
        title: resolvedTitle,
        content,
        tags: note.tags,
        noteType: (note as any).noteType,
        metadata: (note as any).metadata,
      });
      if (!networkMonitor.isVerifiedOnline.value) {
        await pendingQueue.registerBackgroundSync();
      }
      logNotesOperation("content-queued", { workspaceId: note.workspaceId, id });
      note.isLoading = false;
      note.isDirty = true;
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
      return true;
    } catch {
      note.isLoading = false;
      note.error = "Failed to save note locally";
      return false;
    }
  };

  // Update note content - local-first approach with IndexedDB persistence
  const updateNote = async (
    id: string,
    updatedNote: NoteState
  ): Promise<boolean> => {
    // Step 1: Optimistic update
    const nextNote = normalizeLocalNote({
      ...updatedNote,
      updatedAt: new Date(),
      isDirty: true,
    });
    notes.value.set(id, nextNote);
    // Persist locally immediately for offline continuity
    try {
      await localRepository.save(nextNote);
    } catch { }
    // Step 2: Debounced server sync
    saveToServer(id, nextNote.content, nextNote.title);
    return true;
  };

  // Create a new note - simple optimistic approach
  const createNote = async (
    content: string,
    tags: string[] = [],
    noteType: NoteType = "TEXT",
    metadata?: Record<string, unknown>,
    title?: string,
    groupId?: string | null,
  ): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;
    const resolvedContent = normalizeCreateContent(content, noteType);
    const resolvedTitle = normalizeWorkspaceNoteTitle(title, resolvedContent);
    const resolvedGroupId = groupId ?? null;
    const nextOrder = Array.from(notes.value.values()).filter(
      (note) => (note.groupId ?? null) === resolvedGroupId,
    ).length;

    // Add optimistic note
    const optimisticNote: NoteState = normalizeLocalNote({
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
      isLoading: true,
      isDirty: false,
      error: null,
    });

    // Save to IndexedDB first for persistence
    await localRepository.save(optimisticNote);
    notes.value.set(tempId, optimisticNote);

    await pendingQueue.add({
      id: tempId,
      operation: "upsert",
      updatedAt: Date.now(),
      localVersion: 1,
      workspaceId,
      groupId: resolvedGroupId,
      title: resolvedTitle,
      content: resolvedContent,
      tags,
      noteType,
      metadata,
    });
    await pendingQueue.registerBackgroundSync();

    optimisticNote.isLoading = false;
    optimisticNote.isDirty = true;
    notes.value.set(tempId, optimisticNote);

    if (networkMonitor.isVerifiedOnline.value) {
      void syncPendingChanges();
    }
    return tempId;
  };
  // Delete a note - simple optimistic approach
  const deleteNote = async (id: string): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note) return false;

    // Optimistic removal from reactive state
    notes.value.delete(id);
    await localRepository.delete(id);

    await pendingQueue.add({
      id,
      operation: "delete",
      updatedAt: Date.now(),
      localVersion: 1,
      serverVersion: note.version,
      workspaceId: note.workspaceId,
    });
    await pendingQueue.registerBackgroundSync();

    if (networkMonitor.isVerifiedOnline.value) {
      void syncPendingChanges();
    }
    return true;
  };

  const applyLayoutCommand = async (command: NotesLayoutCommand): Promise<boolean> => {
    console.log(`🔍 [TRACE:REORDER] store.applyLayoutCommand`, { type: command.type });
    const result = await layoutController.apply(command);
    console.log(`🔍 [TRACE:REORDER] store.applyLayoutCommand result`, { result });
    if (!result) {
      toast.add({
        title: "Layout not saved",
        description: "The note order could not be saved locally.",
        color: "error",
      });
    }
    return result;
  };

  // Compatibility entrypoint. New UI paths emit layout items, not full notes.
  const reorderNotes = async (
    reorderedNotes: NoteState[] | Array<{ id: string; groupId: string | null; order: number }>,
  ): Promise<boolean> => {
    console.log(`🔍 [TRACE:REORDER] store.reorderNotes called`, { count: reorderedNotes.length });
    return applyLayoutCommand({
      type: "APPLY_NOTE_LAYOUT",
      notes: reorderedNotes.map((note) => ({
        id: note.id,
        groupId: note.groupId ?? null,
        order: note.order,
      })),
    });
  };

  const clearGroup = async (groupId: string): Promise<void> => {
    const nextLayout = Array.from(notes.value.values()).map((note) => ({
      id: note.id,
      groupId: note.groupId === groupId ? null : (note.groupId ?? null),
      order: note.order,
    }));
    await layoutController.queueNoteLayout(nextLayout);
  };

  const hydrateLocalNotes = async (): Promise<void> => {
    try {
      // Evict stale/excess pending changes once per session during first hydration
      await evictStalePendingChanges();
      await syncCoordinator.hydrateFromLocalState();
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
      const hadPendingChanges = (await pendingQueue.load(workspaceId)).length > 0;
      const hadPendingGroups = (await groupQueue.load(workspaceId)).length > 0;
      const hadPendingLayout = Boolean(await layoutQueue.load(workspaceId));
      const pendingSynced = await syncPendingChanges();
      const remainingChanges = await pendingQueue.load(workspaceId);
      const remainingGroups = await groupQueue.load(workspaceId);
      const remainingLayout = await layoutQueue.load(workspaceId);

      if (
        (hadPendingChanges || hadPendingGroups || hadPendingLayout) &&
        (!pendingSynced || remainingChanges.length > 0 || remainingGroups.length > 0 || remainingLayout)
      ) {
        return;
      }

      const pendingAfterSync = new Set(
        remainingChanges.map((change) => change.id),
      );

      const result = await $api.notes.getByWorkspace(workspaceId);

      if (!result.success) return;

      // Preserve only unresolved temp notes that still have pending sync work.
      const tempNotes = Array.from(notes.value.values()).filter((n) =>
        n.id.startsWith("temp-") && pendingAfterSync.has(n.id)
      );

      // Preserve dirty in-progress edits; server data may be stale relative to IDB.
      const dirtyNotes = new Map<string, NoteState>();
      for (const [id, note] of notes.value) {
        if (note.isDirty && !id.startsWith("temp-")) {
          dirtyNotes.set(id, note);
        }
      }

      const noteStates: NoteState[] = result.data.map((note: Note) =>
        noteStateFromServer(note)
      );

      notes.value.clear();
      noteStates.forEach((ns) => {
        const dirty = dirtyNotes.get(ns.id);
        notes.value.set(ns.id, dirty ?? ns);
      });

      for (const tempNote of tempNotes) {
        notes.value.set(tempNote.id, tempNote);
      }

      await localRepository.saveMany(noteStates.filter(ns => !dirtyNotes.has(ns.id)));

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

  // Manual full sync: hydrate local first, then drain pending work and refresh.
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

  // Utility functions
  const isNoteLoading = (id: string): boolean => {
    return notes.value.get(id)?.isLoading ?? false;
  };

  // Check if workspace-level notes are being fetched
  // Note: workspace-level loading state is exposed via `loadingStates` ref

  const isNoteDirty = (id: string): boolean => {
    return notes.value.get(id)?.isDirty ?? false;
  };

  // Retry a failed note save operation
  const retryFailedNote = async (id: string): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note || !note.error) return false;

    // Clear error state and retry with current content
    note.error = null;
    note.isLoading = true;
    notes.value.set(id, note);

    // Retry the save operation
    return await updateNoteToServer(id, note.content, note.title);
  };

  // Clear error state for a note
  const clearNoteError = (id: string): void => {
    const note = notes.value.get(id);
    if (note) {
      note.error = null;
    }
  };

  const getNote = (id: string): NoteState => {
    return notes.value.get(id)!;
  };
  const setNotes = (newNotes: NoteState[]) => {
    notes.value.clear();
    newNotes.forEach((note) => {
      notes.value.set(note.id, normalizeLocalNote(note));
    });
  };

  // Filter management
  const setFilteredNoteIds = (ids: Set<string> | null) => {
    filteredNoteIds.value = ids;
  };

  const isNoteInFilter = (id: string): boolean => {
    // If no filter is active, all notes match
    if (!filteredNoteIds.value) return true;
    // Otherwise check if note ID is in the filtered set
    return filteredNoteIds.value.has(id);
  };

  // Create store instance
  const store: NotesStore & { _flushDebounce?: () => Promise<void> } = {
    notes,
    loadingStates,
    lastSync,
    dirtyCount,
    layoutPendingCount,
    layoutStatus,
    errorCount,
    _flushDebounce,
    filteredNoteIds,
    createNote,
    updateNote,
    deleteNote,
    applyLayoutCommand,
    reorderNotes,
    clearGroup,
    getNote,
    hydrateLocalNotes,
    refreshFromServer,
    syncWithServer,
    syncPendingChanges,
    refreshLayoutPendingCount,
    retryFailedNote,
    clearNoteError,
    isNoteLoading,
    isNoteDirty,
    setNotes,
    setFilteredNoteIds,
  };

  // Cache the store BEFORE triggering the async sync so that any
  // concurrent call to useNotesStore() for the same workspaceId hits the
  // cache rather than spinning up a second instance and a second network
  // request.
  stores.set(workspaceId, store);

  // Defer local hydration to the mounting phase so that:
  //  1. The cache entry is already set (race condition above is avoided).
  //  2. The composable can be called outside a component (e.g. in a Pinia
  //     action or test) without triggering a spurious server round-trip.
  if (getCurrentInstance()) {
    onMounted(() => {
      void hydrateLocalNotes();
    });
  } else {
    // Called outside a component – caller is responsible for triggering sync
    // (e.g. via store.syncWithServer()) at the appropriate time.
  }

  return store;
}

/**
 * Clean up store when workspace is no longer needed
 */
export function cleanupNotesStore(workspaceId: string): void {
  stores.delete(workspaceId);
}
