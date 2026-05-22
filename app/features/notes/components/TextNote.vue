<template>
  <!-- Parent container -->
  <div ref="noteRef" :class="noteContainerClasses">
    <!-- Toolbar sits above the styled content area (matches math/canvas note pattern) -->
    <SharedNoteToolbar v-if="!isBoardItem" :is-loading="note.isLoading" :is-fullscreen="isFullscreen"
      :readonly="props.readonly" @toggleFullscreen="handleToggleFullscreen" @delete="deleteNote(note.id)">
      <!-- Plug in the editor tools for Tiptap -->
      <shared-tiptap-toolbar v-if="tiptapEditor" :editor="tiptapEditor" />

      <span class="px-2 text-[11px] font-medium text-content-secondary">
        {{ saveStateText }}
      </span>

      <UDropdownMenu :modal="false" :items="[
        [
          { label: 'Download as TXT', icon: 'i-heroicons-document-text', onSelect: () => exportContent('Note', note.content, 'txt') },
          { label: 'Download as DOC', icon: 'i-heroicons-document', onSelect: () => exportContent('Note', note.content, 'doc') },
          { label: 'Download as PDF', icon: 'i-heroicons-document', onSelect: () => exportContent('Note', note.content, 'pdf') }
        ]
      ]">
        <u-button variant="outline" color="primary" size="sm">
          <shared-icon name="download" class="w-4 h-4" />
        </u-button>
      </UDropdownMenu>
    </SharedNoteToolbar>

    <!-- Content area — styled via shared NoteContentArea component -->
    <SharedNoteContentArea :class="{ 'flex-col': true }">
      <!-- Error state -->
      <div v-if="note.error" class="flex flex-col items-center justify-center h-full text-error p-4">
        <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm font-medium text-center">{{ note.error }}</span>
        <UButton variant="ghost" color="error" size="xs" class="mt-2 underline" @click="retry">
          Try again
        </UButton>
      </div>

      <!-- Editor -->
      <client-only>
        <div ref="editorContainerRef" class="h-full flex-1 min-h-0 shrink-0">
          <shared-tiptap-editor ref="tiptapRef" :id="note.id" v-model="contentHtml" :isFullScreen="isFullscreen"
            :readonly="props.readonly" :document-mode="props.isBoardItem ? 'default' : 'workspace-note'"
            @addToMaterial="handleAddToMaterial" @blur="flushPendingSave" />
        </div>
      </client-only>
    </SharedNoteContentArea>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { normalizeWorkspaceNoteContent } from "@@/shared/utils/workspaceNote";
import { useExportContent } from "~/composables/shared/useExportContent";
import { useDebounce } from "~/utils/debounce";
import {
  buildWorkspaceTextDraftCommit,
  resolveEditorSaveState,
  saveStateLabel,
} from "../composables/notesDraftCommitter";
import { registerNotesDraftFlusher } from "../composables/notesEditorRuntimeState";

interface NoteOrBoardItem {
  id: string;
  title?: string;
  content: string;
  isLoading?: boolean;
  error?: string | null;
}

interface WorkspaceNoteUpdatePayload {
  title: string;
  content: string;
}

interface Props {
  note: NoteOrBoardItem;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  isFullscreen?: boolean;
  deleteNote: (id: string) => void;
  isBoardItem?: boolean;
  /** When true, renders read-only (passive pane in split view) */
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Double-click to add a note...",
  size: "md",
  isFullscreen: false,
  isBoardItem: false,
  readonly: false,
});

const emit = defineEmits<{
  update: [id: string, payload: string | WorkspaceNoteUpdatePayload];
  retry: [id: string];
  'toggle-fullscreen': [id: string];
  addToMaterial: [selectedText: string];
}>();

// Reactive state
const isEditing = ref(true);
const normalizeEditorValue = (value: string) => (
  props.isBoardItem ? sanitizeHtml(value) : normalizeWorkspaceNoteContent(sanitizeHtml(value))
);

const emitUpdate = (noteId: string, content: string) => {
  if (props.isBoardItem) {
    emit("update", noteId, content);
    return;
  }

  emit("update", noteId, buildWorkspaceTextDraftCommit(content));
};

