<template>
  <!-- Parent container -->
  <div ref="noteRef" :class="noteContainerClasses">
    <!-- Note content -->
    <div :class="noteContentClasses">
      <!-- Content area -->
      <div class="relative h-full flex flex-col flex-1 min-h-0 overflow-auto">
        <!-- Top right actions -->
        <div class="flex items-center h-fit mb-1 pb-0.5 bg-white z-10">
          <div class="flex items-center gap-2" v-if="!isBoardItem">

            <!-- Fullscreen toggle button (show when not loading and has content) -->
            <u-button v-if="note.content.trim()" :class="{ 'opacity-75': note.isLoading }" variant="subtle"
              color="primary" size="xs" :aria-label="isFullscreen ? 'Exit fullscreen' : 'View fullscreen'"
              @click="$emit('toggleFullscreen', note.id)">
              <icon v-if="isFullscreen" name="i-heroicons-arrows-pointing-in" class="w-3 h-3" />
              <icon v-else name="i-heroicons-arrows-pointing-out" class="w-3 h-3" />
            </u-button>
            <u-button class="group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              :class="{ 'opacity-75': note.isLoading }" variant="subtle" color="error" size="xs"
              :disabled="note.isLoading" aria-label="Delete note" @click="deleteNote(note.id)">
              <icon name="i-heroicons-trash" class="w-3 h-3" />
            </u-button>
          </div>
        </div>

        <!-- Error state -->
        <div v-if="note.error" class="flex flex-col items-center justify-center h-full text-red-600">
          <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-center">{{ note.error }}</span>
          <button class="mt-2 text-xs text-danger hover:text-red-700 underline" @click="retry">
            Try again
          </button>
        </div>

        <!-- Edit mode -->

        <client-only>
          <div ref="editorContainerRef" class="h-full flex-1 min-h-0 shrink-0">
            <shared-tiptap-editor ref="tiptapRef" :id="note.id" v-model="contentHtml" :isFullScreen="isFullscreen"
              @addToMaterial="handleAddToMaterial" />
          </div>
        </client-only>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import type { BoardItemState } from "~/composables/useBoardItemsStore";

// Common properties between NoteState and BoardItemState
type NoteOrBoardItem = NoteState | BoardItemState;

interface Props {
  note: NoteOrBoardItem;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  isFullscreen?: boolean;
  deleteNote: (id: string) => void;
  isBoardItem?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Double-click to add a note...",
  size: "md",
  isFullscreen: false,
  isBoardItem: false,
});

const emit = defineEmits<{
  update: [id: string, text: string];
  retry: [id: string];
  toggleFullscreen: [id: string];
  addToMaterial: [selectedText: string];
}>();

// Reactive state
const isEditing = ref(true);
const contentHtml = ref(props.note.content); // HTML content for tiptap v-model
const originalText = ref(props.note.content); // To track changes for saving

// Computed classes for parent container
const noteContainerClasses = computed(() => {
  const baseClasses = [
    "note-container flex flex-1 basis-4/5 shrink-0 overflow-auto",
    "transition-all duration-100",
  ];

  return [
    ...baseClasses,
    // { "opacity-75": props.note.loading && !props.isFullscreen },
  ];
});

// Computed classes for the note content
const noteContentClasses = computed(() => {
  return [
    "note-content bg-white p-2 rounded",
    "w-full h-full",
    "relative",
  ];
});

watch(
  () => props.note,
  (note) => {
    contentHtml.value = note.content;
    originalText.value = note.content;
  }
);

const saveNote = async (html: string) => {
  const sanitized = sanitizeHtml(html);
  if (sanitized === (originalText.value || "").trim()) return;
  emit("update", props.note.id, sanitized);
  originalText.value = sanitized;
};

const handleAddToMaterial = (selectedText: string) => {
  emit("addToMaterial", selectedText);
};



const retry = () => emit("retry", props.note.id);

// Watch for tiptap content changes to auto-save (we persist plain text)
watch(contentHtml, (newHtml) => {
  if (!isEditing.value) return;
  const sanitized = sanitizeHtml(newHtml);
  if (sanitized !== (originalText.value || "").trim()) {
    saveNote(sanitized);
  }
});
</script>

<style scoped>
/* Note container */
.note-container {
  position: relative;
}
</style>
