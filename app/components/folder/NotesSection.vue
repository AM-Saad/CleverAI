<template>
    <ui-card variant="default" size="lg" shadow="none"
        class="flex flex-col flex-1 basis-1 lg:basis-1/3 lg:shrink-0 min-h-0 overflow-hidden" content-classes="flex">
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
        <template #default>

            <ui-loader :is-fetching="isFetching" label="Loading notes..." />
            <!-- Error state for initial fetch -->
            <shared-error-message v-if="error" :error="error" />

            <!-- Notes content -->
            <!-- Fullscreen backdrop with transition -->
            <Transition name="backdrop">
                <div v-if="fullscreenNote" class="fullscreen-backdrop" @click="closeFullscreen" />
            </Transition>

            <!-- Empty state -->
            <shared-empty-state v-if="!error && !isFetching && !notes?.length" title="No Notes."
                button-text="Create First Note" :center-description="true" @action="createNewNote">
                <template #description>
                    Create your first note to capture important <br />thoughts and ideas for
                    this folder.
                </template>
            </shared-empty-state>

            <!-- Notes grid -->
            <ui-card v-if="!error && !isFetching && notes?.length" variant="ghost" size="xs" content-classes="flex" class-name="flex-1">
                <template #default>
                    <div class="relative flex-1 basis-1/5 shrink-0  overflow-auto bg-light dark:bg-muted  rounded border border-muted">
                        <folder-notes-search :folder-id="folderId" />
                        <ReorderGroup v-model:values="localNotes" axis="y"
                            class="relative flex-1 basis-1/5 shrink-0  overflow-auto" @reorder="handleReorder">
                            <UContextMenu v-for="(note, idx) in localNotes" :key="note.id" :items="items">
                                <ReorderItem :value="note" 
                                :class="['relative flex items-center gap-2 group w-full p-2.5 border-b border-muted cursor-pointer hover:bg-muted',
                                 idx === 0 ? 'rounded-tl-xl' : '', 
                                 notesStore.filteredNoteIds.value ? (notesStore.isNoteInFilter(note.id) ? 'font-bold' : 'opacity-50') : '']"
                                 @click="currentNoteId = note.id;">

                                    <div v-if="note.isLoading" class="flex items-center gap-1 text-primary">
                                        <svg class="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                stroke-width="4" />
                                            <path class="opacity-75" fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </div>
                                    <ui-paragraph size="xs" class="truncate">
                                        <span v-html="note.content.slice(0, 30)"></span>
                                    </ui-paragraph>

                                </ReorderItem>
                            </UContextMenu>
                        </ReorderGroup>
                    </div>

                    <ui-card class="col-span-4 h-full flex flex-1 min-h-0 basis-4/5"
                        content-classes="overflow-y-hidden!" variant="ghost" size="xs">

                        <UiStickyNote v-if="notesStore.getNote(currentNoteId!)"
                            :note="notesStore.getNote(currentNoteId!)!"
                            :is-fullscreen="fullscreenNote === currentNoteId" :delete-note="deleteNote" size="lg"
                            placeholder="Double-click to add your note..." @update="handleUpdateNote"
                            @retry="handleRetry" @toggle-fullscreen="toggleFullscreen" />
                    </ui-card>
                </template>
            </ui-card>

        </template>
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

const items = ref([
    [
        {
            label: 'Appearance',
            children: [
                {
                    label: 'System',
                    icon: 'i-lucide-monitor'
                },
                {
                    label: 'Light',
                    icon: 'i-lucide-sun'
                },
                {
                    label: 'Dark',
                    icon: 'i-lucide-moon'
                }
            ]
        }
    ],
    [
        {
            label: 'Show Sidebar',
            kbds: ['meta', 's']
        },
        {
            label: 'Show Toolbar',
            kbds: ['shift', 'meta', 'd']
        },
        {
            label: 'Collapse Pinned Tabs',
            disabled: true
        }
    ],
    [
        {
            label: 'Clear Cache and Refresh'
        },
        {
            type: 'separator'
        },
        {
            label: 'Developer',
            children: [
                [
                    {
                        label: 'View Source',
                        kbds: ['meta', 'shift', 'u']
                    },
                    {
                        label: 'Developer Tools',
                        kbds: ['option', 'meta', 'i']
                    },
                    {
                        label: 'Inspect Elements',
                        kbds: ['option', 'meta', 'c']
                    }
                ],
                [
                    {
                        label: 'JavaScript Console',
                        kbds: ['option', 'meta', 'j']
                    }
                ]
            ]
        }
    ]
])



