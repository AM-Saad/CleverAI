<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  /** Used for disabling interactions while loading */
  isLoading?: boolean;
  /** Pass true if this instance is rendered inside the fullscreen wrapper */
  isFullscreen?: boolean;
  /** Used to conditionally show the hide-fullscreen button if it makes sense (e.g. empty content shouldn't be fullscreened) */
  allowFullscreen?: boolean;
  /** Array of active action names purely for rendering active states. Format is domain-specific. */
  activeTools?: string[];
  /** Flag to hide the common actions block completely if desired */
  hideCommonActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  allowFullscreen: true,
  hideCommonActions: false
});

const emit = defineEmits<{
  (e: "toggleFullscreen"): void;
  (e: "delete"): void;
}>();
</script>

<template>
  <div class="shared-note-toolbar flex items-center justify-between gap-1.5 flex-wrap rounded-t-lg bg-slate-50 p-1.5 border-b border-slate-200">
    <!-- Left/Primary Area: Note-type specific tools -->
    <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
      <slot name="default"></slot>
    </div>

    <!-- Right/Secondary Area: Common Actions -->
    <div v-if="!hideCommonActions" class="flex items-center gap-0.5 shrink-0 ml-auto">
      <slot name="common-actions-prefix"></slot>

      <div v-if="$slots['common-actions-prefix']" class="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1 hidden md:block" />

      <!-- Fullscreen toggle -->
      <shared-note-toolbar-button v-if="props.allowFullscreen" title="Toggle Fullscreen" :disabled="isLoading"
        @click="emit('toggleFullscreen')"
        :icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'" />

      <!-- Delete -->
      <shared-note-toolbar-button title="Delete Note" variant="danger" :disabled="isLoading" @click="emit('delete')">
        <UIcon name="i-heroicons-trash" class="w-4 h-4 group-hover:scale-110 transition-transform" />
      </shared-note-toolbar-button>
    </div>
  </div>
</template>


