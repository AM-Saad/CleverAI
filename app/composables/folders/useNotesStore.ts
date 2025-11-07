import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import { DB_CONFIG } from "~/utils/constants/pwa";

export interface NoteState extends Note {
  // Local state tracking
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
}

interface NotesStore {
  notes: Ref<Map<string, NoteState>>;
  loadingStates: Ref<Map<string, boolean>>;
  createNote: (folderId: string, content: string) => Promise<string | null>;
  updateNote: (id: string, updatedNote: NoteState) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  syncWithServer: (folderId: string) => Promise<void>;
  retryFailedNote: (id: string) => Promise<boolean>;
  clearNoteError: (id: string) => void;
  isNoteLoading: (id: string) => boolean;
  isNoteDirty: (id: string) => boolean;
  getNote: (id: string) => NoteState | null;
}

// Global store instance
const stores = new Map<string, NotesStore>();

/**
 * Creates or returns a notes store for a specific folder
 * This provides local state management with optimistic updates
 */
export function useNotesStore(folderId: string): NotesStore {
  // Return existing store if available
  if (stores.has(folderId)) {
    return stores.get(folderId)!;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const { handleOfflineSubmit } = useOffline();

  const { debouncedFunc: debouncedSave, cancel: cancelSave } = useDebounce((id: string, content: string) => {
    updateNoteToServer(id, content);
  }, 1000);

  // Local reactive state
  const notes = ref<Map<string, NoteState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);


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
    if (!navigator.onLine) {
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

    try {
      // Set loading state
      note.isLoading = true;
      note.error = null;

      // Network error - keep local content, queue for offline sync
      if (!navigator.onLine) {
        queueForOfflineSync(FORM_SYNC_TYPES.UPDATE_NOTE, { noteId: id, content }, id);
        note.isLoading = false;
        return true;
      }

      // Attempt to submit to server
      const result: Result<Note, APIError> = await $api.notes.update(id, {
        content,
      });


      if (result.success) {
        // Server success - mark as synced but keep local content
        note.isLoading = false;
        note.isDirty = false;
        note.lastSaved = new Date();

        return true;
      } else {
        // Server rejected - keep local content, show error
        console.error("Server rejected update:", result.error);
        note.isLoading = false;
        note.error = "Server rejected update";
        return false;
      }
    } catch (error) {
      console.error("Failed to sync note to server:", error);
      if (!navigator.onLine) {
        queueForOfflineSync(FORM_SYNC_TYPES.UPDATE_NOTE, { noteId: id, content }, id);
        note.isLoading = false;
        // notes.value.set(id, note);
        return true;
      }

      note.isLoading = false;
      // notes.value.set(id, note);
      return false;
    }
  };




  // Update note content - local-first approach with IndexedDB persistence
  const updateNote = async (id: string, updatedNote: NoteState): Promise<boolean> => {
    // Step 1: Optimistic update
    updatedNote.updatedAt = new Date();
    updatedNote.isDirty = true;
    notes.value.set(id, updatedNote);
    // Persist locally immediately for offline continuity
    try { await saveNoteToIndexedDB(updatedNote); } catch {}
    // Step 2: Debounced server sync
    saveToServer(id, updatedNote.content);
    return true;
  };




  // Create a new note - simple optimistic approach
  const createNote = async (folderIdParam: string, content: string): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;

    try {
      // Add optimistic note
      const optimisticNote: NoteState = {
        id: tempId,
        folderId: folderIdParam,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        isLoading: true,
        isDirty: false,
        error: null,
      };

      // Save to IndexedDB first for persistence
      await saveNoteToIndexedDB(optimisticNote);
      notes.value.set(tempId, optimisticNote);

      // Attempt to submit to server
      const result = await $api.notes.create({
        folderId: folderIdParam,
        content,
      });

      if (result.success) {
        // Server success - replace temp note with real note
        notes.value.delete(tempId);
        notes.value.set(result.data.id, {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        });
        return result.data.id;
      } else {
        // Server rejected - keep local version
        console.error("Server rejected note creation:", result.error);
        const note = notes.value.get(tempId);
        if (note) {
          note.isLoading = false;
          note.error = "Server rejected note creation";
          notes.value.set(tempId, note);
        }

        toast.add({ title: "Server Error", description: "Server rejected note creation. Note saved locally.", color: "error" });
        return tempId;
      }
    } catch (error) {
      console.error("Failed to create note:", error);

      // Only show offline message if actually offline
      if (!navigator.onLine) {
        queueForOfflineSync(FORM_SYNC_TYPES.CREATE_NOTE, { folderId: folderIdParam, content }, tempId);

        toast.add({ title: "Offline", description: "Note saved locally. Will sync when online.", color: "warning" });
        return tempId;
      } else {
        // Other errors - remove the optimistic note
        notes.value.delete(tempId);
        toast.add({ title: "Error", description: "Failed to create note - check your connection", color: "error" });
        return null;
      }
    }
  };
  // Delete a note - simple optimistic approach
  const deleteNote = async (id: string): Promise<boolean> => {
    try {
      const note = notes.value.get(id);
      if (!note) return false;

      // Optimistic removal from reactive state
      notes.value.delete(id);

      // Remove from IndexedDB
      await deleteNoteFromIndexedDB(id);

      // Attempt to submit to server
      const result: Result<unknown, APIError> = await $api.notes.delete(id);

      if (result.success) {
        return true;
      } else {
        // Server rejected - restore note to both reactive state and IndexedDB
        console.error("Server rejected note deletion:", result.error);
        const restoredNote = { ...note, isLoading: false, error: "Server rejected deletion" };
        notes.value.set(id, restoredNote);
        await saveNoteToIndexedDB(restoredNote);

        toast.add({ title: "Server Error", description: "Server rejected deletion. Note restored.", color: "error" });
        return false;
      }
    } catch (error) {
      console.error("Failed to delete note:", error);

      // Only show offline message if actually offline
      if (!navigator.onLine) {
        queueForOfflineSync(FORM_SYNC_TYPES.DELETE_NOTE, { noteId: id }, id);
        toast.add({ title: "Offline", description: "Deletion queued. Will sync when online.", color: "warning" });
        return true;
      } else {
        // Other errors - restore the note
        const note = notes.value.get(id);
        if (!note) {
          // Try to restore from the notes map
          const allNotes = Array.from(notes.value.values());
          const originalNote = allNotes.find((n) => n.id === id);
          if (originalNote) {
            notes.value.set(id, originalNote);
          }
        }

        toast.add({ title: "Error", description: "Failed to delete note - check your connection", color: "error" });
        return false;
      }
    }
  };

  // Load notes from server with IndexedDB fallback
  const syncWithServer = async (folderIdParam: string): Promise<void> => {
    loadingStates.value.set(folderIdParam, true);
    try {
      const result = await $api.notes.getByFolder(folderIdParam);

      if (result.success) {
        // Clear existing notes and load fresh data from server
        notes.value.clear();

        result.data.forEach((note: Note) => {
          const noteState: NoteState = {
            ...note,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          };
          notes.value.set(note.id, noteState);
          // Also save to IndexedDB for offline access
          saveNoteToIndexedDB(noteState);
        });

        lastSync.value = new Date();
        loadingStates.value.set(folderIdParam, false);
        return;
      }

      // Server failed - try to load from IndexedDB
      console.error(
        "Failed to sync notes: server returned failure",
        result.error
      );
      await loadFromIndexedDBFallback(folderIdParam);
    } catch (error) {
      console.error("Failed to sync notes:", error);
      // Network error - try to load from IndexedDB
      await loadFromIndexedDBFallback(folderIdParam);
    }
  };

  // Fallback to load notes from IndexedDB when server fails
  const loadFromIndexedDBFallback = async (folderId: string): Promise<void> => {
    try {
      const localNotes = await loadNotesFromIndexedDB(folderId);

      if (localNotes.length > 0) {
        // Clear existing notes and load from IndexedDB
        notes.value.clear();

        localNotes.forEach((note: NoteState) => notes.value.set(note.id, note));

        toast.add({ title: "Offline Mode", description: `Loaded ${localNotes.length} notes from local storage.`, color: "warning" });
      }
    } catch (error) {
      console.error("Failed to load notes from IndexedDB:", error);
      toast.add({ title: "Error", description: "Failed to load notes from server or local storage.", color: "error" });
    } finally {
      loadingStates.value.set(folderId, false);
    }
  };

  // Utility functions
  const isNoteLoading = (id: string): boolean => {
    return notes.value.get(id)?.isLoading ?? false;
  };

  // Check if folder-level notes are being fetched
  // Note: folder-level loading state is exposed via `loadingStates` ref

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

  // Note: Removed cleanup function as it's no longer needed with simplified approach

  // Clear error state for a note
  const clearNoteError = (id: string): void => {
    const note = notes.value.get(id);
    if (note) {
      note.error = null;
    }
  };

  const getNote = (id: string): NoteState => {
    return notes.value.get(id)!
  };

  // Create store instance
  const store: NotesStore = {
    notes,
    loadingStates,
    createNote,
    updateNote,
    deleteNote,
    getNote,
    syncWithServer,
    retryFailedNote,
    clearNoteError,
    isNoteLoading,
    isNoteDirty,
  };

  // Cache the store
  stores.set(folderId, store);

  // Auto-sync on creation
  syncWithServer(folderId);

  return store;
}

/**
 * Clean up store when folder is no longer needed
 */
export function cleanupNotesStore(folderId: string): void {
  stores.delete(folderId);
}
