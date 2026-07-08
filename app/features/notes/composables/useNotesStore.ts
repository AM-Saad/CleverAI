import type { NoteType } from "@@/shared/utils/note.contract";
import type { NoteGroupLayoutItem } from "@@/shared/utils/note-sync.contract";
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
import {
  normalizeLocalNote,
  type NoteState,
} from "./noteTransforms";
import { createIndexedDbNotesConflictRepository } from "./notesConflictRepository";
import {
  createNotesConflictResolver,
  type NotesConflictResolution,
} from "./notesConflictResolver";
import type { NoteSyncConflictRecord } from "~/utils/idb";
import { createNotesErrorPolicy } from "./notesErrorPolicy";
import { createNotesMemoryStore } from "./notesMemoryStore";
import { createNotesCommandService } from "./notesCommandService";
import { createNotesSyncRuntime } from "./notesSyncRuntime";
import { createNotesContentQueue } from "./notesContentQueue";
import {
  registerNotesSyncListenersOnce,
  setActiveNotesWorkspace,
} from "./notesSyncListeners";
import {
  cleanupNotesWorkspaceRuntime,
  useNotesWorkspaceRuntime,
} from "./notesWorkspaceRuntime";

export type { NoteState } from "./noteTransforms";

export interface NotesStore {
  notes: Ref<Map<string, NoteState>>;
  loadingStates: Ref<Map<string, boolean>>;
  lastSync: Ref<Date | null>;
  filteredNoteIds: Ref<Set<string> | null>;
  dirtyCount: ComputedRef<number>;
  layoutPendingCount: Ref<number>;
  layoutStatus: Ref<NotesLayoutStatus>;
  errorCount: ComputedRef<number>;
  applyNoteDraft: (id: string, draft: Partial<Pick<NoteState, "title" | "content" | "metadata">>) => boolean;
  createNote: (content: string, tags?: string[], noteType?: NoteType, metadata?: Record<string, unknown>, title?: string, groupId?: string | null) => Promise<string | null>;
  updateNote: (id: string, updatedNote: NoteState) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  applyLayoutCommand: (command: NotesLayoutCommand) => Promise<boolean>;
  reorderNotes: (reorderedNotes: NoteState[] | Array<{ id: string; groupId: string | null; order: number }>) => Promise<boolean>;
  clearGroup: (groupId: string) => Promise<void>;
  remapGroupIds: (groupIdMap: Record<string, string>) => Promise<void>;
  hydrateLocalNotes: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  syncPendingChanges: () => Promise<boolean>;
  flushDrafts: () => Promise<void>;
  setGroupLayoutProvider: (provider: () => NoteGroupLayoutItem[]) => void;
  refreshLayoutPendingCount: () => Promise<void>;
  retryFailedNote: (id: string) => Promise<boolean>;
  clearNoteError: (id: string) => void;
  getConflict: (id: string) => NoteSyncConflictRecord | null;
  resolveNoteConflict: (id: string, resolution: NotesConflictResolution) => Promise<boolean>;
  isNoteLoading: (id: string) => boolean;
  isNoteDirty: (id: string) => boolean;
  getNote: (id: string) => NoteState | null;
  setNotes?: (notes: NoteState[]) => void;
  setFilteredNoteIds: (ids: Set<string> | null) => void;
  resolveNoteId: (id: string | null) => string | null;
  resetOfflineToast?: () => void;
}

// Global store instance - keyed by workspaceId
const stores = new Map<string, NotesStore>();

/**
 * Creates or returns a notes store for a specific workspace
 * This provides local state management with optimistic updates
 */
