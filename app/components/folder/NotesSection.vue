<template>
    <UiCard variant="ghost" size="xs" shadow="none" class="col-span-1 lg:col-span-4 flex-1">
        <!-- Header -->
        <template v-slot:header>
            <div class="flex items-center gap-2">
                <ui-subtitle size="base">Notes</ui-subtitle>
                <span v-if="notes?.length" class="text-sm text-gray-500 dark:text-gray-400">
                    ({{ notes.length }})
                </span>
            </div>
            <u-button size="sm" color="primary" variant="outline" @click="createNewNote">
                <u-icon name="i-heroicons-plus" class="w-4 h-4" />
                New Note
            </u-button>
        </template>

        <ui-loader :is-fetching="isFetching" label="Loading notes..." />
        <!-- Error state for initial fetch -->
        <shared-error-message v-if="error" :error="error" />

        <!-- Notes content -->
        <div v-if="!isFetching && !error" class="h-full overflow-auto">
            <!-- Fullscreen backdrop with transition -->
            <!-- <Transition name="backdrop">
                <div v-if="fullscreenNote" class="fullscreen-backdrop" @click="closeFullscreen" />
            </Transition> -->

            <!-- Empty state -->
            <div v-if="!notes?.length" class="flex flex-col gap-2 items-center justify-center">
                <div class="flex items-center gap-2 mb-4">
                    <u-icon name="i-heroicons-document-text" class="w-12 h-12 text-muted dark:text-light" />
                    <ui-subtitle>
                        No Notes Yet
                    </ui-subtitle>
                </div>

                <ui-paragraph size="sm" color="muted">
                    Create your first note to capture important thoughts and ideas for
                    this folder.
                </ui-paragraph>
                <u-button color="primary" @click="createNewNote">
                    <u-icon name="i-heroicons-plus" class="w-4 h-4" />
                    Create First Note
                </u-button>
            </div>

            <!-- Notes grid -->
            <ui-card v-else variant="outline" size="xs" class="h-full">
                <div class="grid grid-cols-5 h-full">
                    <ReorderGroup v-model:values="localNotes" axis="y"
                        class="relative  overflow-auto space-y-4 col-span-1 border-r border-muted">
                        <ReorderItem v-for="note in localNotes" :key="note.id" :value="note"
                            class="relative group w-full p-1.5 mb-1 border-b border-muted"
                            @click="currentNoteId = note.id;">
                            <ui-paragraph size="xs" class="truncate">{{ note.content.slice(0, 40) }}...</ui-paragraph>
                        </ReorderItem>
                    </ReorderGroup>

                    <ui-card class="col-span-4" variant="ghost" size="xs">
                        <!-- <shared-tiptap-editor v-if="currentNoteId" ref="tiptapRef" :id="currentNoteId"
                            v-model="contentHtml" /> -->
                        <UiStickyNote v-if="currentNoteId"
                            :note="transformNoteForComponent(notes.find(n => n.id === currentNoteId)!)"
                            :is-fullscreen="fullscreenNote === currentNoteId" :delete-note="deleteNote" size="lg"
                            placeholder="Double-click to add your note..." @update="handleUpdateNote"
                            @retry="handleRetry" @toggle-fullscreen="toggleFullscreen" />
                    </ui-card>
                </div>
            </ui-card>

        </div>
    </UiCard>
</template>

<script setup lang="ts">
import type { NoteState } from "~/composables/folders/useNotesStore";
import type { Editor as TiptapEditorType } from "@tiptap/core";
import { useNotesStore } from "~/composables/folders/useNotesStore";
import { APIError } from "~/services/FetchFactory";
import { ReorderGroup, ReorderItem } from 'motion-v'



interface Note {
    id: string;
    text: string;
    loading?: boolean;
    error?: string | null;
}

interface Props {
    folderId: string;
}

const props = defineProps<Props>();

// Use the optimistic notes store
const notesStore = useNotesStore(props.folderId);

// Computed properties for reactive data
const notes = computed(() => Array.from(notesStore.notes.value.values()));

const localNotes = ref<NoteState[]>([]);
// Loading and error state for the initial fetch
const isFetching = computed(
    () => notesStore.loadingStates.value.get(props.folderId) ?? false,
);
const error = ref<APIError | null>(null); // Main error state for critical failures

const tiptapRef = ref<{ editor?: TiptapEditorType } | null>(null);

// const isFullscreen = computed(() => {
//     return tiptapRef.value?.editor?.isFocused || false;
// });

const currentNoteId = ref<string | null>(notes.value[0]?.id || null);

// Fullscreen state management
const fullscreenNote = ref<string | null>(null);

// Transform note for StickyNote component
const transformNoteForComponent = (note: NoteState) => {
    return {
        id: note.id,
        text: note.content,
        loading: note.isLoading || false,
        error: note.error || null,
    };
};


watch(notes, (newNotes) => {
    localNotes.value = newNotes;
}, { immediate: true });
function setItems(newItems: NoteState[]) {
    localNotes.value = newItems
}
// Fullscreen functionality
const toggleFullscreen = (noteId: string) => {
    if (fullscreenNote.value === noteId) {
        // Close fullscreen
        fullscreenNote.value = null;
    } else {
        // Open fullscreen
        fullscreenNote.value = noteId;
    }
};

const closeFullscreen = () => {
    fullscreenNote.value = null;
};

// Check if a note is currently loading
// const isNoteLoading = (noteId: string) => {
//     return notesStore.isNoteLoading(noteId)
// }

// Create a new note (optimistic)
const createNewNote = async () => {
    const noteId = await notesStore.createNote(props.folderId, "New note...");

    if (noteId) {
        console.log("Note created optimistically:", noteId);
    } else {
        console.error("Failed to create note");
    }
};

// Auto-sync on mount and handle errors
onMounted(async () => {
    try {
        error.value = null;
        await notesStore.syncWithServer(props.folderId);
    } catch (e: unknown) {
        console.log("Error syncing notes:", e);
        error.value =
            e instanceof APIError ? e : new APIError("Failed to load notes");
    }

    // Add ESC key listener for fullscreen
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && fullscreenNote.value) {
            closeFullscreen();
        }
    };
    document.addEventListener("keydown", handleEscape);

    // Cleanup on unmount
    onUnmounted(() => {
        document.removeEventListener("keydown", handleEscape);
    });
});

// Update an existing note (optimistic with debounced save)
const handleUpdateNote = async (id: string, text: string) => {
    // Optimistic update - user sees change immediately
    const success = await notesStore.updateNote(id, text);

    if (success) {
        console.log("Note updated optimistically:", id);
    } else {
        console.error("Failed to update note:", id);
    }
};

// Delete a note (optimistic with rollback on failure)
const deleteNote = async (id: string) => {
    console.log("Deleting note:", id);
    const success = await notesStore.deleteNote(id);

    if (success) {
        console.log("Note deleted successfully:", id);
    } else {
        console.error("Failed to delete note:", id);
    }
};

// Handle retry for failed operations
const handleRetry = (id: string) => {
    // Use the store's retry functionality for failed notes
    notesStore.retryFailedNote(id);
};
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
