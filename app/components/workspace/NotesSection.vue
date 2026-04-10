<script setup lang="ts">
import type { NoteState } from "~/composables/workspaces/useNotesStore";
import { useNotesStore } from "~/composables/workspaces/useNotesStore";
import { APIError } from "~/services/FetchFactory";
import { ReorderGroup, ReorderItem } from "motion-v";
import type { MathNoteMetadata, CanvasNoteMetadata } from "@@/shared/utils/note.contract";
import { useAdaptiveToolbar } from "~/composables/ui/useAdaptiveToolbar";
import { useExportContent } from "~/composables/shared/useExportContent";

const route = useRoute();
const workspaceId = route.params.id as string;
const emit = defineEmits(["add-to-material"]);

// Use the optimistic notes store
const notesStore = useNotesStore(workspaceId);
const { exportContent } = useExportContent();

// Cached list of ordered IDs to prevent sorting on every text change
const orderedNoteIds = ref<string[]>([]);

watch(
  () => {
    // Only track id and order, ignores content changes
    const arr = Array.from(notesStore.notes.value.values());
    return arr.map(n => `${n.id}:${n.order}`).join('|');
  },
  () => {
    const allNotes = Array.from(notesStore.notes.value.values());
    allNotes.sort((a, b) => a.order - b.order);
    orderedNoteIds.value = allNotes.map(n => n.id);
  },
  { immediate: true }
);

const notes = computed(() => {
  return orderedNoteIds.value
    .map(id => notesStore.notes.value.get(id))
    .filter((n): n is NoteState => !!n);
});

// Local writable ref for ReorderGroup v-model
const localNotes = ref<NoteState[]>([]);
const isReordering = ref(false);
const showDeleteConfirm = ref(false);
const noteToDelete = ref<string | null>(null);

// Initialize currentNoteId - will be set when notes load
const currentNoteId = ref<string | null>(null);

// Restore last selected note for this workspace from localStorage
const getStoredNoteId = (availableNotes: NoteState[]): string | null => {
  if (typeof window === 'undefined') return null;

  // No notes available - clean up localStorage for this workspace
  if (availableNotes.length === 0) {
    try {
      localStorage.removeItem(`selectedNote_${workspaceId}`);
    } catch {
      // localStorage not available
    }
    return null;
  }

  try {
    const stored = localStorage.getItem(`selectedNote_${workspaceId}`);
    // Verify the note still exists and belongs to this workspace
    if (stored && availableNotes.some(n => n.id === stored && n.workspaceId === workspaceId)) {
      return stored;
    }

    // Stored note doesn't exist anymore - fallback to first note and update storage
    const firstNoteId = availableNotes[0]?.id || null;
    if (firstNoteId) {
      localStorage.setItem(`selectedNote_${workspaceId}`, firstNoteId);
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
      localStorage.removeItem(`selectedNote_${workspaceId}`);
    } catch {
      // localStorage not available
    }
  }
}, { immediate: true });

