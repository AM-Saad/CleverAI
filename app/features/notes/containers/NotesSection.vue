<script setup lang="ts">
import { APIError } from "~/services/FetchFactory";
import { ReorderGroup, ReorderItem } from "motion-v";
import type { MathNoteMetadata, CanvasNoteMetadata, NoteType } from "@@/shared/utils/note.contract";
import LocalSyncStatus from "~/components/shared/LocalSyncStatus.vue";
import type { NoteState } from "~/features/notes/composables/useNotesStore";
import CanvasNoteEditor from "../components/CanvasNoteEditor.vue";
import MathNoteEditor from "../components/MathNoteEditor.vue";
import NotesSearch from "../components/NotesSearch.vue";
import NotesSplitDropZone from "../components/NotesSplitDropZone.vue";
import TextNote from "../components/TextNote.vue";
import { useNotesStore } from "../composables/useNotesStore";

const route = useRoute();
const workspaceId = route.params.id as string;
const emit = defineEmits(["add-to-material"]);

// Use the optimistic notes store
const notesStore = useNotesStore(workspaceId);
const { exportContent } = useExportContent();
const networkStatus = useNetworkStatus();

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
  () => notesStore.loadingStates.value.get(workspaceId) ?? false
);
const error = ref<APIError | null>(null); // Main error state for critical failures
const dirtyNotesCount = computed(() =>
  Array.from(notesStore.notes.value.values()).filter((note) => note.isDirty).length,
);
const failedNotesCount = computed(() =>
  Array.from(notesStore.notes.value.values()).filter((note) => Boolean(note.error)).length,
);

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
const createNewNote = async (noteType: NoteType = "TEXT") => {
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

  // The store's updateNote handles both IDB persistence and debounced server sync
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
  await notesStore.updateNote(id, updatedNote);
};

// Delete a note (optimistic with rollback on failure)
const deleteNote = (id: string) => {
  noteToDelete.value = id;
  showDeleteConfirm.value = true;
};