// Use the optimistic notes store
const notesStore = useNotesStore(props.folderId);


// Computed properties for reactive data
const notes = computed(() => {
    const allNotes = Array.from(notesStore.notes.value.values());
    // Sort by order field
    return allNotes.sort((a, b) => a.order - b.order);
});

// const filteredNotes = computed(() => notesStore.filteredNotes);
// watch(filteredNotes, (newFiltered) => {
//     if (newFiltered) {
//         console.log("👀 [NotesSection] filteredNotes updated:", newFiltered);
//     } else {
//         console.log("👀 [NotesSection] No active filter, showing all notes");
//     }
// });



// Local writable ref for ReorderGroup v-model
const localNotes = ref<NoteState[]>([]);
const isReordering = ref(false);

// Watch notes and update localNotes
watch(notes, (newNotes) => {
    console.log("👀 [NotesSection] Notes changed, updating localNotes:", newNotes.length);
    // Only update if we're not currently reordering to avoid conflicts
    if (!isReordering.value) {
        localNotes.value = [...newNotes];
    }
}, { immediate: true });

// Debounced reorder handler to prevent rapid-fire requests
let reorderTimeout: ReturnType<typeof setTimeout> | null = null;

// Watch localNotes for reordering (when user drags)
watch(localNotes, (newOrder, oldOrder) => {
    // Only trigger if the order actually changed (not initial load)
    if (oldOrder && oldOrder.length > 0 && newOrder.length === oldOrder.length) {
        const orderChanged = newOrder.some((note, index) => note.id !== oldOrder[index]?.id);
        if (orderChanged) {
            console.log("🔄 [NotesSection] localNotes order changed by user, debouncing reorder...");

            // Clear any pending reorder
            if (reorderTimeout) {
                clearTimeout(reorderTimeout);
            }

            // Debounce the reorder call (wait for user to stop dragging)
            reorderTimeout = setTimeout(() => {
                console.log("⏱️ [NotesSection] Debounce complete, calling handleReorder");
                handleReorder(newOrder);
            }, 500); // Wait 500ms after user stops dragging
        }
    }
}, { deep: true });

const currentNoteId = ref<string | null>(notes.value[0]?.id || null);


// Loading and error state for the initial fetch
const isFetching = computed(
    () => notesStore.loadingStates.value.get(props.folderId) ?? false,
);
const error = ref<APIError | null>(null); // Main error state for critical failures


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
    const note = notesStore.getNote(id);
    if (!note) {
        console.error("Note not found for update:", id);
        return;
    }
    const updatedNote: NoteState = {
        ...note,
        content: text,
        isDirty: true,
        updatedAt: new Date(),
    };

    // Save to IndexedDB immediately for persistence
    await saveNoteToIndexedDB(updatedNote);
    const success = await notesStore.updateNote(id, updatedNote);

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
const handleReorder = async (newOrder: NoteState[]) => {
    if (isReordering.value) {
        console.log("⏭️ [NotesSection] Already reordering, skipping...");
        return;
    }

    console.log("🔄 [NotesSection] handleReorder called with:", {
        count: newOrder.length,
        ids: newOrder.map(n => n.id),
        orders: newOrder.map((n, i) => ({ id: n.id, currentOrder: n.order, newOrder: i }))
    });

    isReordering.value = true;
    const success = await notesStore.reorderNotes(newOrder);
    isReordering.value = false;

    if (success) {
        console.log("✅ [NotesSection] Notes order saved successfully");
    } else {
        console.error("❌ [NotesSection] Failed to save notes order");
    }
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
