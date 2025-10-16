import type { Note } from '~~/shared/note.contract'
import { useDebounce } from '~/utils/debounce'

export interface NoteState extends Note {
  // Local state tracking
  isLoading?: boolean
  isDirty?: boolean
  lastSaved?: Date
  error?: string | null
  originalContent?: string // Store original content for rollback
}

interface NotesStore {
  notes: Ref<Map<string, NoteState>>
  loadingStates: Ref<Map<string, boolean>>
  createNote: (folderId: string, content: string) => Promise<string | null>
  updateNote: (id: string, content: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  syncWithServer: (folderId: string) => Promise<void>
  retryFailedNote: (id: string) => Promise<boolean>
  clearNoteError: (id: string) => void
  isNoteLoading: (id: string) => boolean
  isNoteDirty: (id: string) => boolean
}

// Global store instance
const stores = new Map<string, NotesStore>()

/**
 * Creates or returns a notes store for a specific folder
 * This provides local state management with optimistic updates
 */
export function useNotesStore(folderId: string): NotesStore {
  // Return existing store if available
  if (stores.has(folderId)) {
    return stores.get(folderId)!
  }

  const { $api } = useNuxtApp()

  // Local reactive state
  const notes = ref<Map<string, NoteState>>(new Map())
  const loadingStates = ref<Map<string, boolean>>(new Map())
  const lastSync = ref<Date | null>(null)

  // Debounced save function to reduce API calls
  const saveToServer = async (id: string, content: string) => {
    await saveNoteToServer(id, content)
  }

  const { debouncedFunc: debouncedSave } = useDebounce(saveToServer, 300)

  // Internal function to save note to server
  const saveNoteToServer = async (id: string, content: string): Promise<boolean> => {
    const note = notes.value.get(id)
    if (!note) return false

    // Store original state for rollback
    const originalNote = { ...note }

    try {
      // Set loading state
      note.isLoading = true
      note.error = null

      // Make API call
      const result = await $api.notes.update(id, { content })

      if (result.success) {
        // Update local state with server response
        notes.value.set(id, {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null
        })
        return true
      } else {
        // API returned failure - rollback optimistic changes
        console.error('Server rejected update:', result.error)

        // Rollback to original state
        notes.value.set(id, {
          ...originalNote,
          isLoading: false,
          error: 'Server rejected the changes'
        })

        return false
      }

    } catch (error) {
      console.error('Failed to save note:', error)

      // Network or other error - rollback optimistic changes
      notes.value.set(id, {
        ...originalNote,
        isLoading: false,
        error: 'Failed to save - check your connection'
      })

      return false
    }
  }

  // Create a new note
  const createNote = async (folderIdParam: string, content: string): Promise<string | null> => {
    try {
      // Create temporary ID for optimistic update
      const tempId = `temp-${Date.now()}`

      // Add optimistic note
      const optimisticNote: NoteState = {
        id: tempId,
        folderId: folderIdParam,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        isLoading: true,
        isDirty: false,
        error: null
      }

      notes.value.set(tempId, optimisticNote)

      // Make API call
      const result = await $api.notes.create({ folderId: folderIdParam, content })

      if (result.success) {
        // Remove temporary note and add real note
        notes.value.delete(tempId)
        notes.value.set(result.data.id, {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null
        })

        return result.data.id
      }

      // Remove failed optimistic note
      notes.value.delete(tempId)
      return null

    } catch (error) {
      console.error('Failed to create note:', error)
      return null
    }
  }

  // Update note content (optimistic with debounced save)
  const updateNote = async (id: string, content: string): Promise<boolean> => {
    const note = notes.value.get(id)
    if (!note) return false

    // Store original content for potential rollback
    const originalContent = note.content

    // Optimistic update
    notes.value.set(id, {
      ...note,
      content,
      isDirty: true,
      updatedAt: new Date(),
      // Store original content in case we need to rollback
      originalContent: originalContent
    })

    // Debounced save to server (will handle rollback if needed)
    debouncedSave(id, content)

    return true
  }

  // Delete a note
  const deleteNote = async (id: string): Promise<boolean> => {
    try {
      const note = notes.value.get(id)
      if (!note) return false

      // Optimistic removal
      notes.value.delete(id)

      // Make API call
      const result = await $api.notes.delete(id)

      if (!result.success) {
        // Rollback on failure
        notes.value.set(id, note)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to delete note:', error)

      // Rollback on error - find the note in the notes map before deletion
      const allNotes = Array.from(notes.value.values())
      const originalNote = allNotes.find(n => n.id === id)
      if (originalNote) {
        notes.value.set(id, originalNote)
      }

      return false
    }
  }

  // Sync with server (initial load or refresh)
  const syncWithServer = async (folderIdParam: string): Promise<void> => {
    loadingStates.value.set(folderIdParam, true)
    try {
      const result = await $api.notes.getByFolder(folderIdParam)

      if (result.success) {
        // Clear existing notes and load fresh data
        notes.value.clear()

        result.data.forEach((note: Note) => {
          notes.value.set(note.id, {
            ...note,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null
          })
        })

        lastSync.value = new Date()
        loadingStates.value.set(folderIdParam, false)
        return
      }

      // API returned failure
      console.error('Failed to sync notes: server returned failure', result.error)
      loadingStates.value.set(folderIdParam, false)
      return
    } catch (error) {
      console.error('Failed to sync notes:', error)
      loadingStates.value.set(folderIdParam, false)
      return
    }
  }

  // Utility functions
  const isNoteLoading = (id: string): boolean => {
    return notes.value.get(id)?.isLoading ?? false
  }

  // Check if folder-level notes are being fetched
  // Note: folder-level loading state is exposed via `loadingStates` ref

  const isNoteDirty = (id: string): boolean => {
    return notes.value.get(id)?.isDirty ?? false
  }

  // Retry a failed note save operation
  const retryFailedNote = async (id: string): Promise<boolean> => {
    const note = notes.value.get(id)
    if (!note || !note.error) return false

    // Clear error state and retry with current content
    note.error = null
    return await saveNoteToServer(id, note.content)
  }

  // Clear error state for a note
  const clearNoteError = (id: string): void => {
    const note = notes.value.get(id)
    if (note) {
      note.error = null
    }
  }

  // Create store instance
  const store: NotesStore = {
    notes,
    loadingStates,
    createNote,
    updateNote,
    deleteNote,
    syncWithServer,
    retryFailedNote,
    clearNoteError,
    isNoteLoading,
    isNoteDirty
  }

  // Cache the store
  stores.set(folderId, store)

  // Auto-sync on creation
  syncWithServer(folderId)

  return store
}

/**
 * Clean up store when folder is no longer needed
 */
export function cleanupNotesStore(folderId: string): void {
  stores.delete(folderId)
}
