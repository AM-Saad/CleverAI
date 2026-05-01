import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import { DB_CONFIG, SW_MESSAGE_TYPES } from "~/utils/constants/pwa";
import {
  saveNoteToIndexedDB,
  saveNotesToIndexedDB,
  loadNotesFromIndexedDB,
  deleteNoteFromIndexedDB,
  queueNoteChange,
  loadPendingNoteChanges,
  loadBoardNotesFromIndexedDB,
} from "~/utils/idb";
import {
  createOfflineToastState,
  registerNotesSync,
  setupOnlineListener,
  setupSyncCompletionListener,
} from "~/utils/sync/offlineSync";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";

export interface NoteState extends Note {
  // Local state tracking
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
  isInFilteredList?: boolean;
}

interface NotesStore {
  notes: Ref<Map<string, NoteState>>;
  loadingStates: Ref<Map<string, boolean>>;
  filteredNoteIds: Ref<Set<string> | null>;
  createNote: (content: string, tags?: string[], noteType?: string, metadata?: Record<string, unknown>) => Promise<string | null>;
  updateNote: (id: string, updatedNote: NoteState) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  reorderNotes: (reorderedNotes: NoteState[]) => Promise<boolean>;
  syncWithServer: () => Promise<void>;
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
  const { handleOfflineSubmit } = useOffline();
  const networkMonitor = useNetworkStatus();

  // Register once-per-app online listener and sync completion listener.
  if (process.client && !notesOnlineListenerRegistered) {
    setupOnlineListener({
      pendingStoreName: DB_CONFIG.STORES.PENDING_NOTES,
      swMessageType: SW_MESSAGE_TYPES.SYNC_NOTES,
      onOnline: () => {
        // Obsolete: resetOfflineToast no longer needed, using global toast deduplication
      },
      // Step 1 of reconnect: flush all debounced saves so the latest edit
      // is written to PENDING_NOTES before the SW reads them.
      onBeforeSync: async () => {
        for (const s of stores.values()) {
          (s as any)._flushDebounce?.();
        }
        // Brief yield to let IDB transactions complete
        await new Promise((r) => setTimeout(r, 50));
      },
    });

    // Guard: avoid re-entrant sync cycles (SW synced → syncWithServer → triggers another sync → ...).
    let notesSyncRefreshing = false;

    setupSyncCompletionListener({
      messageType: SW_MESSAGE_TYPES.NOTES_SYNCED,
      onSynced: async (appliedCount: number) => {
        if (notesSyncRefreshing) return; // prevent re-entry
        notesSyncRefreshing = true;
        try {
          // BUG-7 fix: always re-sync ALL stores after a successful background sync,
          // not just those with temp notes. This clears isDirty flags and refreshes data.
          for (const s of stores.values()) {
            await s.syncWithServer();
          }
        } finally {
          notesSyncRefreshing = false;
        }
      },
    });

    notesOnlineListenerRegistered = true;
  }

  // (Removed offline toast deduplication state)

  const { debouncedFunc: debouncedSave, cancel: cancelSave, flush: flushSave } = useDebounce(
    (id: string, content: string) => {
      updateNoteToServer(id, content);
    },
    1000
  );

  // Expose flush so the online listener can call it before sync
  const _flushDebounce = () => {
    // flush() calls the underlying fn immediately and cancels the timer
    const dirtyNotes = Array.from(notes.value.values()).filter(n => n.isDirty);
    for (const n of dirtyNotes) {
      flushSave(n.id, n.content);
    }
  };

