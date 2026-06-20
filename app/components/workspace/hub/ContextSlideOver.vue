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
      <div v-if="isOpen" class="fixed inset-0 bg-[var(--ds-backdrop-dim)] z-40" @click="emit('close')" />
    </Transition>

    <!-- Slide-Over Panel -->
    <Transition name="slide">
      <UiOverlaySurface
        v-if="isOpen"
        tag="aside"
        role="dialog"
        aria-label="Context preview"
        kind="drawer"
        layer="drawer"
        size="xs"
        class-name="fixed inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none border-y-0 border-r-0 p-0 md:w-1/2 lg:w-2/5"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-secondary">
          <div class="flex items-center gap-2">
            <Icon v-if="preview?.type === 'NOTE'" name="i-lucide-file-text" :size="UI_CONFIG.ICON_SIZE"
              class="text-primary" />
            <Icon v-else-if="preview?.type === 'PDF'" name="i-lucide-file" :size="UI_CONFIG.ICON_SIZE"
              class="text-primary" />
            <ui-subtitle size="base" weight="semibold">
              {{ preview?.type === 'NOTE' ? 'Note Context' : 'PDF Context' }}
            </ui-subtitle>
          </div>
          <UiIconButton
            icon="i-lucide-x"
            label="Close context preview"
            variant="soft"
            size="sm"
            @click="emit('close')"
          />
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden bg-surface">
          <!-- Loading State -->
          <div v-if="isLoading" class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-3">
              <Icon name="i-lucide-loader" class="w-8 h-8 animate-spin text-primary" />
              <ui-paragraph size="sm" color="content-secondary">Loading context...</ui-paragraph>
            </div>
          </div>

          <!-- Dynamic Viewer Component -->
          <component v-else-if="preview && viewerComponent" :is="viewerComponent" :preview="preview"
            class="h-full overflow-auto" />

          <!-- Empty State -->
          <div v-else class="flex items-center justify-center h-full">
            <ui-paragraph size="sm" color="content-secondary">No context available</ui-paragraph>
          </div>
        </div>
      </UiOverlaySurface>
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