// Loading and error state for the initial fetch
const isFetching = computed(
  () => notesStore.loadingStates.value.get(`workspace-${workspaceId}`) ?? false
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
    // Verify note belongs to this workspace before saving
    const note = notesStore.getNote(noteId);
    if (note && note.workspaceId === workspaceId) {
      localStorage.setItem(`selectedNote_${workspaceId}`, noteId);
      console.log(`💾 Saved selected note: ${noteId} for workspace: ${workspaceId}`);
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
const createNewNote = async (noteType: string = "TEXT") => {
  const noteId = await notesStore.createNote("", [], noteType);

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

// Update math note metadata
const handleMathUpdate = async (id: string, metadata: MathNoteMetadata) => {
  const note = notesStore.getNote(id);
  if (!note) return;
  const updatedNote: NoteState = {
    ...note,
    metadata: metadata as unknown as Record<string, unknown>,
    content: metadata.lines.map((l) => `${l.latex} = ${l.result ?? "?"}`).join("\n"),
    isDirty: true,
    updatedAt: new Date(),
  };
  await saveNoteToIndexedDB(updatedNote);
  await notesStore.updateNote(id, updatedNote);
};

// Update canvas note metadata
const handleCanvasUpdate = async (id: string, metadata: CanvasNoteMetadata) => {
  const note = notesStore.getNote(id);
  if (!note) return;
  const updatedNote: NoteState = {
    ...note,
    metadata: metadata as unknown as Record<string, unknown>,
    content: `Canvas (${metadata.shapes.length} shapes)`,
    isDirty: true,
    updatedAt: new Date(),
  };
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
    await notesStore.syncWithServer();
  } catch (e: unknown) {
    error.value =
      e instanceof APIError ? e : new APIError("Failed to load notes");
  }
});

// Dropdown items for 'New Note'
const newNoteDropdownItems = [
  [{
    label: 'Text Note',
    icon: 'i-heroicons-document-text',
    onSelect: () => createNewNote('TEXT')
  }, {
    label: 'Math Note',
    icon: 'i-heroicons-calculator',
    onSelect: () => createNewNote('MATH')
  }, {
    label: 'Canvas',
    icon: 'i-heroicons-paint-brush',
    onSelect: () => createNewNote('CANVAS')
  }]
];

const isDrawerOpen = ref(false);

// ─── Adaptive Toolbar ─────────────────────────────────────────────
const { containerRef: toolbarRef, tier, showLabels, showSecondaryActions, isOverflowing } = useAdaptiveToolbar();
</script>


<template>
  <ui-card variant="default" size="sm" shadow="none"
    class="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden z-10 relative!" contentClasses="flex flex-col p-0!">
    <!-- Header -->
    <template v-slot:header>
      <div ref="toolbarRef" class="adaptive-toolbar w-full">
        <div class="flex items-center gap-2">
          <span>Notes</span>
          <ui-label v-if="notes?.length"> ( {{ notes.length }} ) </ui-label>
        </div>

        <div class="toolbar-actions">
          <UDropdownMenu :items="newNoteDropdownItems" :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
            <u-button size="sm" color="primary" variant="ghost"
              :trailing-icon="showLabels ? 'i-heroicons-chevron-down' : ''">
              <u-icon name="i-heroicons-plus" />
              <span v-if="showLabels" class="toolbar-label">New Note</span>
            </u-button>
          </UDropdownMenu>

          <Transition name="toolbar-fade">
            <u-button v-if="notes?.length" size="sm" color="neutral" variant="link"
              @click="isDrawerOpen = !isDrawerOpen" :aria-label="isDrawerOpen ? 'Close notes list' : 'Open notes list'">
              <icon :name="isDrawerOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'" class="w-4 h-4" />
            </u-button>
          </Transition>
        </div>
      </div>
    </template>
    <template #default>
      <ui-loader :is-fetching="isFetching" v-if="isFetching" label="Loading notes..." />
      <!-- Error state for initial fetch -->
      <shared-error-message v-if="error" :error="error" />

      <!-- Notes content -->

      <!-- Empty state -->
      <shared-empty-state v-if="!error && !isFetching && !notes?.length" title="No Notes."
        button-text="Create First Note" :center-description="true" @action="createNewNote('TEXT')">
        <template #description>
          Create your first note to capture important <br />thoughts and ideas
          for this workspace.
        </template>
      </shared-empty-state>

      <!-- Notes grid -->
      <div v-if="!error && !isFetching && notes?.length" class="flex flex-1 min-h-0 overflow-hidden" id="notes-section">
        <ui-drawer :show="isDrawerOpen" @closed="isDrawerOpen = false" :mobile="false" :lock-scroll="false"
          teleport-to="#notes-section" :backdrop="false" :handle-visible="2" title="Notes">
          <div class="relative shrink-0 overflow-auto bg-light  rounded border border-secondary">
            <workspace-notes-search :workspace-id="workspaceId" />
            <ReorderGroup v-model:values="localNotes" axis="y" class="relative flex-1 shrink-0 overflow-auto"
              @reorder="handleReorder">
              <UContextMenu v-for="(note, idx) in localNotes" :key="note.id" :items="[
                // { label: 'Edit', onSelect: () => editNote(note) },
                { label: 'Download as TXT', icon: 'i-heroicons-document-text', onSelect: () => exportContent('note', note.content, 'txt') },
                { label: 'Download as DOC', icon: 'i-heroicons-document', onSelect: () => exportContent('note', note.content, 'doc') },
                { label: 'Download as PDF', icon: 'i-heroicons-document', onSelect: () => exportContent('note', note.content, 'pdf') },
                { label: 'Delete', onSelect: () => deleteNote(note.id) },
              ]" :context="note">
                <ReorderItem :value="note" :class="[
                  'relative flex items-center gap-2 group w-full p-2.5  cursor-pointer hover:bg-secondary',
                  idx === localNotes.length - 1 ? '' : 'border-b border-secondary',
                  notesStore.filteredNoteIds.value
                    ? notesStore.filteredNoteIds.value.has(note.id)
                      ? 'font-bold'
                      : 'opacity-50'
                    : '',
                ]" @click="currentNoteId = note.id">
                  <div v-if="note.isLoading" class="flex items-center gap-1 text-primary">
                    <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                  </div>
                  <ui-paragraph size="xs" class="truncate">
                    <span v-if="note.noteType === 'CANVAS'" class="mr-1 text-warning">🎨</span>
                    <span v-else-if="note.noteType === 'MATH'" class="mr-1 text-primary">∑</span>
                    {{
                      note.content
                        .replace(/<[^>]*>/g, "")
                        .trim()
                        .slice(0, 30) || (
                        note.noteType === 'MATH' ? 'Math note' :
                          note.noteType === 'CANVAS' ? 'Canvas note' :
                            'Empty note')
                    }}
                  </ui-paragraph>
                </ReorderItem>
              </UContextMenu>
            </ReorderGroup>
          </div>
        </ui-drawer>

        <workspace-math-note-editor v-if="notesStore.getNote(currentNoteId!)?.noteType === 'MATH'"
          :note-id="currentNoteId!"
          :initial-metadata="(notesStore.getNote(currentNoteId!)?.metadata as MathNoteMetadata | undefined)"
          @update="(meta: MathNoteMetadata) => handleMathUpdate(currentNoteId!, meta)"
          @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
        <workspace-canvas-note-editor v-else-if="notesStore.getNote(currentNoteId!)?.noteType === 'CANVAS'"
          :note-id="currentNoteId!"
          :initial-metadata="(notesStore.getNote(currentNoteId!)?.metadata as CanvasNoteMetadata | undefined)"
          @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentNoteId!, meta)"
          @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
        <workspace-text-note v-else-if="notesStore.getNote(currentNoteId!)" :note="notesStore.getNote(currentNoteId!)!"
          :delete-note="deleteNote" size="lg" @update="handleUpdateNote" @retry="handleRetry"
          @toggle-fullscreen="fullscreen.toggle" placeholder="Double-click to add your note..."
          @add-to-material="emit('add-to-material', $event)" />
      </div>
    </template>
  </ui-card>

  <!-- Fullscreen Note View -->
  <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" aria-label="Note fullscreen view" max-width="900px"
    max-height="80vh" @close="fullscreen.close">
    <!-- <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-medium text-gray-900 dark:text-gray-100"></span>
        <u-button variant="ghost" size="xs" aria-label="Close fullscreen" @click="fullscreen.close">
          <icon name="i-heroicons-x-mark" :size="UI_CONFIG.ICON_SIZE" />
        </u-button>
      </div>
    </template> -->

    <div v-if="currentFullscreenNote" class="h-full">
      <workspace-math-note-editor v-if="currentFullscreenNote.noteType === 'MATH'" :note-id="currentFullscreenNote.id"
        :initial-metadata="(currentFullscreenNote!.metadata as MathNoteMetadata | undefined)" :is-fullscreen="true"
        @update="(meta: MathNoteMetadata) => handleMathUpdate(currentFullscreenNote!.id, meta)"
        @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
      <workspace-canvas-note-editor v-else-if="currentFullscreenNote.noteType === 'CANVAS'"
        :note-id="currentFullscreenNote.id"
        :initial-metadata="(currentFullscreenNote!.metadata as CanvasNoteMetadata | undefined)" :is-fullscreen="true"
        @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentFullscreenNote!.id, meta)"
        @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
      <workspace-text-note v-else :note="currentFullscreenNote" :delete-note="deleteNote" :is-fullscreen="true"
        size="lg" @update="handleUpdateNote" @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
        placeholder="Double-click to add your note..." @add-to-material="emit('add-to-material', $event)" />
    </div>
  </shared-fullscreen-wrapper>

  <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Note" @close="showDeleteConfirm = false"
    @confirm="confirmDeleteNote">
    Are you sure you want to delete this note? This action cannot be undone.
  </shared-delete-confirmation-modal>
</template>


<style scoped>
.notes-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ─── Adaptive Toolbar ───────────────────────────────────────────── */
.adaptive-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  position: relative;
}

.toolbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
  justify-content: flex-end;
}

.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
  transition: opacity 0.25s ease, max-width 0.25s ease, margin 0.25s ease;
  overflow: hidden;
}

.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
  opacity: 0;
  max-width: 0;
  margin-left: 0;
  margin-right: 0;
}

.toolbar-label {
  transition: opacity 0.2s ease;
}
</style>
