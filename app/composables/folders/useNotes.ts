import type { Note, CreateNoteDTO, UpdateNoteDTO } from '~~/shared/note.contract'
import { useDataFetch } from '~/composables/shared/useDataFetch'
import { useOperation } from '~/composables/shared/useOperation'
import { useNuxtApp } from '#app'

export function useNotes(folderId: string) {
  const { $api } = useNuxtApp()

  // Main notes data with centralized error handling
  const { data, pending, error, refresh } = useDataFetch<Note[]>(
    `notes-${folderId}`,
    () => $api.notes.getByFolder(folderId)
  )

  // Create operation with centralized error handling
  const createOperation = useOperation<Note>()

  // Update operation with centralized error handling
  const updateOperation = useOperation<Note>()

  // Remove operation with centralized error handling
  const removeOperation = useOperation<{ success: boolean; message: string }>()

  // Centralized createNote that lets FetchFactory handle all error construction
  const createNote = async (noteData: CreateNoteDTO) => {
    const result = await createOperation.execute(async () => {
      const newNote = await $api.notes.create(noteData)
      await refresh() // Refresh the main notes list on successful creation
      return newNote
    })
    return result
  }

  // Centralized updateNote that lets FetchFactory handle all error construction
  const updateNote = async (id: string, noteData: UpdateNoteDTO) => {
    const result = await updateOperation.execute(async () => {
      const updatedNote = await $api.notes.update(id, noteData)
      await refresh() // Refresh the main notes list on successful update
      return updatedNote
    })
    return result
  }

  // Centralized removeNote that lets FetchFactory handle all error construction
  const removeNote = async (id: string) => {
    const result = await removeOperation.execute(async () => {
      const deleteResult = await $api.notes.delete(id)
      await refresh() // Refresh the main notes list on successful deletion
      return deleteResult
    })
    return result
  }

  return {
    // Main notes state
    notes: data,
    loading: pending,
    error,
    refresh,

    // Create operation state - all errors centralized via FetchFactory
    creating: createOperation.pending,
    createError: createOperation.error,
    createTypedError: createOperation.typedError,
    createNote,

    // Update operation state - all errors centralized via FetchFactory
    updating: updateOperation.pending,
    updateError: updateOperation.error,
    updateTypedError: updateOperation.typedError,
    updateNote,

    // Remove operation state - all errors centralized via FetchFactory
    removing: removeOperation.pending,
    removeError: removeOperation.error,
    removeTypedError: removeOperation.typedError,
    removeNote
  }
}
