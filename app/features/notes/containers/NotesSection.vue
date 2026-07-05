<script setup lang="ts">
import { APIError } from "~/services/FetchFactory";
import type { MathNoteMetadata, CanvasNoteMetadata, NoteType } from "@@/shared/utils/note.contract";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import type { NoteLayoutItem } from "@@/shared/utils/note-sync.contract";
import type { SplitPosition } from "~/composables/ui/useSplitNotes";
import {
  DEFAULT_WORKSPACE_NOTE_HTML,
  TITLE_FALLBACK,
} from "@@/shared/utils/workspaceNote";
import LocalSyncStatus from "~/components/shared/LocalSyncStatus.vue";
import type { NoteState } from "~/features/notes/composables/useNotesStore";
import CanvasNoteEditor from "~/features/notes/components/CanvasNoteEditor.vue";
import MathNoteEditor from "~/features/notes/components/MathNoteEditor.vue";
import NotesDrawer from "../components/NotesDrawer.vue";
import NotesSplitDropZone from "~/features/notes/components/NotesSplitDropZone.vue";
import NotesSyncInspector from "../components/NotesSyncInspector.vue";
import TextNote from "~/features/notes/components/TextNote.vue";
import { createNotesSplitInteractionController } from "../composables/notesSplitInteractionController";
import { useNoteGroupsStore } from "../composables/useNoteGroupsStore";
import { useNotesStore } from "../composables/useNotesStore";

const route = useRoute();
const workspaceId = route.params.id as string;
const emit = defineEmits(["add-to-material"]);

// Use the optimistic notes store
const notesStore = useNotesStore(workspaceId);
const noteGroupsStore = useNoteGroupsStore(workspaceId);
notesStore.setGroupLayoutProvider(() =>
  noteGroupsStore.orderedGroups.value.map((group, index) => ({
    id: group.id,
    order: group.order ?? index,
  })),
);
const { exportContent } = useExportContent();
const networkStatus = useNetworkStatus();
const isDev = import.meta.dev;
const isDevSyncInspectorVisible = ref(false);

interface TextNoteUpdatePayload {
  title: string;
  content: string;
}

const getNoteDisplayTitle = (note?: NoteState | null, maxLength?: number) => {
  if (!note) {
    return "Note";
  }

  const rawTitle =
    note.noteType === "MATH" && (!note.title || note.title === TITLE_FALLBACK)
      ? "Math note"
      : note.noteType === "CANVAS" && (!note.title || note.title === TITLE_FALLBACK)
        ? "Canvas note"
        : note.title || TITLE_FALLBACK;

  return maxLength ? rawTitle.slice(0, maxLength) : rawTitle;
};

const notes = computed(() => {
  return Array.from(notesStore.notes.value.values()).sort(
    (a, b) => (a.groupId ?? "").localeCompare(b.groupId ?? "") || a.order - b.order,
  );
});

const isReordering = ref(false);

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
    const stored = notesStore.resolveNoteId(localStorage.getItem(`selectedNote_${workspaceId}`));
    // Verify the note still exists and belongs to this workspace
    if (stored && availableNotes.some(n => n.id === stored && n.workspaceId === workspaceId)) {
      return stored;
    }

    // Stored note doesn't exist anymore - fallback to first note and update storage
    const firstNoteId = availableNotes[0]?.id || null;
    if (firstNoteId) {
      localStorage.setItem(`selectedNote_${workspaceId}`, firstNoteId);
    }
    return firstNoteId;
  } catch {
    // localStorage not available - just return first note
    return availableNotes[0]?.id || null;
  }
};

