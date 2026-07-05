<template>
  <Transition name="ai-bubble">
    <div
      v-if="visible"
      class="ai-bubble"
      :style="{ left: x + 'px', top: y + 'px' }"
      role="toolbar"
      aria-label="AI actions for selection"
    >
      <button type="button" class="ai-bubble__seg ai-bubble__seg--accent" @click="emit('action', 'explain')"> <!-- design-allow: anchored AI bubble segments are native controls -->
        <UiIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
        Explain
      </button>
      <span class="ai-bubble__div" />
      <button type="button" class="ai-bubble__seg" @click="emit('action', 'rewrite')">Rewrite</button> <!-- design-allow: anchored AI bubble segment -->
      <span class="ai-bubble__div" />
      <button type="button" class="ai-bubble__seg" @click="emit('action', 'cards')"> <!-- design-allow: anchored AI bubble segment -->
        <UiIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5" />
        Cards
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * SelectionAiBubble — the dark pill anchored at a text selection. The ONLY entry
 * to note AI: it is always tied to selected text, never a floating chat. Emits
 * the chosen action; the editor owns the selection + the AI result sheet.
 */
defineProps<{
  visible: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: "action", kind: "explain" | "rewrite" | "cards"): void;
}>();
</script>

<style scoped>
.ai-bubble {
  position: absolute;
  z-index: var(--z-popover);
  transform: translate(-50%, -100%);
  display: inline-flex;
  align-items: center;
  gap: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--color-dark);
  box-shadow: 0 8px 24px color-mix(in srgb, black 28%, transparent);
  white-space: nowrap;
}
.ai-bubble__seg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 10px 13px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-white);
}
.ai-bubble__seg--accent {
  color: var(--color-accent-cyan);
}
.ai-bubble__seg:active {
  background: color-mix(in srgb, var(--color-white) 12%, transparent);
}
.ai-bubble__div {
  width: 1px;
  height: 18px;
  background: color-mix(in srgb, var(--color-white) 18%, transparent);
}
.ai-bubble-enter-active,
.ai-bubble-leave-active {
  transition: opacity var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-emphasized);
}
.ai-bubble-enter-from,
.ai-bubble-leave-to {
  opacity: 0;
  transform: translate(-50%, -90%) scale(0.92);
}
</style>