const confirmDeleteNote = async () => {
  if (noteToDelete.value) {
    splitNotes.handleNoteDeleted(noteToDelete.value);
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

const syncNotesNow = async () => {
  error.value = null;
  await notesStore.syncWithServer();
};

const retryFailedNotes = async () => {
  const failedNotes = Array.from(notesStore.notes.value.values()).filter((note) => note.error);
  for (const note of failedNotes) {
    await notesStore.retryFailedNote(note.id);
  }
};

const handleSyncStatusAction = async () => {
  if (failedNotesCount.value > 0) {
    await retryFailedNotes();
    return;
  }

  await syncNotesNow();
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

const shouldSyncNotes = () => {
  if (notesStore.lastSync.value) return false;
  return !(notesStore.loadingStates.value.get(workspaceId) ?? false);
};

// Auto-sync on mount and handle errors
onMounted(async () => {
  try {
    error.value = null;
    if (shouldSyncNotes()) {
      await notesStore.syncWithServer();
    }
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

// ─── Split Notes ─────────────────────────────────────────────────
const splitNotes = useSplitNotes(workspaceId, () => {
  const ids = new Set<string>();
  for (const id of notesStore.notes.value.keys()) ids.add(id);
  return ids;
});

// Keep splitNotes in sync with drawer selection
watch(currentNoteId, (id) => {
  if (!id) return;
  // Skip when the change was triggered by pane activation (already handled)
  if (_skipNextWatcherSync.value) {
    _skipNextWatcherSync.value = false;
    return;
  }
  if (!splitNotes.isSplit.value) {
    // Single-view: always update primary
    splitNotes.setPrimaryNote(id);
  } else {
    // Split-view: update whichever pane is active
    if (splitNotes.activePane.value === 'primary') {
      // Guard: don't set primary to same as secondary
      if (id !== splitNotes.secondaryNoteId.value) {
        splitNotes.setPrimaryNote(id);
      }
    } else {
      // Active pane is secondary — update secondary note
      if (id !== splitNotes.primaryNoteId.value) {
        splitNotes.setSecondaryNote(id);
      }
    }
  }
});

// Restore split state once notes are loaded
watch(notes, (newNotes) => {
  if (newNotes.length >= 2 && !splitNotes.isSplit.value) {
    splitNotes.restore();
    // After restore, sync currentNoteId if primary was set
    if (splitNotes.primaryNoteId.value && newNotes.some(n => n.id === splitNotes.primaryNoteId.value)) {
      currentNoteId.value = splitNotes.primaryNoteId.value;
    }
  }
}, { once: true });

// Handle note deletion — propagate to split state
const _originalDeleteConfirm = confirmDeleteNote;

// Drag-to-split: track whether a split-drag is in flight globally
const isSplitDragging = ref(false);

function handleSplitDragStart(event: DragEvent, noteId: string) {
  event.dataTransfer!.setData('text/note-id', noteId);
  event.dataTransfer!.effectAllowed = 'copy';
  isSplitDragging.value = true;
}

function handleSplitDragEnd() {
  isSplitDragging.value = false;
  splitNotes.endDragOver();
}

function handleSplitDrop(noteId: string, position: 'left' | 'right') {
  isSplitDragging.value = false;
  splitNotes.endDragOver();
  // Don't split to same note as current primary
  if (noteId === currentNoteId.value) return;
  splitNotes.setPrimaryNote(currentNoteId.value);
  splitNotes.openSplit(noteId, position);
}

// Toggle split from toolbar: open with next note, or close
function toggleSplitView() {
  if (splitNotes.isSplit.value) {
    splitNotes.closeSplit();
    return;
  }
  // Pick the next note that isn't currentNoteId
  const others = notes.value.filter(n => n.id !== currentNoteId.value);
  if (!others.length) return;
  splitNotes.setPrimaryNote(currentNoteId.value);
  splitNotes.openSplit(others[0]!.id, 'right');
}

// Computed: is a given note the secondary (split) note?
const isNoteInSplit = (noteId: string) =>
  splitNotes.isSplit.value &&
  (noteId === splitNotes.primaryNoteId.value || noteId === splitNotes.secondaryNoteId.value);

// Computed: active/passive per pane side
const isLeftActive = computed(() => splitNotes.activePaneSide.value === 'left');
const isRightActive = computed(() => splitNotes.activePaneSide.value === 'right');

// Activate a pane and sync currentNoteId to the note in that pane
const _skipNextWatcherSync = ref(false);
const splitPaneLayoutRef = ref<InstanceType<typeof import('~/components/shared/SplitPaneLayout.vue').default> | null>(null);

function activateLeftPane() {
  splitNotes.activateLeft();
  const noteId = splitNotes.leftNoteId.value;
  if (noteId && noteId !== currentNoteId.value) {
    _skipNextWatcherSync.value = true;
    currentNoteId.value = noteId;
  }
}

function activateRightPane() {
  splitNotes.activateRight();
  const noteId = splitNotes.rightNoteId.value;
  if (noteId && noteId !== currentNoteId.value) {
    _skipNextWatcherSync.value = true;
    currentNoteId.value = noteId;
  }
}

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
              <shared-icon name="plus" />
              <span v-if="showLabels" class="toolbar-label">New Note</span>
            </u-button>
          </UDropdownMenu>


          <Transition name="toolbar-fade">
            <u-button v-if="notes?.length >= 2" size="sm" :color="splitNotes.isSplit.value ? 'primary' : 'neutral'"
              variant="link" :aria-label="splitNotes.isSplit.value ? 'Close split view' : 'Open split view'"
              :aria-pressed="splitNotes.isSplit.value" @click="toggleSplitView">
              <shared-icon name="split" class="w-4 h-4" />
            </u-button>
          </Transition>

          <Transition name="toolbar-fade">
            <u-button v-if="notes?.length" size="sm" color="neutral" variant="link"
              @click="isDrawerOpen = !isDrawerOpen" :aria-label="isDrawerOpen ? 'Close notes list' : 'Open notes list'">
              <shared-icon :name="isDrawerOpen ? 'panel-left-close' : 'panel-left-open'" class="w-4 h-4" />
            </u-button>
          </Transition>
        </div>
      </div>
    </template>
    <template #default>
      <ui-loader :is-fetching="isFetching" v-if="isFetching" label="Loading notes..." />
      <!-- Error state for initial fetch -->
      <shared-error-message v-if="error" :error="error" />

      <LocalSyncStatus
        v-if="!error && notes?.length"
        class="mx-4 mt-3"
        feature-label="Notes"
        :pending-count="dirtyNotesCount"
        :error-count="failedNotesCount"
        :is-fetching="isFetching"
        :is-online="networkStatus.isOnline.value"
        :is-verified-online="networkStatus.isVerifiedOnline.value"
        :is-connecting="networkStatus.isConnecting.value"
        :last-sync="notesStore.lastSync.value"
        :action-label="failedNotesCount > 0 ? 'Retry failed' : 'Sync now'"
        :action-disabled="isFetching"
        @action="handleSyncStatusAction"
      />

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
            <NotesSearch :workspace-id="workspaceId" />
            <ReorderGroup v-model:values="localNotes" axis="y" class="relative flex-1 shrink-0 overflow-auto"
              @reorder="handleReorder">
              <UContextMenu v-for="(note, idx) in localNotes" :key="note.id" :items="[
                // { label: 'Edit', onSelect: () => editNote(note) },
                { label: 'Download as TXT', icon: 'i-heroicons-document-text', onSelect: () => exportContent('note', note.content, 'txt') },
                { label: 'Download as DOC', icon: 'i-heroicons-document', onSelect: () => exportContent('note', note.content, 'doc') },
                { label: 'Download as PDF', icon: 'i-heroicons-document', onSelect: () => exportContent('note', note.content, 'pdf') },
                {
                  label: isNoteInSplit(note.id) ? 'Remove from Split' : 'Open in Split View',
                  icon: 'i-lucide-columns-2',
                  disabled: localNotes.length < 2 || (isNoteInSplit(note.id) && note.id === splitNotes.primaryNoteId.value && !splitNotes.isSplit.value),
                  onSelect: () => isNoteInSplit(note.id) && note.id === splitNotes.secondaryNoteId.value
                    ? splitNotes.closeSplit()
                    : (splitNotes.setPrimaryNote(currentNoteId), splitNotes.openSplit(note.id, 'right'))
                },
                { label: 'Delete', onSelect: () => deleteNote(note.id) },
              ]" :context="note">
                <ReorderItem :value="note" :class="[
                  'relative flex items-center gap-2 group w-full p-2.5 cursor-pointer hover:bg-secondary',
                  idx === localNotes.length - 1 ? '' : 'border-b border-secondary',
                  notesStore.filteredNoteIds.value
                    ? notesStore.filteredNoteIds.value.has(note.id)
                      ? 'font-bold'
                      : 'opacity-50'
                    : '',
                  note.id === splitNotes.primaryNoteId.value && splitNotes.isSplit.value ? 'split-indicator-primary' : '',
                  note.id === splitNotes.secondaryNoteId.value ? 'split-indicator-secondary' : '',
                ]" @click="currentNoteId = note.id">
                  <div v-if="note.isLoading" class="flex items-center gap-1 text-primary">
                    <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                  </div>
                  <ui-paragraph size="xs" class="truncate flex-1">
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
                  <div class="flex items-center gap-1 shrink-0">
                    <span
                      v-if="note.error"
                      class="inline-flex items-center rounded-full bg-error/10 px-1.5 py-0.5 text-[10px] font-medium text-error"
                      title="Sync failed. Open the note to retry."
                    >
                      Retry
                    </span>
                    <span
                      v-else-if="note.isDirty"
                      class="inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                      title="Saved locally and waiting to sync."
                    >
                      Local
                    </span>
                  </div>
                  <!-- Split drag handle — separate from ReorderItem drag (HTML5 DnD) -->
                  <span v-if="localNotes.length >= 2" draggable="true"
                    class="split-drag-handle opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity cursor-grab active:cursor-grabbing shrink-0 hidden sm:flex"
                    :aria-label="`Drag to split view: ${note.content.replace(/<[^>]*>/g, '').trim().slice(0, 20) || 'note'}`"
                    @pointerdown.stop @dragstart="handleSplitDragStart($event, note.id)" @dragend="handleSplitDragEnd">
                    <shared-icon name="split" class="w-3.5 h-3.5 text-content-secondary" />
                  </span>
                </ReorderItem>
              </UContextMenu>
            </ReorderGroup>
          </div>
        </ui-drawer>


        <!-- ── Editor area: single or split ─────────────────────────── -->

        <!-- Single view (no split) -->
        <template v-if="!splitNotes.isSplit.value">
          <!-- Drop zone overlay — visible only when dragging a split handle -->
          <div class="relative flex flex-1 min-h-0 min-w-0 overflow-hidden" @dragover.prevent @dragenter.prevent>
            <NotesSplitDropZone :is-dragging="isSplitDragging" :hovered-zone="splitNotes.hoveredZone.value"
              @hover-zone="(z) => z ? splitNotes.startDragOver(z) : splitNotes.endDragOver()" @drop="handleSplitDrop" />
            <MathNoteEditor v-if="notesStore.getNote(currentNoteId!)?.noteType === 'MATH'" :note-id="currentNoteId!"
              :initial-metadata="(notesStore.getNote(currentNoteId!)?.metadata as MathNoteMetadata | undefined)"
              @update="(meta: MathNoteMetadata) => handleMathUpdate(currentNoteId!, meta)"
              @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
            <CanvasNoteEditor v-else-if="notesStore.getNote(currentNoteId!)?.noteType === 'CANVAS'"
              :note-id="currentNoteId!"
              :initial-metadata="(notesStore.getNote(currentNoteId!)?.metadata as CanvasNoteMetadata | undefined)"
              @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentNoteId!, meta)"
              @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
            <TextNote v-else-if="notesStore.getNote(currentNoteId!)" :note="notesStore.getNote(currentNoteId!)!"
              :delete-note="deleteNote" size="lg" @update="handleUpdateNote" @retry="handleRetry"
              @toggle-fullscreen="fullscreen.toggle" placeholder="Double-click to add your note..."
              @add-to-material="emit('add-to-material', $event)" />
          </div>
        </template>

        <!-- Split view -->
        <template v-else>
          <shared-split-pane-layout ref="splitPaneLayoutRef" :storage-key="`splitPaneSizes_${workspaceId}`"
            :left-label="notesStore.getNote(splitNotes.leftNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0, 20) || 'Note'"
            :right-label="notesStore.getNote(splitNotes.rightNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0, 20) || 'Note'"
            left-icon="i-lucide-notebook-pen" right-icon="i-lucide-notebook-pen" class="flex-1 min-h-0 min-w-0">
            <!-- LEFT PANE slot -->
            <template #left>
              <div class="split-pane" :class="isLeftActive ? 'split-pane--active' : 'split-pane--passive'"
                @pointerdown.capture="activateLeftPane">
                <!-- Pane header -->
                <div class="split-pane-header" @pointerdown.stop>
                  <span class="split-pane-title truncate">
                    {{ notesStore.getNote(splitNotes.leftNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0,
                      28) || 'Note' }}
                  </span>
                  <div class="flex items-center gap-1 shrink-0">
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Minimize left pane"
                      @click="splitPaneLayoutRef?.toggleLeft()">
                      <shared-icon name="panel-left-close" class="w-3.5 h-3.5" />
                    </u-button>
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Swap panes"
                      @click="splitNotes.swapPanes()">
                      <icon name="i-lucide-arrow-left-right" class="w-3.5 h-3.5" />
                    </u-button>
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Close left pane"
                      @click="isLeftActive ? splitNotes.closePane('primary') : splitNotes.closePane('secondary')">
                      <icon name="i-lucide-x" class="w-3.5 h-3.5" />
                    </u-button>
                  </div>
                </div>
                <!-- Left editor -->
                <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isLeftActive }">
                  <template v-if="splitNotes.leftNoteId.value && notesStore.getNote(splitNotes.leftNoteId.value)">
                    <MathNoteEditor v-if="notesStore.getNote(splitNotes.leftNoteId.value)?.noteType === 'MATH'"
                      :key="`split-left-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                      :initial-metadata="(notesStore.getNote(splitNotes.leftNoteId.value)?.metadata as MathNoteMetadata | undefined)"
                      :readonly="!isLeftActive"
                      @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.leftNoteId.value!, meta)"
                      @toggle-fullscreen="fullscreen.toggle(splitNotes.leftNoteId.value!)"
                      @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                    <CanvasNoteEditor v-else-if="notesStore.getNote(splitNotes.leftNoteId.value)?.noteType === 'CANVAS'"
                      :key="`split-left-canvas-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                      :initial-metadata="(notesStore.getNote(splitNotes.leftNoteId.value)?.metadata as CanvasNoteMetadata | undefined)"
                      :readonly="!isLeftActive"
                      @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.leftNoteId.value!, meta)"
                      @toggle-fullscreen="fullscreen.toggle(splitNotes.leftNoteId.value!)"
                      @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                    <TextNote v-else :key="`split-left-text-${splitNotes.leftNoteId.value}`"
                      :note="notesStore.getNote(splitNotes.leftNoteId.value)!" :delete-note="deleteNote"
                      :readonly="!isLeftActive" size="lg" @update="handleUpdateNote" @retry="handleRetry"
                      @toggle-fullscreen="fullscreen.toggle" @add-to-material="emit('add-to-material', $event)" />
                  </template>
                </div>
              </div>
            </template>

            <!-- RIGHT PANE slot -->
            <template #right>
              <div class="split-pane" :class="isRightActive ? 'split-pane--active' : 'split-pane--passive'"
                @pointerdown.capture="activateRightPane">
                <!-- Pane header -->
                <div class="split-pane-header" @pointerdown.stop>
                  <span class="split-pane-title truncate">
                    {{ notesStore.getNote(splitNotes.rightNoteId.value!)?.content.replace(/<[^>]*>/g,
                      '').trim().slice(0, 28) || 'Note' }}
                  </span>
                  <div class="flex items-center gap-1 shrink-0">
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Minimize right pane"
                      @click="splitPaneLayoutRef?.toggleRight()">
                      <icon name="i-lucide-panel-right-close" class="w-3.5 h-3.5" />
                    </u-button>
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Swap panes"
                      @click="splitNotes.swapPanes()">
                      <icon name="i-lucide-arrow-left-right" class="w-3.5 h-3.5" />
                    </u-button>
                    <u-button size="xs" color="neutral" variant="ghost" aria-label="Close right pane"
                      @click="isRightActive ? splitNotes.closePane('secondary') : splitNotes.closePane('primary')">
                      <icon name="i-lucide-x" class="w-3.5 h-3.5" />
                    </u-button>
                  </div>
                </div>
                <!-- Right editor -->
                <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isRightActive }">
                  <template v-if="splitNotes.rightNoteId.value && notesStore.getNote(splitNotes.rightNoteId.value)">
                    <MathNoteEditor v-if="notesStore.getNote(splitNotes.rightNoteId.value)?.noteType === 'MATH'"
                      :key="`split-right-${splitNotes.rightNoteId.value}`" :note-id="splitNotes.rightNoteId.value"
                      :initial-metadata="(notesStore.getNote(splitNotes.rightNoteId.value)?.metadata as MathNoteMetadata | undefined)"
                      :readonly="!isRightActive"
                      @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.rightNoteId.value!, meta)"
                      @toggle-fullscreen="fullscreen.toggle(splitNotes.rightNoteId.value!)"
                      @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                    <CanvasNoteEditor
                      v-else-if="notesStore.getNote(splitNotes.rightNoteId.value)?.noteType === 'CANVAS'"
                      :key="`split-right-canvas-${splitNotes.rightNoteId.value}`"
                      :note-id="splitNotes.rightNoteId.value"
                      :initial-metadata="(notesStore.getNote(splitNotes.rightNoteId.value)?.metadata as CanvasNoteMetadata | undefined)"
                      :readonly="!isRightActive"
                      @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.rightNoteId.value!, meta)"
                      @toggle-fullscreen="fullscreen.toggle(splitNotes.rightNoteId.value!)"
                      @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                    <TextNote v-else :key="`split-right-text-${splitNotes.rightNoteId.value}`"
                      :note="notesStore.getNote(splitNotes.rightNoteId.value)!" :delete-note="deleteNote"
                      :readonly="!isRightActive" size="lg" @update="handleUpdateNote" @retry="handleRetry"
                      @toggle-fullscreen="fullscreen.toggle" @add-to-material="emit('add-to-material', $event)" />
                  </template>
                </div>
              </div>
            </template>
          </shared-split-pane-layout>
        </template>

      </div>
    </template>
  </ui-card>

  <!-- Fullscreen Note View -->
  <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" aria-label="Note fullscreen view"
    :max-width="splitNotes.isSplit.value ? '95vw' : '900px'" max-height="90vh" @close="fullscreen.close">

    <div v-if="currentFullscreenNote" class="h-full">

      <!-- Single fullscreen -->
      <template v-if="!splitNotes.isSplit.value">
        <MathNoteEditor v-if="currentFullscreenNote.noteType === 'MATH'" :note-id="currentFullscreenNote.id"
          :initial-metadata="(currentFullscreenNote!.metadata as MathNoteMetadata | undefined)" :is-fullscreen="true"
          @update="(meta: MathNoteMetadata) => handleMathUpdate(currentFullscreenNote!.id, meta)"
          @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
        <CanvasNoteEditor v-else-if="currentFullscreenNote.noteType === 'CANVAS'" :note-id="currentFullscreenNote.id"
          :initial-metadata="(currentFullscreenNote!.metadata as CanvasNoteMetadata | undefined)" :is-fullscreen="true"
          @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentFullscreenNote!.id, meta)"
          @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
        <TextNote v-else :note="currentFullscreenNote" :delete-note="deleteNote" :is-fullscreen="true" size="lg"
          @update="handleUpdateNote" @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
          placeholder="Double-click to add your note..." @add-to-material="emit('add-to-material', $event)" />
      </template>

      <!-- Split fullscreen -->
      <template v-else>
        <shared-split-pane-layout :storage-key="`splitPaneSizes_${workspaceId}`"
          :left-label="notesStore.getNote(splitNotes.leftNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0, 20) || 'Note'"
          :right-label="notesStore.getNote(splitNotes.rightNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0, 20) || 'Note'"
          left-icon="i-lucide-notebook-pen" right-icon="i-lucide-notebook-pen" class="flex-1 min-h-0">
          <template #left>
            <div class="split-pane" :class="isLeftActive ? 'split-pane--active' : 'split-pane--passive'"
              @pointerdown.capture="activateLeftPane">
              <div class="split-pane-header" @pointerdown.stop>
                <span class="split-pane-title truncate">
                  {{ notesStore.getNote(splitNotes.leftNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0,
                    28) || 'Note' }}
                </span>
                <u-button size="xs" color="neutral" variant="ghost" aria-label="Swap panes"
                  @click="splitNotes.swapPanes()">
                  <icon name="i-lucide-arrow-left-right" class="w-3.5 h-3.5" />
                </u-button>
              </div>
              <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isLeftActive }">
                <template v-if="splitNotes.leftNoteId.value && notesStore.getNote(splitNotes.leftNoteId.value)">
                  <MathNoteEditor v-if="notesStore.getNote(splitNotes.leftNoteId.value)?.noteType === 'MATH'"
                    :key="`fs-split-left-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                    :initial-metadata="(notesStore.getNote(splitNotes.leftNoteId.value)?.metadata as MathNoteMetadata | undefined)"
                    :is-fullscreen="true" :readonly="!isLeftActive"
                    @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.leftNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                  <CanvasNoteEditor v-else-if="notesStore.getNote(splitNotes.leftNoteId.value)?.noteType === 'CANVAS'"
                    :key="`fs-split-left-canvas-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                    :initial-metadata="(notesStore.getNote(splitNotes.leftNoteId.value)?.metadata as CanvasNoteMetadata | undefined)"
                    :is-fullscreen="true" :readonly="!isLeftActive"
                    @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.leftNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                  <TextNote v-else :key="`fs-split-left-text-${splitNotes.leftNoteId.value}`"
                    :note="notesStore.getNote(splitNotes.leftNoteId.value)!" :delete-note="deleteNote"
                    :is-fullscreen="true" :readonly="!isLeftActive" size="lg" @update="handleUpdateNote"
                    @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
                    @add-to-material="emit('add-to-material', $event)" />
                </template>
              </div>
            </div>
          </template>

          <template #right>
            <div class="split-pane" :class="isRightActive ? 'split-pane--active' : 'split-pane--passive'"
              @pointerdown.capture="activateRightPane">
              <div class="split-pane-header" @pointerdown.stop>
                <span class="split-pane-title truncate">
                  {{ notesStore.getNote(splitNotes.rightNoteId.value!)?.content.replace(/<[^>]*>/g, '').trim().slice(0,
                    28) || 'Note' }}
                </span>
                <u-button size="xs" color="neutral" variant="ghost" aria-label="Swap panes"
                  @click="splitNotes.swapPanes()">
                  <icon name="i-lucide-arrow-left-right" class="w-3.5 h-3.5" />
                </u-button>
              </div>
              <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isRightActive }">
                <template v-if="splitNotes.rightNoteId.value && notesStore.getNote(splitNotes.rightNoteId.value)">
                  <MathNoteEditor v-if="notesStore.getNote(splitNotes.rightNoteId.value)?.noteType === 'MATH'"
                    :key="`fs-split-right-${splitNotes.rightNoteId.value}`" :note-id="splitNotes.rightNoteId.value"
                    :initial-metadata="(notesStore.getNote(splitNotes.rightNoteId.value)?.metadata as MathNoteMetadata | undefined)"
                    :is-fullscreen="true" :readonly="!isRightActive"
                    @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.rightNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                  <CanvasNoteEditor v-else-if="notesStore.getNote(splitNotes.rightNoteId.value)?.noteType === 'CANVAS'"
                    :key="`fs-split-right-canvas-${splitNotes.rightNoteId.value}`"
                    :note-id="splitNotes.rightNoteId.value"
                    :initial-metadata="(notesStore.getNote(splitNotes.rightNoteId.value)?.metadata as CanvasNoteMetadata | undefined)"
                    :is-fullscreen="true" :readonly="!isRightActive"
                    @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.rightNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                  <TextNote v-else :key="`fs-split-right-text-${splitNotes.rightNoteId.value}`"
                    :note="notesStore.getNote(splitNotes.rightNoteId.value)!" :delete-note="deleteNote"
                    :is-fullscreen="true" :readonly="!isRightActive" size="lg" @update="handleUpdateNote"
                    @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
                    @add-to-material="emit('add-to-material', $event)" />
                </template>
              </div>
            </div>
          </template>
        </shared-split-pane-layout>
      </template>

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

/* ─── Split View ─────────────────────────────────────────────────── */

.split-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: opacity 0.2s ease;
  position: relative;
}

.split-pane--active {
  opacity: 1;
}

.split-pane--passive {
  opacity: 0.65;
}

.split-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border-secondary, #e5e7eb);
  background: var(--color-surface, #fff);
  min-height: 32px;
  flex-shrink: 0;
  z-index: 1;
}

.split-pane--active .split-pane-header {
  border-bottom-color: var(--color-primary, #3b82f6);
  background-color: #38499814;
}

.split-pane-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-content-secondary, #6b7280);
  max-width: calc(100% - 60px);
}

.split-pane--active .split-pane-title {
  color: var(--color-primary, #3b82f6);
}

.split-pane-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  position: relative;
}

/* Split indicators in drawer */
.split-indicator-primary {
  border-left: 2px solid var(--color-primary, #3b82f6);
}

.split-indicator-secondary {
  border-left: 2px solid var(--color-success, #22c55e);
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
