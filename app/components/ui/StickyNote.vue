<template>
  <!-- Parent container: reserves space in grid -->
  <div ref="noteRef" :class="noteContainerClasses">
    <!-- Child: handles animation and positioning -->
    <div :class="noteContentClasses">
      <!-- Content area -->
      <div
        class="relative h-full flex flex-col flex-1 min-h-0 overflow-auto transition-opacity duration-400"
        :class="{
          'opacity-0': isAnimating,
          'opacity-100': !isAnimating,
        }"
      >
        <!-- Top right actions -->
        <div class="flex items-center h-fit mb-1 pb-0.5 bg-white z-10">
          <div class="flex items-center gap-2">
            <!-- Fullscreen toggle button (show when not loading and has content) -->
            <u-button
              v-if="note.content.trim()"
              :class="{ 'opacity-75': note.isLoading }"
              variant="subtle"
              color="primary"
              size="xs"
              :aria-label="isFullscreen ? 'Exit fullscreen' : 'View fullscreen'"
              @click="$emit('toggleFullscreen', note.id)"
            >
              <icon
                v-if="isFullscreen"
                name="i-heroicons-arrows-pointing-in"
                class="w-3 h-3"
              />
              <icon
                v-else
                name="i-heroicons-arrows-pointing-out"
                class="w-3 h-3"
              />
            </u-button>
            <u-button
              class="group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              :class="{ 'opacity-75': note.isLoading }"
              variant="subtle"
              color="error"
              size="xs"
              :disabled="note.isLoading"
              aria-label="Delete note"
              @click="deleteNote(note.id)"
            >
              <icon name="i-heroicons-trash" class="w-3 h-3" />
            </u-button>
          </div>
        </div>

        <!-- Error state -->
        <div
          v-if="note.error"
          class="flex flex-col items-center justify-center h-full text-red-600"
        >
          <svg
            class="w-6 h-6 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="text-sm font-medium text-center">{{ note.error }}</span>
          <button
            class="mt-2 text-xs text-danger hover:text-red-700 underline"
            @click="retry"
          >
            Try again
          </button>
        </div>

        <!-- Edit mode -->

        <client-only>
          <div ref="editorContainerRef" class="h-full flex-1 min-h-0 shrink-0">
            <shared-tiptap-editor
              ref="tiptapRef"
              :id="note.id"
              v-model="contentHtml"
              :isFullScreen="isFullscreen"
              @addToMaterial="handleAddToMaterial"
            />
          </div>
        </client-only>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import type { Editor as TiptapEditorType } from "@tiptap/core";

interface Props {
  note: NoteState;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  isFullscreen?: boolean;
  deleteNote: (id: string) => void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Double-click to add a note...",
  size: "md",
  isFullscreen: false,
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
const tiptapRef = ref<{ editor?: TiptapEditorType } | null>(null);
const editorContainerRef = ref<HTMLElement | null>(null);
const noteRef = ref<HTMLElement>();
const isAnimating = ref(false);

// Computed classes for parent container
const noteContainerClasses = computed(() => {
  const sizeClasses = {
    sm: "w-48 h-32",
    md: "w-64 h-40",
    lg: "w-full",
  };

  const baseClasses = [
    "note-container flex flex-1 basis-4/5 shrink-0 overflow-auto",
    sizeClasses[props.size],
    "transition-all duration-100",
  ];

  return [
    ...baseClasses,
    // { "opacity-75": props.note.loading && !props.isFullscreen },
  ];
});

// Computed classes for the note content
const noteContentClasses = computed(() => {
  const baseClasses = [
    "note-content bg-white p-1 rounded z-20",
    "w-full h-full",
    "transition-all duration-100",
    "relative",
  ];

  const normalClasses = [
    "",
    {
      "": isEditing.value,
      // "pointer-events-none": props.note.isLoading,
      "opacity-0": isAnimating.value && !props.isFullscreen,
      invisible: isAnimating.value && !props.isFullscreen,
    },
  ];

  return [...baseClasses, ...normalClasses];
});

// Animation helper for fullscreen transition
const animateToFullscreen = (element: HTMLElement) => {
  isAnimating.value = true;
  const rect = element.getBoundingClientRect();

  // Apply the animation starting from current position
  element.style.position = "fixed";
  element.style.top = `${rect.top}px`;
  element.style.left = `${rect.left}px`;
  element.style.width = "1200px";
  element.style.height = "900px";
  element.style.maxWidth = "90vw";
  element.style.maxHeight = "90vh";
  element.style.zIndex = "1000";
  element.style.opacity = "1";
  element.style.visibility = "visible";

  // Trigger the animation on next frame
  requestAnimationFrame(() => {
    element.style.top = "50%";
    element.style.left = "50%";
    element.style.transform = "translate(-50%, -50%)";
    // element.style.width = '400px'
    // element.style.height = '400px'

    // End animation state after transition completes and show content
    setTimeout(() => {
      isAnimating.value = false;
    }, 500); // Match the CSS transition duration
  });
};

const animateFromFullscreen = (element: HTMLElement) => {
  isAnimating.value = true;

  // Reset to relative positioning
  element.style.position = "relative";
  element.style.top = "auto";
  element.style.left = "auto";
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.minWidth = "unset";
  element.style.minHeight = "unset";
  element.style.maxWidth = "unset";
  element.style.maxHeight = "unset";
  element.style.transform = "unset";
  element.style.zIndex = "auto";
  element.style.opacity = "";
  element.style.visibility = "";

  // End animation state after transition completes
  setTimeout(() => {
    isAnimating.value = false;
  }, 500); // Match the CSS transition duration
};

watch(
  () => props.note,
  (note) => {
    contentHtml.value = note.content;
    originalText.value = note.content;
  }
);

// Watch for fullscreen changes and animate
watch(
  () => props.isFullscreen,
  (isFullscreen) => {
    if (!noteRef.value) return;

    const noteContentElement = noteRef.value.querySelector(
      ".note-content"
    ) as HTMLElement;
    if (!noteContentElement) return;

    if (isFullscreen) {
      animateToFullscreen(noteContentElement);
    } else {
      animateFromFullscreen(noteContentElement);
    }
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
/* Note container - reserves space in grid layout */
.note-container {
  position: relative;
}

/* Note content - handles animations and positioning */
.note-content {
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
</style>