  // Local reactive state
  const notes = ref<Map<string, NoteState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);
  const filteredNoteIds = ref<Set<string> | null>(null);

  // Debounced server sync to reduce API calls during typing
  const saveToServer = async (id: string, content: string) => {
    debouncedSave(id, content);
  };

  // Simple offline sync - only when actually offline
  const queueForOfflineSync = (
    type: FormSyncType,
    payload: any,
    formId: string
  ) => {
    if (!networkMonitor.isVerifiedOnline.value) {
      handleOfflineSubmit({
        payload,
        storeName: DB_CONFIG.STORES.FORMS,
        type,
        formId,
      });
    }
  };

  // Sync note changes to server (local-first approach)
  const updateNoteToServer = async (
    id: string,
    content: string
  ): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note) return false;

    // Helper: queue a pending change for offline sync and show a single toast.
    const queueOfflineUpdate = async () => {
      await queueNoteChange({
        id,
        operation: "upsert",
        updatedAt: Date.now(),
        localVersion: (note as any).localVersion
          ? (note as any).localVersion + 1
          : 1,
        workspaceId: note.workspaceId,
        content,
        tags: note.tags,
        noteType: (note as any).noteType,
        metadata: (note as any).metadata,
      });
      await registerNotesSync();
      note.isLoading = false;
      note.isDirty = true;
    };

    try {
      note.isLoading = true;
      note.error = null;

      // Early offline guard — queue immediately without hitting the network.
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueOfflineUpdate();
        return true;
      }

      // If this is a temp note (created offline or not yet synced), create it on server instead
      if (id.startsWith("temp-")) {
        const createResult: Result<Note, APIError> = await $api.notes.create({
          workspaceId: note.workspaceId,
          content,
          tags: note.tags || [],
          noteType: (note as any).noteType || "TEXT",
          metadata: (note as any).metadata,
        });

        if (createResult.success) {
          notes.value.delete(id);
          await deleteNoteFromIndexedDB(id);

          const serverNote: NoteState = {
            ...createResult.data,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          };
          notes.value.set(createResult.data.id, serverNote);
          await saveNoteToIndexedDB(serverNote);
          return true;
        }

        // Network error from FetchFactory — queue for offline sync.
        if (createResult.error?.code === "FETCH_ERROR" || createResult.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
          await queueOfflineUpdate();
          return true;
        }

        note.isLoading = false;
        note.error = "Failed to sync note to server";
        return false;
      }

      // Attempt to submit to server (normal update for real IDs)
      const result: Result<Note, APIError> = await $api.notes.update(id, {
        content,
        tags: note.tags,
        ...((note as any).noteType && { noteType: (note as any).noteType }),
        ...((note as any).metadata && { metadata: (note as any).metadata }),
      });

      if (result.success) {
        note.isLoading = false;
        note.isDirty = false;
        note.lastSaved = new Date();
        return true;
      }

      // FetchFactory wraps network failures as FETCH_ERROR / TIMEOUT — treat
      // them identically to being offline: queue for background sync.
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
        await queueOfflineUpdate();
        return true;
      }

      // Genuine server rejection (e.g. 400/403/500 with a body) — surface it.
      note.isLoading = false;
      note.error = "Server rejected update";
      return false;
    } catch {
      // Unexpected error (e.g. IDB failure) — queue if possibly offline.
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueOfflineUpdate();
        return true;
      }
      note.isLoading = false;
      return false;
    }
  };

  // Update note content - local-first approach with IndexedDB persistence
  const updateNote = async (
    id: string,
    updatedNote: NoteState
  ): Promise<boolean> => {
    // Step 1: Optimistic update
    updatedNote.updatedAt = new Date();
    updatedNote.isDirty = true;
    notes.value.set(id, updatedNote);
    // Persist locally immediately for offline continuity
    try {
      await saveNoteToIndexedDB(updatedNote);
    } catch { }
    // Step 2: Debounced server sync
    saveToServer(id, updatedNote.content);
    return true;
  };

  // Create a new note - simple optimistic approach
  const createNote = async (
    content: string,
    tags: string[] = [],
    noteType: string = "TEXT",
    metadata?: Record<string, unknown>
  ): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;

    // Add optimistic note
    const optimisticNote: NoteState = {
      id: tempId,
      workspaceId,
      content,
      tags,
      order: notes.value.size, // Add to end of list
      noteType,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: true,
      isDirty: false,
      error: null,
    };

    // Save to IndexedDB first for persistence
    await saveNoteToIndexedDB(optimisticNote);
    notes.value.set(tempId, optimisticNote);

    // Check if offline BEFORE attempting API call
    if (!networkMonitor.isVerifiedOnline.value) {
      await queueNoteChange({
        id: tempId,
        operation: "upsert",
        updatedAt: Date.now(),
        localVersion: 1,
        workspaceId,
        content,
        tags,
        noteType,
        metadata,
      });
      await registerNotesSync();

      // Update optimistic note state
      optimisticNote.isLoading = false;
      optimisticNote.isDirty = true;
      notes.value.set(tempId, optimisticNote);

      // Offline toast handled globally by NetworkStatusIndicator/App.vue
      return tempId;
    }

    try {
      // Attempt to submit to server
      const result = await $api.notes.create({
        workspaceId,
        content,
        tags,
        noteType,
        metadata,
      });

      if (result.success) {
        // Server success - replace temp note with real note
        notes.value.delete(tempId);
        await deleteNoteFromIndexedDB(tempId);

        const serverNote: NoteState = {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        };
        notes.value.set(result.data.id, serverNote);
        await saveNoteToIndexedDB(serverNote);
        return result.data.id;
      }

      // FetchFactory network error — queue for offline sync silently.
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
        await queueNoteChange({
          id: tempId,
          operation: "upsert",
          updatedAt: Date.now(),
          localVersion: 1,
          workspaceId,
          content,
          tags,
          noteType,
          metadata,
        });
        await registerNotesSync();
        optimisticNote.isLoading = false;
        optimisticNote.isDirty = true;
        notes.value.set(tempId, optimisticNote);
        return tempId;
      }

      // Genuine server rejection
      const note = notes.value.get(tempId);
      if (note) {
        note.isLoading = false;
        note.error = "Server rejected note creation";
        notes.value.set(tempId, note);
      }
      toast.add({
        title: "Server Error",
        description: "Server rejected note creation. Note saved locally.",
        color: "error",
      });
      return tempId;
    } catch {
      // Unexpected error — if offline, queue; else remove optimistic note.
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueNoteChange({
          id: tempId,
          operation: "upsert",
          updatedAt: Date.now(),
          localVersion: 1,
          workspaceId,
          content,
          tags,
          noteType,
          metadata,
        });
        await registerNotesSync();
        optimisticNote.isLoading = false;
        optimisticNote.isDirty = true;
        notes.value.set(tempId, optimisticNote);
        return tempId;
      }
      notes.value.delete(tempId);
      await deleteNoteFromIndexedDB(tempId);
      toast.add({
        title: "Error",
        description: "Failed to create note - check your connection",
        color: "error",
      });
      return null;
    }
  };
  // Delete a note - simple optimistic approach
  const deleteNote = async (id: string): Promise<boolean> => {
    const note = notes.value.get(id);
    if (!note) return false;

    // Optimistic removal from reactive state
    notes.value.delete(id);
    await deleteNoteFromIndexedDB(id);

    // If already offline, queue delete immediately — don't attempt fetch.
    if (!networkMonitor.isVerifiedOnline.value) {
      await queueNoteChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
      await registerNotesSync();
      return true;
    }

    try {
      const result: Result<unknown, APIError> = await $api.notes.delete(id);

      if (result.success) return true;

      // Network error from FetchFactory — queue for background sync.
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
        await queueNoteChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
        await registerNotesSync();
        return true;
      }

      // Genuine server rejection — restore the note.
      const restoredNote = { ...note, isLoading: false, error: "Server rejected deletion" };
      notes.value.set(id, restoredNote);
      await saveNoteToIndexedDB(restoredNote);
      toast.add({ title: "Server Error", description: "Server rejected deletion. Note restored.", color: "error" });
      return false;
    } catch {
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueNoteChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
        await registerNotesSync();
        return true;
      }
      // Restore note on unknown error
      notes.value.set(id, { ...note, isLoading: false });
      await saveNoteToIndexedDB(note);
      toast.add({ title: "Error", description: "Failed to delete note - check your connection", color: "error" });
      return false;
    }
  };

  // Reorder notes - optimistic approach with rollback on failure
  const reorderNotes = async (
    reorderedNotes: NoteState[]
  ): Promise<boolean> => {
    try {
      // Store original order for rollback
      const originalNotes = new Map(notes.value);

      // Optimistic update - update order in reactive state immediately
      reorderedNotes.forEach((note, index) => {
        const existingNote = notes.value.get(note.id);
        if (existingNote) {
          existingNote.order = index;
          notes.value.set(note.id, existingNote);
        }
      });

      // Prepare payload for server
      const payload = {
        workspaceId,
        noteOrders: reorderedNotes.map((note, index) => ({
          id: note.id,
          order: index,
        })),
      };

      // Save to IndexedDB for persistence
      await saveNotesToIndexedDB(Array.from(notes.value.values()));

      const result = await $api.notes.reorder(payload);

      if (result.success) {
        // Server success - update with confirmed data
        notes.value.clear();
        result.data.forEach((note: Note) => {
          notes.value.set(note.id, {
            ...note,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          });
        });
        return true;
      } else {
        // Server rejected - rollback to original order
        notes.value = originalNotes;

        // Restore original order in IndexedDB
        await saveNotesToIndexedDB(Array.from(originalNotes.values()));

        toast.add({
          title: "Server Error",
          description: "Server rejected reordering. Order restored.",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Only show offline message if actually offline
      if (!networkMonitor.isVerifiedOnline.value) {
        toast.add({
          title: "Offline",
          description: "Note order saved locally. Will sync when online.",
          color: "warning",
        });
        return true;
      } else {
        toast.add({
          title: "Error",
          description: "Failed to reorder notes - check your connection",
          color: "error",
        });
        return false;
      }
    }
  };

  // Load notes from server with IndexedDB fallback
  const syncWithServer = async (): Promise<void> => {
    loadingStates.value.set(workspaceId, true);

    // IDB-first: always hydrate from local storage before the network attempt
    // so that an offline reload immediately shows the user's last-known data.
    try { await hydrateFromIDB(); } catch { /* ignore — navbar pill shows offline */ }

    // BUG-1 fix: if we're not verified online, stop here.
    // The SW's cached API response is stale server data that would overwrite
    // the fresher IDB data we just hydrated. Let IDB be the source of truth
    // until real connectivity is confirmed.
    if (!networkMonitor.isVerifiedOnline.value) {
      loadingStates.value.set(workspaceId, false);
      return;
    }

    try {
      const result = await $api.notes.getByWorkspace(workspaceId);

      if (result.success) {
        // Preserve any temp (offline-created) notes so they aren't lost.
        const tempNotes = Array.from(notes.value.values()).filter(n =>
          n.id.startsWith("temp-")
        );

        // BUG-5 fix: preserve any dirty (in-progress edit) notes.
        // Dirty notes have unsaved local changes that should not be overwritten
        // by the (potentially stale) server response.
        const dirtyNotes = new Map<string, NoteState>();
        for (const [id, note] of notes.value) {
          if (note.isDirty && !id.startsWith("temp-")) {
            dirtyNotes.set(id, note);
          }
        }

        const noteStates: NoteState[] = result.data.map((note: Note) => ({
          ...note,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        }));

        notes.value.clear();
        noteStates.forEach((ns) => {
          // Merge: if we have a dirty local version, keep it instead of server data
          const dirty = dirtyNotes.get(ns.id);
          if (dirty) {
            notes.value.set(ns.id, dirty);
          } else {
            notes.value.set(ns.id, ns);
          }
        });

        // Re-add temp notes
        for (const tempNote of tempNotes) {
          notes.value.set(tempNote.id, tempNote);
        }

        // Awaited so a reload immediately after sync reads up-to-date IDB data.
        // Only persist non-dirty notes to IDB; dirty ones are already there.
        await saveNotesToIndexedDB(noteStates.filter(ns => !dirtyNotes.has(ns.id)));

        // Cleanup temp notes from IDB (they now have real server IDs)
        for (const tempNote of tempNotes) {
          try {
            await deleteNoteFromIndexedDB(tempNote.id);
          } catch {
            /* best effort cleanup */
          }
        }

        lastSync.value = new Date();
      }
      // Server failed: IDB data from hydrateFromIDB remains visible.
    } catch {
      // Network error: IDB data from hydrateFromIDB remains visible.
    } finally {
      loadingStates.value.set(workspaceId, false);
    }
  };

  // Pure IDB hydration — no loading-state side effects.
  // Loads NOTES store and overlays any PENDING_NOTES so offline edits survive
  // a page reload even when the NOTES store write hasn't completed yet.
  const hydrateFromIDB = async (): Promise<void> => {
    const [localNotes, pendingChanges] = await Promise.all([
      loadNotesFromIndexedDB(workspaceId),
      loadPendingNoteChanges(workspaceId),
    ]);

    if (localNotes.length === 0 && pendingChanges.length === 0) return;

    const noteMap = new Map<string, NoteState>();
    localNotes.forEach((note: NoteState) => noteMap.set(note.id, note));

    // Overlay pending changes: the PENDING_NOTES store is the authoritative
    // source for edits made while offline, even if the NOTES store write
    // hadn't flushed before the reload.
    for (const change of pendingChanges) {
      if (change.operation === "delete") {
        noteMap.delete(change.id);
      } else if (change.operation === "upsert") {
        const existing = noteMap.get(change.id);
        if (existing) {
          // BUG-2 fix: timestamp-based stale pending guard.
          // If the NOTES store entry is newer than the pending change,
          // the pending change is stale from a previous sync cycle — skip it.
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const pendingTime = change.updatedAt || 0;
          if (existingTime > pendingTime) {
            // NOTES entry is more recent — the pending change is stale, skip it
            continue;
          }

          noteMap.set(change.id, {
            ...existing,
            content: change.content ?? existing.content,
            tags: change.tags ?? existing.tags,
            metadata: change.metadata ?? existing.metadata,
            isDirty: true,
          });
        } else if (change.workspaceId === workspaceId) {
          // New note created offline that isn't in the NOTES store yet.
          noteMap.set(change.id, {
            id: change.id,
            workspaceId: change.workspaceId!,
            content: change.content || "",
            tags: change.tags || [],
            order: noteMap.size,
            noteType: change.noteType || "TEXT",
            metadata: change.metadata,
            createdAt: new Date(change.updatedAt),
            updatedAt: new Date(change.updatedAt),
            isDirty: true,
            isLoading: false,
            error: null,
          });
        }
      }
    }

    notes.value.clear();
    noteMap.forEach((note, id) => notes.value.set(id, note));
  };

  // Thin wrapper used by error paths or direct callers.
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      await hydrateFromIDB();
    } catch {
      // Silently fail — the navbar offline pill already tells the user.
    } finally {
      loadingStates.value.set(workspaceId, false);
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
    return await updateNoteToServer(id, note.content);
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
      notes.value.set(note.id, note);
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
  const store: NotesStore & { _flushDebounce?: () => void } = {
    notes,
    loadingStates,
    _flushDebounce,
    filteredNoteIds,
    createNote,
    updateNote,
    deleteNote,
    reorderNotes,
    getNote,
    syncWithServer,
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

  // Defer the initial sync to the mounting phase so that:
  //  1. The cache entry is already set (race condition above is avoided).
  //  2. The composable can be called outside a component (e.g. in a Pinia
  //     action or test) without triggering a spurious server round-trip.
  if (getCurrentInstance()) {
    onMounted(() => {
      syncWithServer();
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
