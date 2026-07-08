<template>
  <Teleport to="body">
    <Transition :name="morphing ? 'ds-sheet-none' : 'ds-sheet-scrim'">
      <div
        v-if="open"
        class="ds-sheet-scrim"
        aria-hidden="true"
        @click="closeOnBackdrop && emit('update:open', false)"
      />
    </Transition>

    <Transition
      :name="morphing ? 'ds-sheet-none' : 'ds-sheet'"
      @after-leave="onAfterLeave"
    >
      <div
        v-if="open"
        ref="panel"
        class="ds-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Sheet'"
        tabindex="-1"
        :style="panelStyle"
        @keydown="onKeydown"
      >
        <!-- Grab handle: drag down (or tap) to dismiss -->
        <div
          class="ds-sheet__grab"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <span class="ds-sheet__handle" />
        </div>

        <div v-if="title || $slots.header" class="ds-sheet__header">
          <slot name="header">
            <h2
              class="text-[19px] font-bold tracking-[-0.3px] text-content-on-surface-strong"
            >
              {{ title }}
            </h2>
          </slot>
        </div>

        <div class="ds-sheet__body">
          <slot />
        </div>

        <div v-if="$slots.footer" class="ds-sheet__footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * UiSheet — bottom sheet over the spec scrim (`--ds-sheet-scrim`). Dismisses on
 * backdrop tap and on swipe-down (finger-following with a release threshold).
 * Reuses the design tokens for radius/shadow/scrim. Use for capture, AI result,
 * generate, and workspace-switcher sheets.
 */
import { ref, computed, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    closeOnBackdrop?: boolean;
    /** Drag distance (px) past which release dismisses. */
    dismissThreshold?: number;
    /**
     * View-transition name the panel carries while open, making the sheet a
     * shared-element morph target/source (see useViewTransitionMorph).
     */
    morphName?: string;
    /**
     * True while a view-transition morph is driving this open/close — skips
     * the sheet's own slide so the VT snapshots capture resting states.
     */
    morphing?: boolean;
  }>(),
  { closeOnBackdrop: true, dismissThreshold: 110, morphing: false },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "closed"): void;
}>();

const panel = ref<HTMLElement | null>(null);
const dragY = ref(0);
let dragging = false;
let startY = 0;
const isOpen = computed(() => props.open);

const { onKeydown } = useFocusTrap(isOpen, panel, {
  onEscape: () => emit("update:open", false),
});

const panelStyle = computed(() => ({
  ...(props.morphName ? { viewTransitionName: props.morphName } : {}),
  ...(dragY.value > 0
    ? { transform: `translateY(${dragY.value}px)`, transition: "none" }
    : {}),
}));

function onPointerDown(e: PointerEvent) {
  dragging = true;
  startY = e.clientY;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  dragY.value = Math.max(0, e.clientY - startY);
}
function onPointerUp() {
  if (!dragging) return;
  dragging = false;
  if (dragY.value > props.dismissThreshold) {
    emit("update:open", false);
  }
  dragY.value = 0;
}

function onAfterLeave() {
  emit("closed");
}

// Body scroll lock while open.
watch(
  () => props.open,
  (v) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.overflow = v ? "hidden" : "";
  },
  { immediate: true },
);
</script>

<style scoped>
.ds-sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--ds-sheet-scrim);
}
.ds-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Align with the centered mobile app column on wider viewports. */
  max-width: 480px;
  margin: 0 auto;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  padding: 0 var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  background: var(--color-background);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  box-shadow: var(--shadow-sheet);
  touch-action: pan-y;
}
.ds-sheet__grab {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 28px;
  margin: 0 calc(-1 * var(--space-4));
  cursor: grab;
  touch-action: none;
}
.ds-sheet__handle {
  width: 40px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
}
.ds-sheet__header {
  padding-bottom: var(--space-3);
}
.ds-sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.ds-sheet__footer {
  padding-top: var(--space-3);
}

.ds-sheet-enter-active,
.ds-sheet-leave-active {
  transition: transform var(--duration-slow) var(--ease-standard);
}
.ds-sheet-enter-from,
.ds-sheet-leave-to {
  transform: translateY(100%);
}
.ds-sheet-scrim-enter-active,
.ds-sheet-scrim-leave-active {
  transition: opacity var(--duration-slow) var(--ease-standard);
}
.ds-sheet-scrim-enter-from,
.ds-sheet-scrim-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ds-sheet-enter-active,
  .ds-sheet-leave-active,
  .ds-sheet-scrim-enter-active,
  .ds-sheet-scrim-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
