<template>
    <UiCard variant="ghost" shadow="none">

        <!-- Header -->
        <header class="flex items-center justify-between  border-b border-gray-200 dark:border-gray-700 py-3 mb-4">
            <div class="flex items-center gap-2">

                <UiSubtitle>Notes</UiSubtitle>
                <span v-if="notes?.length" class="text-sm text-gray-500 dark:text-gray-400">
                    ({{ notes.length }})
                </span>
            </div>
            <UButton size="sm" color="primary" variant="outline" @click="createNewNote">
                <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                Add Note
            </UButton>
        </header>

        <client-only>
            <shared-tiptap-editor v-model="content"/>
        </client-only>
        <div class="output-group">
            <label>Content</label>
            <code>{{ content }}</code>
        </div>
        <!-- Loading state for initial fetch -->
        <div v-if="isFetching" class="flex items-center justify-center p-8">
            <div class="flex items-center gap-2 text-gray-500">
                <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
                <span>Loading notes...</span>
            </div>
        </div>

        <!-- Error state for initial fetch -->
        <div v-if="error" class="p-4">
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="flex items-center gap-2 text-danger dark:text-red-400">
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
                    <span class="font-medium">Failed to load notes</span>
                </div>
                <p class="text-sm text-danger dark:text-red-300 mt-1">{{ error.message }}</p>
                <UButton size="sm" color="error" variant="outline" class="mt-2"
                    @click="() => notesStore.syncWithServer(props.folderId)">
                    Try Again
                </UButton>
            </div>
        </div>

        <!-- Notes content -->
        <div v-if="!isFetching && !error" class="flex-1 overflow-auto ">
            <!-- Fullscreen backdrop with transition -->
            <Transition name="backdrop">
                <div v-if="fullscreenNote" class="fullscreen-backdrop" @click="closeFullscreen" />
            </Transition>

            <!-- Fullscreen note overlay - disabled for parent/child approach -->
            <!-- <Transition name="fullscreen">
                <div v-if="fullscreenNote && getFullscreenNote()" class="fullscreen-note-overlay">
                    <div class="fullscreen-note-content">
                        <UiStickyNote 
                            :note="transformNoteForComponent(getFullscreenNote()!)"
                            size="lg"
                            placeholder="Double-click to add your note..." 
                            @update="handleUpdateNote"
                            @retry="handleRetry"
                            @toggle-fullscreen="toggleFullscreen" />
                    </div>
                </div>
            </Transition> -->

            <!-- Empty state -->
            <div v-if="!notes?.length" class="flex flex-col items-center justify-center py-12 text-center">
                <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No notes yet</h4>
                <p class="text-gray-500 dark:text-gray-400 mb-4">
                    Create your first note to capture important thoughts and ideas for this folder.
                </p>
                <UButton color="primary" @click="createNewNote">
                    <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                    Create First Note
                </UButton>
            </div>

            <!-- Notes grid -->
            <!-- Notes grid -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2  gap-4 p-4 relative">
                <div v-for="note in notes" :key="note.id" class="relative group w-full">
                    <UiStickyNote :note="transformNoteForComponent(note)" :is-fullscreen="fullscreenNote === note.id"
                        size="lg" placeholder="Double-click to add your note..." @update="handleUpdateNote"
                        @retry="handleRetry" @toggle-fullscreen="toggleFullscreen" />

                    <!-- Delete button (hide in fullscreen mode) -->
                    <UButton v-if="!isNoteLoading(note.id) && fullscreenNote !== note.id"
                        class="absolute -left-2 -top-2 flex items-center justify-center cursor-pointer"
                        :class="{ 'opacity-0': isNoteLoading(note.id) }" variant="soft" color="error" size="xs"
                        :disabled="false" @click="deleteNote(note.id)">
                        <icon name="i-heroicons-trash" class="w-3 h-3" />
                    </UButton>
                </div>
            </div>
        </div>
    </UiCard>
</template>

<script setup lang="ts">
import type { NoteState } from '~/composables/folders/useNotesStore'
import { useNotesStore } from '~/composables/folders/useNotesStore'

