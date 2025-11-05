<template>
    <ui-card variant="ghost" size="lg" shadow="none" class="col-span-1 md:col-span-3 lg:col-span-4 flex-1">
        <!-- Header -->
        <template v-slot:header>
            <div class="flex items-center gap-2">
                Notes
                <ui-label v-if="notes?.length">
                    ( {{ notes.length }} )
                </ui-label>
            </div>
            <u-button size="sm" color="primary" variant="outline" @click="createNewNote">
                <u-icon name="i-heroicons-plus" />
                New Note
            </u-button>
        </template>

        <ui-loader :is-fetching="isFetching" label="Loading notes..." />
        <!-- Error state for initial fetch -->
        <shared-error-message v-if="error" :error="error" />

        <!-- Notes content -->
        <div v-if="!isFetching && !error" class="h-full overflow-auto">
            <!-- Fullscreen backdrop with transition -->
            <Transition name="backdrop">
                <div v-if="fullscreenNote" class="fullscreen-backdrop" @click="closeFullscreen" />
            </Transition>

            <!-- Empty state -->
            <shared-empty-state
                v-if="!notes?.length"
                title="No Notes."
                button-text="Create First Note"
                :center-description="true"
                @action="createNewNote"
            >
                <template #description>
                    Create your first note to capture important <br/>thoughts and ideas for
                    this folder.
                </template>
            </shared-empty-state>

            <!-- Notes grid -->
            <ui-card v-else variant="outline" size="xs" class="h-full">
                <div class="grid grid-cols-5 h-full">
                    <ReorderGroup v-model:values="notes" axis="y"
                        class="relative  overflow-auto col-span-1 border-r pr-1 border-muted" @reorder="handleReorder">
                        <ReorderItem v-for="(note, idx) in notes" :key="note.id" :value="note" :class="['relative group w-full p-2.5 border-b border-muted cursor-pointer hover:bg-muted',
                            idx === 0 ? 'rounded-tl-xl' : ''
                        ]" @click="currentNoteId = note.id;">
                            <ui-paragraph size="xs" class="truncate">{{ note.content.slice(0, 40) }}...</ui-paragraph>
                        </ReorderItem>
                    </ReorderGroup>

                    <ui-card class="col-span-4" variant="ghost" size="xs">
                        <UiStickyNote v-if="currentNote" :note="currentNote"
                            :is-fullscreen="fullscreenNote === currentNoteId" :delete-note="deleteNote" size="lg"
                            placeholder="Double-click to add your note..." @update="handleUpdateNote"
                            @retry="handleRetry" @toggle-fullscreen="toggleFullscreen" />
                    </ui-card>
                </div>
            </ui-card>

        </div>
    </ui-card>
</template>

<script setup lang="ts">
import type { NoteState } from "~/composables/folders/useNotesStore";
import type { Editor as TiptapEditorType } from "@tiptap/core";
import { useNotesStore } from "~/composables/folders/useNotesStore";
import { APIError } from "~/services/FetchFactory";
import { ReorderGroup, ReorderItem } from 'motion-v'


// Note: Using NoteState from useNotesStore instead of local interface
interface Props {
    folderId: string;
}

const props = defineProps<Props>();


// Use the optimistic notes store
const notesStore = useNotesStore(props.folderId);


// Computed properties for reactive data
const notes = computed(() => Array.from(notesStore.notes.value.values()));

const currentNote = computed(() => {
    console.log("Current Note ID:", currentNoteId.value);
    console.log("Notes in Store:", notesStore.notes.value);
    console.log("Current Note Retrieved:", notesStore.notes.value.get(currentNoteId.value || ""));
    const note = notesStore.notes.value.get(currentNoteId.value || "") || null;
    return note ? {
        id: note.id,
        text: note.content, // Map 'content' to 'text' for StickyNote compatibility
        loading: note.isLoading || false,
        error: note.error || null,
    } : null;
});

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


// Create a new note (optimistic)
const createNewNote = async () => {
    const noteId = await notesStore.createNote(props.folderId, "New note...");

    if (noteId) {
        console.log("Note created optimistically:", noteId);
        // Set the new note as current to immediately show it
        currentNoteId.value = noteId;
    } else {
        console.error("Failed to create note");
    }
};



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


// Handle reordering of notes
const handleReorder = (newOrder: NoteState[]) => {
    // Update local state immediately for responsive UI
    // localNotes.value = newOrder;

    // TODO: If you want to persist order to server, add an 'order' field to the Note model
    // and implement an API endpoint to update note order
    // For now, order is maintained locally and will reset on page refresh
    console.log("Notes reordered:", newOrder.map(n => n.id));
};


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
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 50;
    backdrop-filter: blur(5px);
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