const contentHtml = ref(normalizeEditorValue(props.note.content)); // HTML content for tiptap v-model
const lastCommittedContent = ref(normalizeEditorValue(props.note.content)); // To track changes for saving
const draftNoteId = ref(props.note.id);
const hasLocalDraft = ref(false);
const isApplyingExternalContent = ref(false);

// Template ref bridging
const tiptapRef = ref<{ editor: any } | null>(null);
const tiptapEditor = computed(() => tiptapRef.value?.editor);

const { exportContent } = useExportContent();
const { debouncedFunc: scheduleSave, flush: flushScheduledSave } = useDebounce(
  () => {
    commitDraft();
  },
  700,
);

const saveState = computed(() =>
  resolveEditorSaveState({
    hasLocalDraft: hasLocalDraft.value,
    isDirty: "isDirty" in props.note ? Boolean((props.note as any).isDirty) : false,
    isLoading: props.note.isLoading,
    error: props.note.error,
  }),
);
const saveStateText = computed(() => saveStateLabel(saveState.value));

const commitDraft = (noteId = draftNoteId.value, force = false) => {
  if (props.readonly && !force) return;
  const normalized = normalizeEditorValue(contentHtml.value);
  if (normalized === lastCommittedContent.value) {
    hasLocalDraft.value = false;
    return;
  }

  emitUpdate(noteId, normalized);
  lastCommittedContent.value = normalized;
  hasLocalDraft.value = false;
};

// Computed classes for parent container — flex column mirrors math/canvas note pattern
const noteContainerClasses = computed(() => {
  return [
    "note-container flex h-full min-h-0 min-w-0 flex-col flex-1 basis-4/5 shrink-0 overflow-hidden",
    "transition-all duration-100",
    "",
  ];
});

watch(
  () => props.note.content,
  (nextContent) => {
    if (props.note.id === draftNoteId.value && hasLocalDraft.value) return;
    const normalized = normalizeEditorValue(nextContent);
    if (normalized === contentHtml.value) return;
    isApplyingExternalContent.value = true;
    contentHtml.value = normalized;
    lastCommittedContent.value = normalized;
    hasLocalDraft.value = false;
    nextTick(() => {
      isApplyingExternalContent.value = false;
    });
  }
);

const handleAddToMaterial = (selectedText: string) => {
  emit("addToMaterial", selectedText);
};



const retry = () => emit("retry", props.note.id);

const flushPendingSave = (noteId = draftNoteId.value) => {
  const normalized = normalizeEditorValue(contentHtml.value);
  if (normalized === lastCommittedContent.value) {
    hasLocalDraft.value = false;
    return;
  }
  flushScheduledSave();
  commitDraft(noteId, true);
};

const handleToggleFullscreen = () => {
  flushPendingSave();
  emit("toggle-fullscreen", props.note.id);
};

let unregisterDraftFlusher: (() => void) | null = null;

onMounted(() => {
  if (!props.isBoardItem) {
    unregisterDraftFlusher = registerNotesDraftFlusher(() => flushPendingSave());
  }
});

onBeforeUnmount(() => {
  flushPendingSave();
  unregisterDraftFlusher?.();
});

// Watch for tiptap content changes to auto-save (we persist plain text)
watch(contentHtml, () => {
  if (!isEditing.value || props.readonly || isApplyingExternalContent.value) return;
  hasLocalDraft.value = contentHtml.value !== lastCommittedContent.value;
  if (hasLocalDraft.value) {
    scheduleSave();
  }
});

watch(
  () => props.note.id,
  (nextId, previousId) => {
    if (previousId) {
      flushPendingSave(previousId);
    }

    draftNoteId.value = nextId;
    const normalized = normalizeEditorValue(props.note.content);
    isApplyingExternalContent.value = true;
    contentHtml.value = normalized;
    lastCommittedContent.value = normalized;
    hasLocalDraft.value = false;
    nextTick(() => {
      isApplyingExternalContent.value = false;
    });
  },
);

defineExpose({ flushPendingSave });
</script>

<style scoped>
/* Note container */
.note-container {
  position: relative;
}
</style>
