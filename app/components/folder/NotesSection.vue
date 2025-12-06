<template>
  <ui-card variant="default" size="lg" shadow="none"
    class="flex flex-col md:basis-2/3 shrink-0 md:shrink min-h-0 overflow-hidden basis-3/3"
    contentClasses="flex flex-col">
    <!-- Header -->
    <template v-slot:header>
      <div class="flex items-center gap-2">
        Notes
        <ui-label v-if="notes?.length"> ( {{ notes.length }} ) </ui-label>
      </div>
      <u-button size="sm" color="primary" variant="outline" @click="createNewNote">
        <u-icon name="i-heroicons-plus" />
        New Note
      </u-button>
    </template>
    <template #default>
      <ui-loader :is-fetching="isFetching" v-if="isFetching" label="Loading notes..." />
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
          Create your first note to capture important <br />thoughts and ideas
          for this folder.
        </template>
      </shared-empty-state>

      <!-- Notes grid -->
      <div v-if="!error && !isFetching && notes?.length" class="flex flex-1 min-h-0 overflow-hidden relative"
        id="notes-section">
        <ui-drawer :show="true" :mobile="false" teleport-to="#notes-section" :backdrop="false" :handle-visible="20">
          <div class="relative shrink-0 overflow-auto bg-light dark:bg-muted rounded border border-muted">
            <folder-notes-search :folder-id="folderId" />
            <ReorderGroup v-model:values="localNotes" axis="y" class="relative flex-1 shrink-0 overflow-auto"
              @reorder="handleReorder">
              <UContextMenu v-for="(note, idx) in localNotes" :key="note.id" :items="[
                // { label: 'Edit', onSelect: () => editNote(note) },
                { label: 'Delete', onSelect: () => deleteNote(note.id) },
              ]" :context="note">
                <ReorderItem :value="note" :class="[
                  'relative flex items-center gap-2 group w-full p-2.5 border-b border-muted cursor-pointer hover:bg-muted',
                  idx === 0 ? 'rounded-tl-xl' : '',
                  notesStore.filteredNoteIds.value
                    ? notesStore.isNoteInFilter(note.id)
                      ? 'font-bold'
                      : 'opacity-50'
                    : '',
                ]" @click="currentNoteId = note.id">
                  <div v-if="note.isLoading" class="flex items-center gap-1 text-primary">
                    <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                  </div>
                  <ui-paragraph size="xs" class="truncate">
                    {{
                      note.content
                        .replace(/<[^>]*>/g, "")
                        .trim()
                        .slice(0, 30) || "Empty note"
                    }}
                  </ui-paragraph>
                </ReorderItem>
              </UContextMenu>
            </ReorderGroup>
          </div>
        </ui-drawer>

        <UiStickyNote v-if="notesStore.getNote(currentNoteId!)" :note="notesStore.getNote(currentNoteId!)!"
          :is-fullscreen="fullscreenNote === currentNoteId" :delete-note="deleteNote" size="lg"
          @update="handleUpdateNote" @retry="handleRetry" @toggle-fullscreen="toggleFullscreen"
          placeholder="Double-click to add your note..." @add-to-material="emit('add-to-material', $event)" />
      </div>
    </template>
  </ui-card>
</template>

<script setup lang="ts">
import type { NoteState } from "~/composables/folders/useNotesStore";
import { useNotesStore } from "~/composables/folders/useNotesStore";
import { APIError } from "~/services/FetchFactory";
import { ReorderGroup, ReorderItem } from "motion-v";

const route = useRoute();
const folderId = route.params.id as string;
const emit = defineEmits(["add-to-material"]);

// Use the optimistic notes store
const notesStore = useNotesStore(folderId);

// Computed properties for reactive data
const notes = computed(() => {
  const allNotes = Array.from(notesStore.notes.value.values());
  // Sort by order field
  return allNotes.sort((a, b) => a.order - b.order);
});

// Local writable ref for ReorderGroup v-model
const localNotes = ref<NoteState[]>([]);
const isReordering = ref(false);
const currentNoteId = ref<string | null>(notes.value[0]?.id || null);

// Loading and error state for the initial fetch
const isFetching = computed(
  () => notesStore.loadingStates.value.get(folderId) ?? false
);
const error = ref<APIError | null>(null); // Main error state for critical failures

// Fullscreen state management
const fullscreenNote = ref<string | null>(null);

// Debounced reorder handler to prevent rapid-fire requests
let reorderTimeout: ReturnType<typeof setTimeout> | null = null;

// Watch notes and update localNotes
watch(
  notes,
  (newNotes) => {
    // Only update if we're not currently reordering to avoid conflicts
    if (!isReordering.value) {
      localNotes.value = [...newNotes];
    }
  },
  { immediate: false }
);

// Watch localNotes for reordering (when user drags)
watch(
  localNotes,
  (newOrder, oldOrder) => {
    // Only trigger if the order actually changed (not initial load)
    if (
      oldOrder &&
      oldOrder.length > 0 &&
      newOrder.length === oldOrder.length
    ) {
      const orderChanged = newOrder.some(
        (note, index) => note.id !== oldOrder[index]?.id
      );
      if (orderChanged) {
        console.log(
          "🔄 [NotesSection] localNotes order changed by user, debouncing reorder..."
        );

        // Clear any pending reorder
        if (reorderTimeout) {
          clearTimeout(reorderTimeout);
        }

        // Debounce the reorder call (wait for user to stop dragging)
        reorderTimeout = setTimeout(() => {
          console.log(
            "⏱️ [NotesSection] Debounce complete, calling handleReorder"
          );
          handleReorder(newOrder);
        }, 500); // Wait 500ms after user stops dragging
      }
    }
  },
  { deep: true }
);

// Create a new note (optimistic)
const createNewNote = async () => {
  const noteId = await notesStore.createNote(folderId, "New note...");

  if (noteId) {
    currentNoteId.value = noteId;
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
  await notesStore.updateNote(id, updatedNote);
};

// Delete a note (optimistic with rollback on failure)
const deleteNote = async (id: string) => {
  await notesStore.deleteNote(id);
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
  isReordering.value = true;
  await notesStore.reorderNotes(newOrder);
  isReordering.value = false;
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

const closeFullscreen = () => (fullscreenNote.value = null);

// Add ESC key listener for fullscreen
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape" && fullscreenNote.value) {
    closeFullscreen();
  }
};

// Auto-sync on mount and handle errors
onMounted(async () => {
  try {
    error.value = null;
    await notesStore.syncWithServer(folderId);
  } catch (e: unknown) {
    error.value =
      e instanceof APIError ? e : new APIError("Failed to load notes");
  }

  document.addEventListener("keydown", handleEscape);
});

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener("keydown", handleEscape);
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
