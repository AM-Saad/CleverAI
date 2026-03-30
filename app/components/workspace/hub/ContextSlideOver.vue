<script setup lang="ts">
import { computed } from "vue";
import type { ContextPreview } from "~/composables/useContextBridge";

interface Props {
  isOpen: boolean;
  preview: ContextPreview | null;
  isLoading?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

// Handle ESC key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.isOpen) {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleEscape);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscape);
});

// Determine which viewer component to show
const viewerComponent = computed(() => {
  if (!props.preview) return null;
  return props.preview.type === "NOTE" ? "NoteContextViewer" : "PdfContextViewer";
});
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-40" @click="emit('close')" />
    </Transition>

    <!-- Slide-Over Panel -->
    <Transition name="slide">
      <div v-if="isOpen"
        class="fixed inset-y-0 right-0 w-full md:w-1/2 lg:w-2/5 bg-surface-100 dark:bg-dark shadow-xl z-50 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-muted dark:border-neutral">
          <div class="flex items-center gap-2">
            <u-icon v-if="preview?.type === 'NOTE'" name="i-lucide-file-text" :size="UI_CONFIG.ICON_SIZE"
              class="text-primary" />
            <u-icon v-else-if="preview?.type === 'PDF'" name="i-lucide-file" :size="UI_CONFIG.ICON_SIZE"
              class="text-primary" />
            <ui-subtitle size="base" weight="semibold">
              {{ preview?.type === 'NOTE' ? 'Note Context' : 'PDF Context' }}
            </ui-subtitle>
          </div>
          <u-button variant="soft" size="sm" color="neutral" @click="emit('close')" aria-label="Close context preview">
            <u-icon name="i-lucide-x" :size="UI_CONFIG.ICON_SIZE" />
          </u-button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden bg-white dark:bg-dark-surface">
          <!-- Loading State -->
          <div v-if="isLoading" class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-3">
              <u-icon name="i-lucide-loader" class="w-8 h-8 animate-spin text-primary" />
              <ui-paragraph size="sm" color="muted">Loading context...</ui-paragraph>
            </div>
          </div>

          <!-- Dynamic Viewer Component -->
          <component v-else-if="preview && viewerComponent" :is="viewerComponent" :preview="preview"
            class="h-full overflow-auto" />

          <!-- Empty State -->
          <div v-else class="flex items-center justify-center h-full">
            <ui-paragraph size="sm" color="muted">No context available</ui-paragraph>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Fade transition for backdrop */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition for panel */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

/* Highlight effect for scrolled-to blocks */
:deep(.highlight-block) {
  background-color: rgb(254 249 195 / 1);
  transition: background-color 0.5s;
}

.dark :deep(.highlight-block) {
  background-color: rgb(113 63 18 / 0.3);
}
</style>
