<template>
  <!-- Parent container -->
  <div ref="noteRef" :class="noteContainerClasses">
    <!-- Toolbar sits above the styled content area (matches math/canvas note pattern) -->
    <SharedNoteToolbar v-if="!isBoardItem" :is-loading="note.isLoading" :is-fullscreen="isFullscreen"
      @toggleFullscreen="$emit('toggle-fullscreen', note.id)" @delete="deleteNote(note.id)">
      <!-- Plug in the editor tools for Tiptap -->
      <shared-tiptap-toolbar v-if="tiptapEditor" :editor="tiptapEditor" />

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
import { onBeforeUnmount, watch } from "vue";
import {
  normalizeWorkspaceNoteContent,
  normalizeWorkspaceNoteTitle,
} from "@@/shared/utils/workspaceNote";
import { useExportContent } from "~/composables/shared/useExportContent";
import { useDebounce } from "~/utils/debounce";

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

const emitUpdate = (content: string) => {
  if (props.isBoardItem) {
    emit("update", props.note.id, content);
    return;
  }

  emit("update", props.note.id, {
    title: normalizeWorkspaceNoteTitle(undefined, content),
    content,
  });
};

const contentHtml = ref(normalizeEditorValue(props.note.content)); // HTML content for tiptap v-model
const originalText = ref(normalizeEditorValue(props.note.content)); // To track changes for saving

// Template ref bridging
const tiptapRef = ref<{ editor: any } | null>(null);
const tiptapEditor = computed(() => tiptapRef.value?.editor);

const { exportContent } = useExportContent();
const { debouncedFunc: scheduleSave, flush: flushScheduledSave } = useDebounce(
  () => {
    const normalized = normalizeEditorValue(contentHtml.value);
    if (normalized === (originalText.value || "").trim()) return;
    emitUpdate(normalized);
    originalText.value = normalized;
  },
  250,
);

// Computed classes for parent container — flex column mirrors math/canvas note pattern
const noteContainerClasses = computed(() => {
  return [
    "note-container flex flex-col flex-1 basis-4/5 shrink-0",
    "transition-all duration-100",
    "gap-2",
  ];
});

watch(
  () => props.note.content,
  (nextContent) => {
    const normalized = normalizeEditorValue(nextContent);
    if (normalized === contentHtml.value) return;
    contentHtml.value = normalized;
    originalText.value = normalized;
  }
);

const saveNote = async (html: string) => {
  const normalized = normalizeEditorValue(html);
  if (normalized === (originalText.value || "").trim()) return;
  scheduleSave();
};

const handleAddToMaterial = (selectedText: string) => {
  emit("addToMaterial", selectedText);
};



const retry = () => emit("retry", props.note.id);

const flushPendingSave = () => {
  const normalized = normalizeEditorValue(contentHtml.value);
  if (normalized === (originalText.value || "").trim()) return;
  flushScheduledSave();
};

onBeforeUnmount(() => {
  flushPendingSave();
});

// Watch for tiptap content changes to auto-save (we persist plain text)
watch(contentHtml, (newHtml) => {
  if (!isEditing.value) return;
  const normalized = normalizeEditorValue(newHtml);
  if (normalized !== (originalText.value || "").trim()) {
    saveNote(normalized);
  }
});
</script>

<style scoped>
/* Note container */
.note-container {
  position: relative;
}
</style>