interface Props {
    folderId: string
}

const content = ref('')
const props = defineProps<Props>()

// Use the optimistic notes store
const notesStore = useNotesStore(props.folderId)

// Computed properties for reactive data
const notes = computed(() => Array.from(notesStore.notes.value.values()))

// Loading and error state for the initial fetch
const isFetching = computed(() => notesStore.loadingStates.value.get(props.folderId) ?? false)
const error = ref<Error | null>(null) // Main error state for critical failures

// Fullscreen state management
const fullscreenNote = ref<string | null>(null)

// Transform note for StickyNote component
const transformNoteForComponent = (note: NoteState) => {
    return {
        id: note.id,
        text: note.content,
        loading: note.isLoading || false,
        error: note.error || null
    }
}

// Get the fullscreen note data
const getFullscreenNote = () => {
    if (!fullscreenNote.value) return null
    return notes.value.find(note => note.id === fullscreenNote.value) || null
}

// Fullscreen functionality
const toggleFullscreen = (noteId: string) => {
    if (fullscreenNote.value === noteId) {
        // Close fullscreen
        fullscreenNote.value = null
    } else {
        // Open fullscreen
        fullscreenNote.value = noteId
    }
}

const closeFullscreen = () => {
    fullscreenNote.value = null
}

// Check if a note is currently loading
const isNoteLoading = (noteId: string) => {
    return notesStore.isNoteLoading(noteId)
}

// Create a new note (optimistic)
const createNewNote = async () => {
    const noteId = await notesStore.createNote(props.folderId, 'New note...')

    if (noteId) {
        console.log('Note created optimistically:', noteId)
    } else {
        console.error('Failed to create note')
    }
}

// Auto-sync on mount and handle errors
onMounted(async () => {
    try {
        error.value = null
        await notesStore.syncWithServer(props.folderId)
    } catch (e: unknown) {
        error.value = e instanceof Error ? e : new Error('Failed to load notes')
    }

    // Add ESC key listener for fullscreen
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && fullscreenNote.value) {
            closeFullscreen()
        }
    }
    document.addEventListener('keydown', handleEscape)

    // Cleanup on unmount
    onUnmounted(() => {
        document.removeEventListener('keydown', handleEscape)
    })
})

// Update an existing note (optimistic with debounced save)
const handleUpdateNote = async (id: string, text: string) => {
    // Optimistic update - user sees change immediately
    const success = await notesStore.updateNote(id, text)

    if (success) {
        console.log('Note updated optimistically:', id)
    } else {
        console.error('Failed to update note:', id)
    }
}

// Delete a note (optimistic with rollback on failure)
const deleteNote = async (id: string) => {
    const success = await notesStore.deleteNote(id)

    if (success) {
        console.log('Note deleted successfully:', id)
    } else {
        console.error('Failed to delete note:', id)
    }
}

// Handle retry for failed operations
const handleRetry = (id: string) => {
    // Use the store's retry functionality for failed notes
    notesStore.retryFailedNote(id)
}
</script>

<style scoped>
.notes-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

/* Backdrop transitions */
.backdrop-enter-active,
.backdrop-leave-active {
    transition: all 0.3s ease-out;
}

.backdrop-enter-from,
.backdrop-leave-to {
    opacity: 0;
    backdrop-filter: blur(0px);
}

.backdrop-enter-to,
.backdrop-leave-from {
    opacity: 1;
    backdrop-filter: blur(4px);
}

/* Fullscreen backdrop */
.fullscreen-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
    backdrop-filter: blur(4px);
    will-change: opacity, backdrop-filter;
}

/* Performance optimizations */
.fullscreen-backdrop {
    backface-visibility: hidden;
    perspective: 1000px;
}

/* Accessibility - reduced motion */
@media (prefers-reduced-motion: reduce) {

    .backdrop-enter-active,
    .backdrop-leave-active {
        transition: none !important;
    }

    .fullscreen-backdrop {
        backdrop-filter: none !important;
    }
}
</style>