export function useNotesStore(workspaceId: string): NotesStore {
  setActiveNotesWorkspace(workspaceId);
  // Return existing store if available
  if (stores.has(workspaceId)) {
    return stores.get(workspaceId)!;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const networkMonitor = useNetworkStatus();
  const workspaceRuntime = useNotesWorkspaceRuntime(workspaceId);
  const localRepository = createIndexedDbNotesLocalRepository();
  const layoutQueue = createIndexedDbNotesLayoutQueue();
  const groupQueue = createIndexedDbNotesGroupQueue();
  const pendingQueue = createIndexedDbNotesPendingQueue();
  const conflictRepository = createIndexedDbNotesConflictRepository();

  // Local reactive state
  const notes = ref<Map<string, NoteState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);
  const filteredNoteIds = ref<Set<string> | null>(null);
  const noteIdAliases = ref<Map<string, string>>(new Map());
  const conflicts = ref<Map<string, NoteSyncConflictRecord>>(new Map());
  const noteValues = computed(() => Array.from(notes.value.values()));
  const memoryStore = createNotesMemoryStore(notes);
  const dirtyCount = computed(() => noteValues.value.filter((note) => note.isDirty).length);
  const layoutPendingCount = ref(0);
  const layoutStatus = ref<NotesLayoutStatus>("idle");
  const errorCount = computed(() => noteValues.value.filter((note) => Boolean(note.error)).length);
  let groupLayoutProvider: () => NoteGroupLayoutItem[] = () =>
    workspaceRuntime.getGroupLayout();
  const setGroupLayoutProvider = (provider: () => NoteGroupLayoutItem[]) => {
    groupLayoutProvider = provider;
  };
  const syncCoordinator = createNotesSyncCoordinator({
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    pendingQueue,
    onNoteIdRemapped: (tempId, serverId) => {
      const nextAliases = new Map(noteIdAliases.value);
      nextAliases.set(tempId, serverId);
      noteIdAliases.value = nextAliases;
    },
  });
  const conflictResolver = createNotesConflictResolver({
    workspaceId,
    notes,
    conflicts,
    conflictRepository,
    pendingQueue,
    localRepository,
  });

  const applyNoteDraft = (
    id: string,
    draft: Partial<Pick<NoteState, "title" | "content" | "metadata">>,
  ): boolean => {
    const note = notes.value.get(id);
    if (!note) return false;

    const nextNote = normalizeLocalNote({
      ...note,
      ...draft,
      updatedAt: new Date(),
    });
    notes.value.set(id, nextNote);
    return true;
  };

  const errorPolicy = createNotesErrorPolicy({ maxAttempts: 4 });
  const resetSyncRetry = () => errorPolicy.reset();
  let syncRuntime: ReturnType<typeof createNotesSyncRuntime>;
  const syncPendingChanges = async (): Promise<boolean> => {
    return syncRuntime.syncPendingChanges("background");
  };
  const scheduleSyncRetry = () => {
    errorPolicy.scheduleRetry({
      workspaceId,
      retry: () => {
        if (networkMonitor.isVerifiedOnline.value) {
          void syncPendingChanges();
        }
      },
      onTerminalFailure: () => {
        toast.add({
          title: "Sync failed",
          description: "4 retries exhausted. Your local notes are still saved. Retry sync or export affected notes.",
          color: "error",
        });
      },
    });
  };
  const contentQueue = createNotesContentQueue({
    workspaceId,
    notes,
    pendingQueue,
    isVerifiedOnline: networkMonitor.isVerifiedOnline,
    requestSync: () => {
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
    },
  });
  const flushDrafts = contentQueue.flushDrafts;
  const queueContentSave = contentQueue.queueContentSave;

  syncRuntime = createNotesSyncRuntime({
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
    networkMonitor: {
      isVerifiedOnline: networkMonitor.isVerifiedOnline,
    },
    notesApi: $api.notes,
    flushDrafts,
    resetSyncRetry,
    scheduleSyncRetry,
    hydrateLocalGroups: () => workspaceRuntime.hydrateLocalGroups(),
  });

  const refreshLayoutPendingCount = () => syncRuntime.refreshLayoutPendingCount();

  let layoutSyncTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleLayoutSync = () => {
    if (layoutSyncTimer) clearTimeout(layoutSyncTimer);
    layoutSyncTimer = setTimeout(async () => {
      layoutSyncTimer = null;
      if (!networkMonitor.isOnline.value) return;
      if (!networkMonitor.isVerifiedOnline.value) {
        const connected = await networkMonitor.waitForConnection(1500);
        if (!connected) return;
      }
      void syncPendingChanges();
    }, 50);
  };

  const layoutController = createNotesLayoutController({
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    getGroupLayout: () => groupLayoutProvider(),
    onLayoutPendingChanged: refreshLayoutPendingCount,
    requestSync: scheduleLayoutSync,
  });

  watch(layoutController.status, (status) => {
    layoutStatus.value = status;
  });

  const commandService = createNotesCommandService({
    memoryStore,
    localRepository,
    pendingQueue,
    layoutController,
    registerBackgroundSync: () => pendingQueue.registerBackgroundSync(),
    requestSync: () => {
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
    },
  });

  workspaceRuntime.registerSyncDrainer((reason) =>
    syncRuntime.syncPendingChanges(reason),
  );

  // Update note content - local-first approach with IndexedDB persistence
  const updateNote = async (
    id: string,
    updatedNote: NoteState
  ): Promise<boolean> => {
    if (conflictResolver.getConflict(id)) {
      toast.add({
        title: "Resolve conflict first",
        description: "Choose local, server, or merge before saving new edits.",
        color: "warning",
      });
      return false;
    }
    return commandService.updateNoteContent({
      id,
      note: updatedNote,
      queueContentSave,
    });
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
    return commandService.createNote({
      workspaceId,
      content,
      tags,
      noteType,
      metadata,
      title,
      groupId,
    });
  };
  // Delete a note - simple optimistic approach
  const deleteNote = async (id: string): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note) return false;

    return commandService.deleteNote({
      id,
      note,
    });
  };

  const applyLayoutCommand = async (command: NotesLayoutCommand): Promise<boolean> => {
    const result = await layoutController.apply(command);
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

  const remapGroupIds = syncRuntime.remapGroupIds;
  const hydrateLocalNotes = syncRuntime.hydrateLocalNotes;
  const refreshFromServer = syncRuntime.refreshFromServer;
  const syncWithServer = syncRuntime.syncWithServer;

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
    if (note.error.includes("Sync conflict detected")) {
      toast.add({
        title: "Resolve conflict first",
        description: "This note has local and server versions. It will not overwrite either side until a conflict choice is made.",
        color: "warning",
      });
      return false;
    }

    // Clear error state and retry with current content
    note.error = null;
    note.isLoading = true;
    notes.value.set(id, note);

    // Retry the save operation
    return await contentQueue.queueContentSaveNow(id, note.content, note.title);
  };

  // Clear error state for a note
  const clearNoteError = (id: string): void => {
    const note = notes.value.get(id);
    if (note) {
      note.error = null;
    }
  };

  const getConflict = (id: string): NoteSyncConflictRecord | null =>
    conflictResolver.getConflict(id);

  const resolveNoteConflict = async (
    id: string,
    resolution: NotesConflictResolution,
  ): Promise<boolean> => {
    const resolved = await conflictResolver.resolveContentConflict(id, resolution);
    if (resolved && resolution === "keep-local" && networkMonitor.isVerifiedOnline.value) {
      void syncPendingChanges();
    }
    return resolved;
  };

  const getNote = (id: string): NoteState => {
    return notes.value.get(id)!;
  };
  const resolveNoteId = syncRuntime.resolveNoteId;
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
  const store: NotesStore = {
    notes,
    loadingStates,
    lastSync,
    dirtyCount,
    layoutPendingCount,
    layoutStatus,
    errorCount,
    flushDrafts,
    filteredNoteIds,
    applyNoteDraft,
    createNote,
    updateNote,
    deleteNote,
    applyLayoutCommand,
    reorderNotes,
    clearGroup,
    remapGroupIds,
    getNote,
    hydrateLocalNotes,
    refreshFromServer,
    syncWithServer,
    syncPendingChanges,
    setGroupLayoutProvider,
    refreshLayoutPendingCount,
    retryFailedNote,
    clearNoteError,
    getConflict,
    resolveNoteConflict,
    isNoteLoading,
    isNoteDirty,
    setNotes,
    setFilteredNoteIds,
    resolveNoteId,
  };

  // Cache the store BEFORE triggering the async sync so that any
  // concurrent call to useNotesStore() for the same workspaceId hits the
  // cache rather than spinning up a second instance and a second network
  // request.
  stores.set(workspaceId, store);
  registerNotesSyncListenersOnce(stores);

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
  cleanupNotesWorkspaceRuntime(workspaceId);
}
