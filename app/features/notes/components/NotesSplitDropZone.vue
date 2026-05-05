<template>
  <!-- Only renders as an overlay while a split-drag is in progress -->
  <Transition name="split-drop-zone">
    <div v-if="isDragging" class="split-drop-zone-overlay" @dragover.prevent @dragleave="handleDragLeave">
      <!-- Left drop zone -->
      <div class="split-drop-zone-half" :class="{ 'split-drop-zone-half--hovered': hoveredZone === 'left' }"
        @dragenter.prevent="emit('hoverZone', 'left')" @dragover.prevent="emit('hoverZone', 'left')"
        @drop.prevent="handleDrop('left', $event)">
        <div class="split-drop-zone-content">
          <icon name="i-lucide-panel-left" class="split-drop-zone-icon" />
          <span class="split-drop-zone-label">Split Left</span>
        </div>
      </div>

      <!-- Divider hint -->
      <div class="split-drop-zone-divider-hint" />

      <!-- Right drop zone -->
      <div class="split-drop-zone-half" :class="{ 'split-drop-zone-half--hovered': hoveredZone === 'right' }"
        @dragenter.prevent="emit('hoverZone', 'right')" @dragover.prevent="emit('hoverZone', 'right')"
        @drop.prevent="handleDrop('right', $event)">
        <div class="split-drop-zone-content">
          <icon name="i-lucide-panel-right" class="split-drop-zone-icon" />
          <span class="split-drop-zone-label">Split Right</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { SplitPosition } from '~/composables/ui/useSplitNotes';

const props = defineProps<{
  isDragging: boolean;
  hoveredZone: 'left' | 'right' | null;
}>();

const emit = defineEmits<{
  hoverZone: [zone: 'left' | 'right' | null];
  drop: [noteId: string, position: SplitPosition];
}>();

function handleDragLeave(e: DragEvent) {
  // Only clear if leaving the overlay entirely (not entering a child)
  const target = e.relatedTarget as HTMLElement | null;
  if (!target || !(e.currentTarget as HTMLElement).contains(target)) {
    emit('hoverZone', null);
  }
}

function handleDrop(zone: SplitPosition, e: DragEvent) {
  const noteId = e.dataTransfer?.getData('text/note-id');
  if (!noteId) return;
  emit('hoverZone', null);
  emit('drop', noteId, zone);
}
</script>

<style scoped>
.split-drop-zone-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  pointer-events: all;
  border-radius: 8px;
  overflow: hidden;
}

.split-drop-zone-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border: 2px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);
  transition: background 0.15s ease, border-color 0.15s ease;
  cursor: copy;
}

.split-drop-zone-half:first-child {
  border-right: none;
  border-radius: 8px 0 0 8px;
}

.split-drop-zone-half:last-child {
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.split-drop-zone-half--hovered {
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  border-color: var(--color-primary);
  border-style: solid;
}

.split-drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  user-select: none;
}

.split-drop-zone-icon {
  width: 28px;
  height: 28px;
  color: var(--color-primary);
  opacity: 0.7;
}

.split-drop-zone-half--hovered .split-drop-zone-icon {
  opacity: 1;
}

.split-drop-zone-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  opacity: 0.7;
  letter-spacing: 0.02em;
}

.split-drop-zone-half--hovered .split-drop-zone-label {
  opacity: 1;
}

.split-drop-zone-divider-hint {
  width: 2px;
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
  flex-shrink: 0;
}

/* Transition */
.split-drop-zone-enter-active,
.split-drop-zone-leave-active {
  transition: opacity 0.15s ease;
}

.split-drop-zone-enter-from,
.split-drop-zone-leave-to {
  opacity: 0;
}
</style>
