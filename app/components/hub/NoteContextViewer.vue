<script setup lang="ts">
import type { ContextPreview } from "~/composables/useContextBridge";

interface Props {
  preview: ContextPreview;
}

const props = defineProps<Props>();

// Fetch the note content
const { data: note, pending, error } = await useFetch<any>(
  `/api/notes/${props.preview.noteId}`,
  {
    key: `note-context-${props.preview.noteId}`,
  }
);

// Scroll to the specific block anchor after content loads
onMounted(() => {
  if (props.preview.anchor) {
    nextTick(() => {
      const element = document.querySelector(
        `[data-block-id="${props.preview.anchor}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("highlight-block");
        setTimeout(() => {
          element.classList.remove("highlight-block");
        }, 2000);
      }
    });
  }
});
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading -->
    <div v-if="pending" class="flex items-center justify-center p-8">
      <u-icon name="i-lucide-loader" class="w-6 h-6 animate-spin text-primary" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center justify-center p-8 gap-3">
      <u-icon name="i-lucide-alert-circle" class="w-8 h-8 text-error" />
      <ui-paragraph size="sm" color="muted">
        Failed to load note content
      </ui-paragraph>
    </div>

    <!-- Note Content -->
    <div v-else-if="note" class="flex-1 overflow-auto p-6 prose dark:prose-invert max-w-none">
      <!-- Render note content with block IDs -->
      <div v-html="renderNoteWithAnchors(note.content)" />
    </div>

    <!-- Empty -->
    <div v-else class="flex items-center justify-center p-8">
      <ui-paragraph size="sm" color="muted">
        Note not found
      </ui-paragraph>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Render note content with block ID anchors
 * This function wraps paragraphs/blocks with data-block-id attributes
 */
function renderNoteWithAnchors(content: string): string {
  if (!content) return "";

  // Split content by double newlines (paragraphs)
  const blocks = content.split(/\n\n+/);

  return blocks
    .map((block, index) => {
      const blockId = `block-${index}`;
      return `<div data-block-id="${blockId}" class="mb-4">${block}</div>`;
    })
    .join("");
}
</script>

<style scoped>
/* Highlight animation for the target block */
:deep(.highlight-block) {
  @apply bg-yellow-100 dark:bg-yellow-900/30 transition-colors duration-500;
  animation: pulse-highlight 1s ease-in-out;
}

@keyframes pulse-highlight {

  0%,
  100% {
    @apply bg-yellow-100 dark:bg-yellow-900/30;
  }

  50% {
    @apply bg-yellow-200 dark:bg-yellow-900/50;
  }
}
</style>