// Initialize selection when notes are first loaded
watch(notes, (newNotes) => {
  const resolvedCurrent = notesStore.resolveNoteId(currentNoteId.value);
  if (resolvedCurrent && resolvedCurrent !== currentNoteId.value) {
    currentNoteId.value = resolvedCurrent;
    return;
  }

  // Only set initial selection if not already set and notes are available
  if (!currentNoteId.value && newNotes.length > 0) {
    currentNoteId.value = getStoredNoteId(newNotes);
  }

  // Handle case where currently selected note was deleted
  if (currentNoteId.value && newNotes.length > 0) {
    const noteExists = newNotes.some(n => n.id === currentNoteId.value);
    if (!noteExists) {
      currentNoteId.value = getStoredNoteId(newNotes);
    }
  }

  // Handle case where all notes were deleted
  if (currentNoteId.value && newNotes.length === 0) {
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
const dirtyNotesCount = computed(() => notesStore.dirtyCount.value);
const layoutPendingCount = computed(() => notesStore.layoutPendingCount.value);
const layoutStatus = computed(() => notesStore.layoutStatus.value);
const pendingChangesCount = computed(() => dirtyNotesCount.value + layoutPendingCount.value);
const pendingChangesDetail = computed(() => {
  const parts: string[] = [];
  if (dirtyNotesCount.value) {
    parts.push(`${dirtyNotesCount.value} content edit${dirtyNotesCount.value === 1 ? "" : "s"}`);
  }
  if (layoutPendingCount.value) {
    const label =
      layoutStatus.value === "syncing"
        ? "layout syncing"
        : layoutStatus.value === "conflict"
          ? "layout conflict"
          : "layout saved locally";
    parts.push(label);
  }
  return parts.join(" and ");
});
const failedNotesCount = computed(() => notesStore.errorCount.value);

// Use shared fullscreen composable
const fullscreen = useFullscreenModal<string>();
const isFullscreenOpen = computed(() => fullscreen.isOpen.value);

const currentNote = computed(() => {
  const resolvedId = notesStore.resolveNoteId(currentNoteId.value);
  if (!resolvedId) return null;
  return notesStore.getNote(resolvedId) ?? null;
});

// Computed property for the fullscreen note
const currentFullscreenNote = computed(() => {
  if (!fullscreen.fullscreenId.value) return null;
  return notesStore.getNote(fullscreen.fullscreenId.value) ?? null;
});

// Persist selected note to localStorage when it changes
watch(currentNoteId, (noteId) => {
  const resolvedId = notesStore.resolveNoteId(noteId);
  if (resolvedId && resolvedId !== noteId) {
    currentNoteId.value = resolvedId;
    return;
  }
  if (typeof window === 'undefined' || !resolvedId) return;
  try {
    // Verify note belongs to this workspace before saving
    const note = notesStore.getNote(resolvedId);
    if (note && note.workspaceId === workspaceId) {
      localStorage.setItem(`selectedNote_${workspaceId}`, resolvedId);
    }
  } catch (err) {
    console.error('Failed to save selected note:', err);
  }
});

// Create a new note (optimistic)
const createNewNote = async (noteType: NoteType = "TEXT", groupId: string | null = null) => {
  const initialContent = noteType === "TEXT" ? DEFAULT_WORKSPACE_NOTE_HTML : "";
  const noteId = await notesStore.createNote(initialContent, [], noteType, undefined, undefined, groupId);

  if (noteId) {
    currentNoteId.value = noteId;
  }
  return noteId;
};

// Update an existing note (optimistic with debounced save)
const handleUpdateNote = async (id: string, payload: string | TextNoteUpdatePayload) => {
  // Optimistic update - user sees change immediately
  const note = notesStore.getNote(id);
  if (!note) {
    console.error("Note not found for update:", id);
    return;
  }

  const content = typeof payload === "string" ? payload : payload.content;
  const title = typeof payload === "string" ? note.title : payload.title;

  const updatedNote: NoteState = {
    ...note,
    title,
    content,
    isDirty: true,
    updatedAt: new Date(),
  };

  // The store's updateNote handles both IDB persistence and debounced server sync
  await notesStore.updateNote(id, updatedNote);
};

const handleDraftUpdate = (id: string, payload: TextNoteUpdatePayload) => {
  notesStore.applyNoteDraft(id, {
    title: payload.title,
    content: payload.content,
  });
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

// Delete a note after the source control has confirmed the destructive intent.
const deleteNote = async (id: string) => {
  const nextVisibleNoteId = splitNotes.handleNoteDeleted(id);
  syncVisibleNoteAfterSplitChange(nextVisibleNoteId);
  await notesStore.deleteNote(id);
};

// Handle retry for failed operations
const handleRetry = (id: string) => {
  // Use the store's retry functionality for failed notes
  notesStore.retryFailedNote(id);
};

const handleResolveConflict = async (
  id: string,
  resolution: "keep-local" | "keep-server" | "manual-merge",
) => {
  await notesStore.resolveNoteConflict(id, resolution);
};

const syncNotesNow = async () => {
  error.value = null;
  await notesStore.syncWithServer();
  if (networkStatus.isVerifiedOnline.value) {
    await noteGroupsStore.syncWithServer();
  }
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
const handleReorder = async (newOrder: NoteLayoutItem[]) => {
  if (isReordering.value) {
    return;
  }
  isReordering.value = true;
  try {
    await notesStore.reorderNotes(newOrder);
  } catch (err) {
    console.error("Failed to queue note reorder", err);
  } finally {
    isReordering.value = false;
  }
};

const createNoteInGroup = async (groupId: string | null) => {
  if (noteGroupsStore.isCollapsed(groupId)) {
    noteGroupsStore.toggleCollapsed(groupId);
  }
  await createNewNote("TEXT", groupId);
};

const handleCreateGroup = async (title: string) => {
  await noteGroupsStore.createGroup(title);
};

const handleRenameGroup = async (groupId: string, title: string) => {
  await noteGroupsStore.renameGroup(groupId, title);
};

const handleDeleteGroup = async (groupId: string) => {
  const deleted = await noteGroupsStore.deleteGroup(groupId);
  if (deleted) {
    await notesStore.clearGroup(groupId);
  }
};

const handleReorderGroups = async (orderedGroups: NoteGroup[]) => {
  await noteGroupsStore.reorderGroups(orderedGroups);
  await notesStore.refreshLayoutPendingCount();
};

const handleSplitNoteFromDrawer = (noteId: string) => {
  if (notes.value.length < 2) return;
  splitInteraction.execute({ type: "CLICK_SPLIT", noteId });
};

const handleDownloadNote = (noteId: string, format: "txt" | "doc" | "pdf") => {
  const note = notesStore.getNote(noteId);
  if (!note) return;
  exportContent("note", note.content, format);
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
    await notesStore.hydrateLocalNotes();
    if (shouldSyncNotes() && networkStatus.isVerifiedOnline.value) {
      void notesStore.refreshFromServer().catch((e: unknown) => {
        error.value =
          e instanceof APIError ? e : new APIError("Failed to refresh notes");
      });
      void noteGroupsStore.syncWithServer();
    } else if (networkStatus.isVerifiedOnline.value) {
      void noteGroupsStore.syncWithServer();
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
    icon: 'i-lucide-file-text',
    onSelect: () => createNewNote('TEXT')
  }, {
    label: 'Math Note',
    icon: 'i-lucide-calculator',
    onSelect: () => createNewNote('MATH')
  }, {
    label: 'Canvas',
    icon: 'i-lucide-paintbrush',
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
const _skipNextWatcherSync = ref(false);
const splitInteraction = createNotesSplitInteractionController({
  splitNotes,
  getCurrentNoteId: () => currentNoteId.value,
  setCurrentNoteId: (noteId: string) => {
    _skipNextWatcherSync.value = true;
    currentNoteId.value = noteId;
  },
});

const leftSplitNote = computed(() => {
  const noteId = splitNotes.leftNoteId.value;
  return noteId ? notesStore.getNote(noteId) ?? null : null;
});
const rightSplitNote = computed(() => {
  const noteId = splitNotes.rightNoteId.value;
  return noteId ? notesStore.getNote(noteId) ?? null : null;
});

// Keep single-view split primary in sync with drawer selection. In split mode,
// pane contents change only through explicit split commands to avoid watcher
// driven DOM branch swaps during pane activation.
watch(currentNoteId, (id) => {
  if (!id) return;
  if (_skipNextWatcherSync.value) {
    _skipNextWatcherSync.value = false;
    return;
  }
  if (!splitNotes.isSplit.value) {
    splitNotes.setPrimaryNote(id);
  }
});

function handleOpenNoteFromDrawer(noteId: string) {
  if (!splitNotes.isSplit.value) {
    currentNoteId.value = noteId;
    splitNotes.setPrimaryNote(noteId);
    return;
  }

  if (splitNotes.activePane.value === "primary") {
    if (noteId === splitNotes.secondaryNoteId.value) {
      splitNotes.setActivePane("secondary");
    } else {
      splitNotes.setPrimaryNote(noteId);
    }
  } else if (noteId === splitNotes.primaryNoteId.value) {
    splitNotes.setActivePane("primary");
  } else {
    splitNotes.setSecondaryNote(noteId);
  }

  _skipNextWatcherSync.value = true;
  currentNoteId.value = noteId;
}

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

// Toggle split from toolbar: open with next note, or close
function toggleSplitView() {
  if (splitNotes.isSplit.value) {
    splitNotes.closeSplit();
    return;
  }
  const others = notes.value.filter(n => n.id !== currentNoteId.value);
  if (!others.length) return;
  splitNotes.setPrimaryNote(currentNoteId.value);
  splitNotes.openSplit(others[0]!.id, 'right');
}

// Computed: active/passive per pane side
const isLeftActive = computed(() => splitNotes.activePaneSide.value === 'left');
const isRightActive = computed(() => splitNotes.activePaneSide.value === 'right');

// Activate a pane and sync currentNoteId to the note in that pane
const splitPaneLayoutRef = ref<InstanceType<typeof import('~/components/shared/SplitPaneLayout.vue').default> | null>(null);

function paneForSide(side: "left" | "right"): "primary" | "secondary" {
  if (side === "left") {
    return splitNotes.secondaryPosition.value === "left" ? "secondary" : "primary";
  }
  return splitNotes.secondaryPosition.value === "right" ? "secondary" : "primary";
}

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

function handleSplitDrop(noteId: string, position: SplitPosition) {
  splitInteraction.execute({ type: "DROP_SPLIT", noteId, position });
  splitInteraction.endSplitDrag();
}

function syncVisibleNoteAfterSplitChange(noteId: string | null) {
  if (!noteId) {
    if (fullscreen.isOpen.value) {
      fullscreen.close();
    }
    return;
  }

  if (noteId !== currentNoteId.value) {
    _skipNextWatcherSync.value = true;
    currentNoteId.value = noteId;
  }

  if (fullscreen.isOpen.value && fullscreen.fullscreenId.value !== noteId) {
    fullscreen.replace(noteId);
  }
}

function closeVisualPane(side: "left" | "right") {
  const nextVisibleNoteId = splitNotes.closePane(paneForSide(side));
  syncVisibleNoteAfterSplitChange(nextVisibleNoteId);
}

// ─── Adaptive Toolbar ─────────────────────────────────────────────
const { containerRef: toolbarRef, tier, showLabels, showSecondaryActions, isOverflowing } = useAdaptiveToolbar();

function handleContainerScroll(e: Event) {
  const el = e.currentTarget as HTMLElement;
  if (el && el.scrollLeft !== 0) {
    el.scrollLeft = 0;
  }
}
</script>


<template>
  <UiPanel
    variant="surface"
    size="sm"
    class-name="flex flex-1 min-h-0 min-w-0 overflow-hidden z-10 relative!"
    content-class="flex flex-col p-0!">
    <!-- Header -->
    <template v-slot:header>
      <div ref="toolbarRef" class="adaptive-toolbar w-full">
        <div class="flex items-center gap-2">
          <span>Notes</span>
          <ui-label v-if="notes?.length"> ( {{ notes.length }} ) </ui-label>
        </div>

        <UiToolbar class-name="toolbar-actions border-0 bg-transparent p-0" label="Notes actions">
          <UiActionMenu :items="newNoteDropdownItems" :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
            <UiButton size="sm" tone="primary" variant="ghost"
              :trailing-icon="showLabels ? 'i-lucide-chevron-down' : ''">
              <shared-icon name="plus" />
              <span v-if="showLabels" class="toolbar-label">New Note</span>
            </UiButton>
          </UiActionMenu>

          <Transition name="toolbar-fade">
            <div v-if="notes?.length >= 2">
              <UiToolbarButton
                icon="i-lucide-columns-2"
                :tone="splitNotes.isSplit.value ? 'primary' : 'neutral'"
                variant="link"
                size="sm"
                :label="splitNotes.isSplit.value ? 'Close split view' : 'Open split view'"
                :active="splitNotes.isSplit.value"
                @click="toggleSplitView"
              />
            </div>
          </Transition>

          <Transition name="toolbar-fade">
            <div v-if="notes?.length">
              <UiToolbarButton
                :icon="isDrawerOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
                tone="neutral"
                variant="link"
                size="sm"
                :label="isDrawerOpen ? 'Close notes list' : 'Open notes list'"
                @click="isDrawerOpen = !isDrawerOpen"
              />
            </div>
          </Transition>
        </UiToolbar>
      </div>
    </template>
    <template #default>
      <ui-loader :is-fetching="isFetching" v-if="isFetching" label="Loading notes..." />
      <!-- Error state for initial fetch -->
      <shared-error-message v-if="error" :error="error" />

      <LocalSyncStatus v-if="!error && notes?.length" class="mx-4 my-0.5" feature-label="Notes"
        :pending-count="pendingChangesCount" :pending-detail="pendingChangesDetail" :error-count="failedNotesCount"
        :is-fetching="isFetching" :is-online="networkStatus.isOnline.value"
        :is-verified-online="networkStatus.isVerifiedOnline.value" :is-connecting="networkStatus.isConnecting.value"
        :last-sync="notesStore.lastSync.value" :action-label="failedNotesCount > 0 ? 'Retry failed' : 'Sync now'"
        :action-disabled="isFetching" @action="handleSyncStatusAction" />
      <div v-if="isDev" class="mx-4 mb-1 flex justify-end">
        <UiButton size="xs" tone="neutral" variant="ghost"
          @click="isDevSyncInspectorVisible = !isDevSyncInspectorVisible">
          <icon name="i-lucide-bug" class="h-3.5 w-3.5" />
          {{ isDevSyncInspectorVisible ? "Hide sync debug" : "Show sync debug" }}
        </UiButton>
      </div>
      <NotesSyncInspector v-if="isDev && isDevSyncInspectorVisible" :workspace-id="workspaceId" />

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
      <div v-if="!error && !isFetching && notes?.length" class="relative flex flex-1 min-h-0 overflow-hidden"
        id="notes-section" @scroll="handleContainerScroll">
        <ui-drawer :show="isDrawerOpen" @closed="isDrawerOpen = false" :mobile="false" :lock-scroll="false"
          teleport-to="#notes-section" :backdrop="false" :handle-visible="0" title="Notes" side="right">
          <NotesDrawer :workspace-id="workspaceId" :notes="notes" :groups="noteGroupsStore.orderedGroups.value"
            :selected-note-id="currentNoteId" :filtered-note-ids="notesStore.filteredNoteIds.value"
            :is-verified-online="networkStatus.isVerifiedOnline.value"
            :primary-split-note-id="splitNotes.primaryNoteId.value"
            :secondary-split-note-id="splitNotes.secondaryNoteId.value" :is-split="splitNotes.isSplit.value"
            :can-split="notes.length >= 2" :is-group-collapsed="noteGroupsStore.isCollapsed"
            :get-note-display-title="getNoteDisplayTitle" @select-note="handleOpenNoteFromDrawer"
            @create-note="createNoteInGroup" @create-group="handleCreateGroup" @rename-group="handleRenameGroup"
            @delete-group="handleDeleteGroup" @reorder-groups="handleReorderGroups"
            @layout-notes-changed="handleReorder" @delete-note="deleteNote" @split-note="handleSplitNoteFromDrawer"
            @split-note-drag-start="splitInteraction.startSplitDrag"
            @split-note-drag-end="splitInteraction.endSplitDrag" @download-note="handleDownloadNote"
            @toggle-group-collapse="noteGroupsStore.toggleCollapsed" />
        </ui-drawer>


        <!-- ── Editor area: single or split ─────────────────────────── -->

        <div class="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <NotesSplitDropZone :is-dragging="splitInteraction.isSplitDragging.value"
            :hovered-zone="splitInteraction.hoveredSplitZone.value" @hover-zone="splitInteraction.setHoveredZone"
            @drop="handleSplitDrop" />

          <div v-if="isFullscreenOpen" class="flex flex-1 min-h-0 min-w-0" aria-hidden="true" />

          <!-- Single view (no split) -->
          <div v-else-if="!splitNotes.isSplit.value" key="single-view-container" class="flex flex-1 min-h-0 min-w-0">
            <MathNoteEditor v-if="currentNote?.noteType === 'MATH'" :note-id="currentNote.id"
              :initial-metadata="(currentNote.metadata as MathNoteMetadata | undefined)"
              @update="(meta: MathNoteMetadata) => handleMathUpdate(currentNoteId!, meta)"
              @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
            <CanvasNoteEditor v-else-if="currentNote?.noteType === 'CANVAS'" :key="`single-canvas-${currentNote.id}`"
              :note-id="currentNote.id"
              :initial-metadata="(currentNote.metadata as CanvasNoteMetadata | undefined)"
              @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentNoteId!, meta)"
              @toggle-fullscreen="fullscreen.toggle(currentNoteId!)" @delete="deleteNote(currentNoteId!)" />
            <TextNote v-else-if="currentNote" :note="currentNote" :delete-note="deleteNote" size="lg"
              :conflict="notesStore.getConflict(currentNote.id)" @update="handleUpdateNote"
              @draft-update="handleDraftUpdate" @retry="handleRetry" @resolve-conflict="handleResolveConflict"
              @toggle-fullscreen="fullscreen.toggle" placeholder="Double-click to add your note..."
              @add-to-material="emit('add-to-material', $event)" />
          </div>

          <!-- Split view -->
          <div v-else key="split-view-container" class="flex flex-1 min-h-0 min-w-0">
            <shared-split-pane-layout ref="splitPaneLayoutRef" :storage-key="`splitPaneSizes_${workspaceId}`"
              :left-label="getNoteDisplayTitle(leftSplitNote, 20)"
              :right-label="getNoteDisplayTitle(rightSplitNote, 20)" left-icon="i-lucide-notebook-pen"
              right-icon="i-lucide-notebook-pen" class="flex-1 min-h-0 min-w-0">
              <!-- LEFT PANE slot -->
              <template #left>
                <div class="split-pane" :class="isLeftActive ? 'split-pane--active' : 'split-pane--passive'"
                  @pointerdown.capture="activateLeftPane">
                  <!-- Pane header -->
                  <div class="split-pane-header" @pointerdown.stop>
                    <span class="split-pane-title truncate">
                      {{ getNoteDisplayTitle(leftSplitNote, 28) }}
                    </span>
                    <div class="flex items-center gap-1 shrink-0">
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-panel-left-close" label="Minimize left pane" @click.stop="splitPaneLayoutRef?.toggleLeft()" />
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-arrow-left-right" label="Swap panes" @click.stop="splitNotes.swapPanes()" />
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-x" label="Close left pane" @click.stop="closeVisualPane('left')" />
                    </div>
                  </div>
                  <!-- Left editor -->
                  <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isLeftActive }">
                    <div v-if="splitNotes.leftNoteId.value && leftSplitNote" class="flex flex-col flex-1 min-h-0">
                      <MathNoteEditor v-if="leftSplitNote.noteType === 'MATH'"
                        :key="`split-left-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                        :initial-metadata="(leftSplitNote.metadata as MathNoteMetadata | undefined)"
                        :readonly="!isLeftActive"
                        @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.leftNoteId.value!, meta)"
                        @toggle-fullscreen="fullscreen.toggle(splitNotes.leftNoteId.value!)"
                        @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                      <CanvasNoteEditor v-else-if="leftSplitNote.noteType === 'CANVAS'"
                        :key="`split-left-canvas-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                        :initial-metadata="(leftSplitNote.metadata as CanvasNoteMetadata | undefined)"
                        :readonly="!isLeftActive"
                        @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.leftNoteId.value!, meta)"
                        @toggle-fullscreen="fullscreen.toggle(splitNotes.leftNoteId.value!)"
                        @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                      <TextNote v-else :key="`split-left-text-${splitNotes.leftNoteId.value}`" :note="leftSplitNote"
                        :delete-note="deleteNote" :readonly="!isLeftActive"
                        :conflict="notesStore.getConflict(leftSplitNote.id)" size="lg" @update="handleUpdateNote"
                        @draft-update="handleDraftUpdate" @retry="handleRetry"
                        @resolve-conflict="handleResolveConflict" @toggle-fullscreen="fullscreen.toggle"
                        @add-to-material="emit('add-to-material', $event)" />
                    </div>
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
                      {{ getNoteDisplayTitle(rightSplitNote, 28) }}
                    </span>
                    <div class="flex items-center gap-1 shrink-0">
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-panel-right-close" label="Minimize right pane" @click.stop="splitPaneLayoutRef?.toggleRight()" />
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-arrow-left-right" label="Swap panes" @click.stop="splitNotes.swapPanes()" />
                      <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-x" label="Close right pane" @click.stop="closeVisualPane('right')" />
                    </div>
                  </div>
                  <!-- Right editor -->
                  <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isRightActive }">
                    <div v-if="splitNotes.rightNoteId.value && rightSplitNote" class="flex flex-col flex-1 min-h-0">
                      <MathNoteEditor v-if="rightSplitNote.noteType === 'MATH'"
                        :key="`split-right-${splitNotes.rightNoteId.value}`" :note-id="splitNotes.rightNoteId.value"
                        :initial-metadata="(rightSplitNote.metadata as MathNoteMetadata | undefined)"
                        :readonly="!isRightActive"
                        @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.rightNoteId.value!, meta)"
                        @toggle-fullscreen="fullscreen.toggle(splitNotes.rightNoteId.value!)"
                        @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                      <CanvasNoteEditor v-else-if="rightSplitNote.noteType === 'CANVAS'"
                        :key="`split-right-canvas-${splitNotes.rightNoteId.value}`"
                        :note-id="splitNotes.rightNoteId.value"
                        :initial-metadata="(rightSplitNote.metadata as CanvasNoteMetadata | undefined)"
                        :readonly="!isRightActive"
                        @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.rightNoteId.value!, meta)"
                        @toggle-fullscreen="fullscreen.toggle(splitNotes.rightNoteId.value!)"
                        @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                      <TextNote v-else :key="`split-right-text-${splitNotes.rightNoteId.value}`" :note="rightSplitNote"
                        :delete-note="deleteNote" :readonly="!isRightActive"
                        :conflict="notesStore.getConflict(rightSplitNote.id)" size="lg" @update="handleUpdateNote"
                        @draft-update="handleDraftUpdate" @retry="handleRetry"
                        @resolve-conflict="handleResolveConflict" @toggle-fullscreen="fullscreen.toggle"
                        @add-to-material="emit('add-to-material', $event)" />
                    </div>
                  </div>
                </div>
              </template>
            </shared-split-pane-layout>
          </div>
        </div>

      </div>
    </template>
  </UiPanel>

  <!-- Fullscreen Note View -->
  <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" aria-label="Note fullscreen view"
    :max-width="splitNotes.isSplit.value ? '95vw' : '900px'" max-height="90vh"
    :content-scrollable="!splitNotes.isSplit.value" @close="fullscreen.close">

    <div v-if="currentFullscreenNote" class="flex h-full min-h-0 flex-col overflow-hidden">

      <!-- Single fullscreen -->
      <template v-if="!splitNotes.isSplit.value">
        <MathNoteEditor v-if="currentFullscreenNote.noteType === 'MATH'" :note-id="currentFullscreenNote.id"
          :initial-metadata="(currentFullscreenNote!.metadata as MathNoteMetadata | undefined)" :is-fullscreen="true"
          @update="(meta: MathNoteMetadata) => handleMathUpdate(currentFullscreenNote!.id, meta)"
          @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
        <CanvasNoteEditor v-else-if="currentFullscreenNote.noteType === 'CANVAS'"
          :key="`fullscreen-canvas-${currentFullscreenNote.id}`" :note-id="currentFullscreenNote.id"
          :initial-metadata="(currentFullscreenNote!.metadata as CanvasNoteMetadata | undefined)" :is-fullscreen="true"
          @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(currentFullscreenNote!.id, meta)"
          @toggle-fullscreen="fullscreen.close" @delete="deleteNote(currentFullscreenNote!.id)" />
        <TextNote v-else :note="currentFullscreenNote" :delete-note="deleteNote" :is-fullscreen="true" size="lg"
          :conflict="notesStore.getConflict(currentFullscreenNote.id)" @update="handleUpdateNote"
          @draft-update="handleDraftUpdate" @retry="handleRetry" @resolve-conflict="handleResolveConflict"
          @toggle-fullscreen="fullscreen.close" placeholder="Double-click to add your note..."
          @add-to-material="emit('add-to-material', $event)" />
      </template>

      <!-- Split fullscreen -->
      <template v-else>
        <shared-split-pane-layout :storage-key="`splitPaneSizes_${workspaceId}`"
          :left-label="getNoteDisplayTitle(leftSplitNote, 20)" :right-label="getNoteDisplayTitle(rightSplitNote, 20)"
          left-icon="i-lucide-notebook-pen" right-icon="i-lucide-notebook-pen"
          class="flex-1 min-h-0 min-w-0 h-full overflow-hidden">
          <template #left>
            <div class="split-pane" :class="isLeftActive ? 'split-pane--active' : 'split-pane--passive'"
              @pointerdown.capture="activateLeftPane">
              <div class="split-pane-header" @pointerdown.stop>
                <span class="split-pane-title truncate">
                  {{ getNoteDisplayTitle(leftSplitNote, 28) }}
                </span>
                <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-arrow-left-right" label="Swap panes" @click.stop="splitNotes.swapPanes()" />
                <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-x" label="Close left pane" @click.stop="closeVisualPane('left')" />
              </div>
              <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isLeftActive }">
                <div v-if="splitNotes.leftNoteId.value && leftSplitNote" class="flex flex-col flex-1 min-h-0">
                  <MathNoteEditor v-if="leftSplitNote.noteType === 'MATH'"
                    :key="`fs-split-left-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                    :initial-metadata="(leftSplitNote.metadata as MathNoteMetadata | undefined)" :is-fullscreen="true"
                    :readonly="!isLeftActive"
                    @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.leftNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                  <CanvasNoteEditor v-else-if="leftSplitNote.noteType === 'CANVAS'"
                    :key="`fs-split-left-canvas-${splitNotes.leftNoteId.value}`" :note-id="splitNotes.leftNoteId.value"
                    :initial-metadata="(leftSplitNote.metadata as CanvasNoteMetadata | undefined)" :is-fullscreen="true"
                    :readonly="!isLeftActive"
                    @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.leftNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.leftNoteId.value!)" />
                  <TextNote v-else :key="`fs-split-left-text-${splitNotes.leftNoteId.value}`" :note="leftSplitNote"
                    :delete-note="deleteNote" :is-fullscreen="true" :readonly="!isLeftActive" size="lg"
                    :conflict="notesStore.getConflict(leftSplitNote.id)" @update="handleUpdateNote"
                    @draft-update="handleDraftUpdate" @retry="handleRetry"
                    @resolve-conflict="handleResolveConflict" @toggle-fullscreen="fullscreen.close"
                    @add-to-material="emit('add-to-material', $event)" />
                </div>
              </div>
            </div>
          </template>

          <template #right>
            <div class="split-pane" :class="isRightActive ? 'split-pane--active' : 'split-pane--passive'"
              @pointerdown.capture="activateRightPane">
              <div class="split-pane-header" @pointerdown.stop>
                <span class="split-pane-title truncate">
                  {{ getNoteDisplayTitle(rightSplitNote, 28) }}
                </span>
                <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-arrow-left-right" label="Swap panes" @click.stop="splitNotes.swapPanes()" />
                <UiIconButton size="xs" tone="neutral" variant="ghost" icon="i-lucide-x" label="Close right pane" @click.stop="closeVisualPane('right')" />
              </div>
              <div class="split-pane-editor" :class="{ 'split-pane-editor--passive': !isRightActive }">
                <div v-if="splitNotes.rightNoteId.value && rightSplitNote" class="flex flex-col flex-1 min-h-0">
                  <MathNoteEditor v-if="rightSplitNote.noteType === 'MATH'"
                    :key="`fs-split-right-${splitNotes.rightNoteId.value}`" :note-id="splitNotes.rightNoteId.value"
                    :initial-metadata="(rightSplitNote.metadata as MathNoteMetadata | undefined)" :is-fullscreen="true"
                    :readonly="!isRightActive"
                    @update="(meta: MathNoteMetadata) => handleMathUpdate(splitNotes.rightNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                  <CanvasNoteEditor v-else-if="rightSplitNote.noteType === 'CANVAS'"
                    :key="`fs-split-right-canvas-${splitNotes.rightNoteId.value}`"
                    :note-id="splitNotes.rightNoteId.value"
                    :initial-metadata="(rightSplitNote.metadata as CanvasNoteMetadata | undefined)"
                    :is-fullscreen="true" :readonly="!isRightActive"
                    @update="(meta: CanvasNoteMetadata) => handleCanvasUpdate(splitNotes.rightNoteId.value!, meta)"
                    @toggle-fullscreen="fullscreen.close" @delete="deleteNote(splitNotes.rightNoteId.value!)" />
                  <TextNote v-else :key="`fs-split-right-text-${splitNotes.rightNoteId.value}`" :note="rightSplitNote"
                    :delete-note="deleteNote" :is-fullscreen="true" :readonly="!isRightActive" size="lg"
                    :conflict="notesStore.getConflict(rightSplitNote.id)" @update="handleUpdateNote"
                    @draft-update="handleDraftUpdate" @retry="handleRetry"
                    @resolve-conflict="handleResolveConflict" @toggle-fullscreen="fullscreen.close"
                    @add-to-material="emit('add-to-material', $event)" />
                </div>
              </div>
            </div>
          </template>
        </shared-split-pane-layout>
      </template>

    </div>
  </shared-fullscreen-wrapper>
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
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-secondary);
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
  border-bottom: 1px solid var(--color-secondary);
  background: var(--color-surface);
  min-height: 32px;
  flex-shrink: 0;
  z-index: 1;
}

.split-pane--active .split-pane-header {
  /* border-bottom-color: var(--color-primary); */
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.split-pane-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-content-secondary);
  max-width: calc(100% - 60px);
}

.split-pane--active .split-pane-title {
  color: var(--color-primary);
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
  border-left: 2px solid var(--color-primary);
}

.split-indicator-secondary {
  border-left: 2px solid var(--color-success);
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
