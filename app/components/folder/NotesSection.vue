<template>
  <ui-card variant="default" size="lg" shadow="none"
    class="flex flex-col md:basis-2/3 shrink-0 md:shrink min-h-0 overflow-hidden basis-3/3 z-10"
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
        <ui-drawer :show="false" :mobile="false" teleport-to="#notes-section" :backdrop="false" :handle-visible="20">
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
          :delete-note="deleteNote" size="lg" @update="handleUpdateNote" @retry="handleRetry"
          @toggle-fullscreen="fullscreen.toggle" placeholder="Double-click to add your note..."
          @add-to-material="emit('add-to-material', $event)" />
      </div>
    </template>
  </ui-card>

  <!-- Fullscreen Note View -->
  <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" aria-label="Note fullscreen view" max-width="900px"
    max-height="80vh" @close="fullscreen.close">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-medium text-gray-900 dark:text-gray-100">Note</span>
        <u-button variant="ghost" color="neutral" size="xs" aria-label="Close fullscreen" @click="fullscreen.close">
          <icon name="i-heroicons-x-mark" class="w-5 h-5" />
        </u-button>
      </div>
    </template>

    <!-- Note content in fullscreen -->
    <div v-if="currentFullscreenNote" class="h-full">
      <UiStickyNote :note="currentFullscreenNote" :delete-note="deleteNote" :is-fullscreen="true" size="lg"
        @update="handleUpdateNote" @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
        placeholder="Double-click to add your note..." @add-to-material="emit('add-to-material', $event)" />
    </div>
  </shared-fullscreen-wrapper>

  <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Note" @close="showDeleteConfirm = false"
    @confirm="confirmDeleteNote">
    Are you sure you want to delete this note? This action cannot be undone.
  </shared-delete-confirmation-modal>
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
const showDeleteConfirm = ref(false);
const noteToDelete = ref<string | null>(null);

// Initialize currentNoteId - will be set when notes load
const currentNoteId = ref<string | null>(null);

// Restore last selected note for this folder from localStorage
const getStoredNoteId = (availableNotes: NoteState[]): string | null => {
  if (typeof window === 'undefined') return null;

  // No notes available - clean up localStorage for this folder
  if (availableNotes.length === 0) {
    try {
      localStorage.removeItem(`selectedNote_${folderId}`);
    } catch {
      // localStorage not available
    }
    return null;
  }

  try {
    const stored = localStorage.getItem(`selectedNote_${folderId}`);
    // Verify the note still exists and belongs to this folder
    if (stored && availableNotes.some(n => n.id === stored && n.folderId === folderId)) {
      return stored;
    }

    // Stored note doesn't exist anymore - fallback to first note and update storage
    const firstNoteId = availableNotes[0]?.id || null;
    if (firstNoteId) {
      localStorage.setItem(`selectedNote_${folderId}`, firstNoteId);
      console.log(`🔄 Stored note not found, falling back to first note: ${firstNoteId}`);
    }
    return firstNoteId;
  } catch {
    // localStorage not available - just return first note
    return availableNotes[0]?.id || null;
  }
};

// Initialize selection when notes are first loaded
watch(notes, (newNotes) => {
  // Only set initial selection if not already set and notes are available
  if (!currentNoteId.value && newNotes.length > 0) {
    currentNoteId.value = getStoredNoteId(newNotes);
  }

  // Handle case where currently selected note was deleted
  if (currentNoteId.value && newNotes.length > 0) {
    const noteExists = newNotes.some(n => n.id === currentNoteId.value);
    if (!noteExists) {
      console.log(`⚠️ Selected note ${currentNoteId.value} was deleted, selecting new note`);
      currentNoteId.value = getStoredNoteId(newNotes);
    }
  }

  // Handle case where all notes were deleted
  if (currentNoteId.value && newNotes.length === 0) {
    console.log('🗑️ All notes deleted, clearing selection');
    currentNoteId.value = null;
    try {
      localStorage.removeItem(`selectedNote_${folderId}`);
    } catch {
      // localStorage not available
    }
  }
}, { immediate: true });

// Loading and error state for the initial fetch
const isFetching = computed(
  () => notesStore.loadingStates.value.get(folderId) ?? false
);
const error = ref<APIError | null>(null); // Main error state for critical failures

// Use shared fullscreen composable
const fullscreen = useFullscreenModal<string>();

// Computed property for the fullscreen note
const currentFullscreenNote = computed(() => {
  if (!fullscreen.fullscreenId.value) return null;
  return notesStore.getNote(fullscreen.fullscreenId.value) ?? null;
});

// Persist selected note to localStorage when it changes
watch(currentNoteId, (noteId) => {
  if (typeof window === 'undefined' || !noteId) return;
  try {
    // Verify note belongs to this folder before saving
    const note = notesStore.getNote(noteId);
    if (note && note.folderId === folderId) {
      localStorage.setItem(`selectedNote_${folderId}`, noteId);
      console.log(`💾 Saved selected note: ${noteId} for folder: ${folderId}`);
    }
  } catch (err) {
    console.error('Failed to save selected note:', err);
  }
});

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
const deleteNote = (id: string) => {
  noteToDelete.value = id;
  showDeleteConfirm.value = true;
};

const confirmDeleteNote = async () => {
  if (noteToDelete.value) {
    await notesStore.deleteNote(noteToDelete.value);
    noteToDelete.value = null;
  }
  showDeleteConfirm.value = false;
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

// Fullscreen functionality is now handled by useFullscreen composable

// Auto-sync on mount and handle errors
onMounted(async () => {
  try {
    error.value = null;
    await notesStore.syncWithServer(folderId);
  } catch (e: unknown) {
    error.value =
      e instanceof APIError ? e : new APIError("Failed to load notes");
  }

});
</script>

<style scoped>
.notes-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
