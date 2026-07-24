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
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { prefersReducedMotion } from "~/composables/ui/useViewTransitionMorph";
import { designTokenValues } from "~/design-system/tokens.generated";

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
    /**
     * Spring the panel's height when its content grows/shrinks while open
     * (mode swaps, expanding pickers) instead of snapping. VT morphs and
     * reduced motion bypass it.
     */
    animateResize?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
    dismissThreshold: 110,
    morphing: false,
    animateResize: true,
  },
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

// ── Springy content resize ──────────────────────────────────────────────────
// The panel is bottom-anchored with auto height, so a content swap normally
// snaps its top edge. A ResizeObserver catches the new height and a WAAPI
// height animation (fill: none — the box stays auto) springs old → new.
// WAAPI because the global reduced-motion CSS kill-switch and the panel's own
// transitions don't interfere with it; reduced motion is re-checked in JS.
const SPRING_EASE = designTokenValues["--ease-spring"];
const SPRING_MS = Number.parseFloat(designTokenValues["--duration-spring"]);

let resizeObserver: ResizeObserver | null = null;
let panelHeight: number | null = null;
let heightAnim: Animation | null = null;

function skipResizeSpring() {
  return (
    !props.animateResize || props.morphing || dragging || prefersReducedMotion()
  );
}

function springPanelHeight(from: number, to: number) {
  const el = panel.value;
  if (!el) return;
  heightAnim = el.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    { duration: SPRING_MS, easing: SPRING_EASE },
  );
  const settle = () => {
    heightAnim = null;
    if (!el.isConnected) return;
    const natural = el.offsetHeight;
    panelHeight = natural;
    // While the keyframes owned the box the observer couldn't see content
    // changes — chase any drift so the height never snaps at the end.
    if (Math.abs(natural - to) >= 2 && !skipResizeSpring()) {
      springPanelHeight(to, natural);
    }
  };
  heightAnim.finished.then(settle, settle);
}

function onPanelResize(entries: ResizeObserverEntry[]) {
  // Our own height animation drives the border box — those frames aren't
  // content changes.
  if (heightAnim) return;
  const el = panel.value;
  if (!el) return;
  const next =
    entries[entries.length - 1]?.borderBoxSize?.[0]?.blockSize ??
    el.offsetHeight;
  const prev = panelHeight;
  panelHeight = next;
  if (prev === null || Math.abs(next - prev) < 2) return;
  if (skipResizeSpring()) return;
  springPanelHeight(prev, next);
}

watch(panel, (el) => {
  resizeObserver?.disconnect();
  heightAnim?.cancel();
  heightAnim = null;
  panelHeight = null;
  if (el && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onPanelResize);
    resizeObserver.observe(el, { box: "border-box" });
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  heightAnim?.cancel();
});

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
  /* Align with the centered shell column (max-width: 680px in layouts/default.vue) on wider viewports. */
  max-width: 680px;
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
