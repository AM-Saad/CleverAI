<script setup lang="ts">
/**
 * SplitPaneLayout — reusable two-pane resizable split component.
 *
 * Mirrors the workspace panel resize/collapse pattern.
 * - Desktop (md+): horizontal side-by-side, col-resize handle, collapse to 44px strip.
 * - Mobile (<md):  vertical stacking, row-resize handle, collapse to 44px strip.
 *
 * Usage:
 *   <shared-split-pane-layout
 *     storage-key="splitPaneSizes_ws123"
 *     left-label="Note A"
 *     right-label="Note B"
 *   >
 *     <template #left>...</template>
 *     <template #right>...</template>
 *   </shared-split-pane-layout>
 */

import { useResponsive } from '~/composables/ui/useResponsive';

const props = defineProps<{
  /** localStorage key for persisting panel sizes */
  storageKey: string;
  leftLabel?: string;
  rightLabel?: string;
  leftIcon?: string;
  rightIcon?: string;
  /** Minimum size for each panel as a percentage (default 20) */
  minPercent?: number;
}>();

// ─── Constants ────────────────────────────────────────────────────
const SNAP_STEPS = [20, 25, 33, 40, 50, 60, 67, 75, 80];
const COLLAPSED_STRIP_PX = 44;
const HANDLE_PX = 8;
const TRANSITION_MS = 250;

// ─── Responsive ───────────────────────────────────────────────────
const { isMobile } = useResponsive();
/** Vertical axis on mobile (top/bottom stacking), horizontal on desktop */
const isVertical = computed(() => isMobile.value);

// ─── State ────────────────────────────────────────────────────────
const panelSizes = ref<[number, number]>([50, 50]);
const collapsedSide = ref<'left' | 'right' | null>(null);
const isResizing = ref(false);
const isAnimating = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const minPct = computed(() => props.minPercent ?? 20);

// ─── Computed styles ──────────────────────────────────────────────
function panelStyle(size: number, collapsed: boolean) {
  if (collapsed) {
    return {
      flexBasis: `${COLLAPSED_STRIP_PX}px`,
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 0,
      minHeight: 0,
      transition: `flex-basis ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
    };
  }
  return {
    flexBasis: `${size}%`,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
    transition: isResizing.value ? 'none' : `flex-basis ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
  };
}

const leftStyle = computed(() => panelStyle(panelSizes.value[0], collapsedSide.value === 'left'));
const rightStyle = computed(() => panelStyle(panelSizes.value[1], collapsedSide.value === 'right'));

// ─── Collapse / Expand ────────────────────────────────────────────
function toggleLeft() {
  // Guard: can't collapse both panes
  if (collapsedSide.value === 'right') return;
  isAnimating.value = true;
  if (collapsedSide.value === 'left') {
    collapsedSide.value = null;
    panelSizes.value = [50, 50];
  } else {
    collapsedSide.value = 'left';
  }
  setTimeout(() => { isAnimating.value = false; }, TRANSITION_MS + 50);
  save();
}

function toggleRight() {
  if (collapsedSide.value === 'left') return;
  isAnimating.value = true;
  if (collapsedSide.value === 'right') {
    collapsedSide.value = null;
    panelSizes.value = [50, 50];
  } else {
    collapsedSide.value = 'right';
  }
  setTimeout(() => { isAnimating.value = false; }, TRANSITION_MS + 50);
  save();
}

// ─── Snap helper ──────────────────────────────────────────────────
function snapToStep(value: number): number {
  let closest = SNAP_STEPS[0]!;
  let minDist = Math.abs(value - closest);
  for (const step of SNAP_STEPS) {
    const dist = Math.abs(value - step);
    if (dist < minDist) { minDist = dist; closest = step; }
  }
  return closest;
}

// ─── Resize drag ──────────────────────────────────────────────────
function startResize(event: MouseEvent | TouchEvent) {
  if (collapsedSide.value) return; // can't resize while a pane is collapsed
  event.preventDefault();
  isResizing.value = true;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', stopResize);
  document.body.style.cursor = isVertical.value ? 'row-resize' : 'col-resize';
  document.body.style.userSelect = 'none';
}

function onMouseMove(e: MouseEvent) {
  doResize(e.clientX, e.clientY);
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault(); // prevents page scroll during vertical resize
  const t = e.touches[0];
  if (t) doResize(t.clientX, t.clientY);
}

function doResize(cx: number, cy: number) {
  if (!isResizing.value || !containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const horiz = !isVertical.value;
  const containerSize = horiz ? rect.width : rect.height;
  const available = containerSize - HANDLE_PX;
  if (available <= 0) return;

  const pos = horiz ? (cx - rect.left) : (cy - rect.top);
  const rawPct = (pos / available) * 100;
  const clamped = Math.max(minPct.value, Math.min(100 - minPct.value, rawPct));
  const snapped = snapToStep(clamped);

  panelSizes.value = [snapped, 100 - snapped];
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  save();
}

// ─── Persistence ──────────────────────────────────────────────────
function save() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(props.storageKey, JSON.stringify({
      sizes: panelSizes.value,
      collapsed: collapsedSide.value,
    }));
  } catch { /* ignore */ }
}

function load() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(props.storageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.sizes) && data.sizes.length === 2 &&
      data.sizes.every((s: unknown) => typeof s === 'number')) {
      panelSizes.value = data.sizes as [number, number];
    }
    if (data.collapsed === 'left' || data.collapsed === 'right' || data.collapsed === null) {
      collapsedSide.value = data.collapsed;
    }
  } catch { /* ignore */ }
}

// ─── Collapse icons ───────────────────────────────────────────────
const leftCollapseIcon = computed(() => {
  if (isVertical.value) {
    return collapsedSide.value === 'left' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up';
  }
  return collapsedSide.value === 'left' ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left';
});

const rightCollapseIcon = computed(() => {
  if (isVertical.value) {
    return collapsedSide.value === 'right' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down';
  }
  return collapsedSide.value === 'right' ? 'i-lucide-chevron-left' : 'i-lucide-chevron-right';
});

// ─── Lifecycle ────────────────────────────────────────────────────
onMounted(() => load());
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', stopResize);
  if (isResizing.value) {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// ─── Expose for parent refs ───────────────────────────────────────
defineExpose({ toggleLeft, toggleRight, collapsedSide, isResizing });
</script>

<template>
  <div ref="containerRef" class="spl-layout"
    :class="[isVertical ? 'spl-layout--vertical' : 'spl-layout--horizontal', { 'spl-layout--resizing': isResizing }]">

    <!-- ── LEFT / TOP PANEL ─────────────────────────────────────── -->
    <div class="spl-panel spl-panel-left" :style="leftStyle">
      <!-- Collapsed strip -->
      <div v-if="collapsedSide === 'left'" class="spl-collapsed-strip" role="button" tabindex="0"
        :aria-label="`Expand ${leftLabel ?? 'left panel'}`" @click="toggleLeft" @keydown.enter="toggleLeft">
        <slot name="left-strip">
          <u-icon v-if="leftIcon" :name="leftIcon" class="spl-strip-icon" />
          <span v-if="leftLabel" class="spl-strip-label">{{ leftLabel }}</span>
        </slot>
        <u-icon :name="leftCollapseIcon" class="spl-strip-expand" />
      </div>

      <!-- Panel content — <div> instead of <template> to provide a stable
           DOM parent. <template v-else> creates a fragment whose parentNode
           can become null during reactive slot updates → insertBefore crash. -->
      <div v-else class="spl-panel-content">
        <slot name="left" />
      </div>
    </div>

    <!-- ── RESIZE HANDLE ────────────────────────────────────────── -->
    <div class="spl-handle" :class="{ 'spl-handle--disabled': !!collapsedSide, 'spl-handle--vertical': isVertical }"
      :aria-hidden="true" @mousedown="startResize" @touchstart.prevent="startResize">
      <div class="spl-handle-grip" :class="isVertical ? 'spl-handle-grip--horiz' : 'spl-handle-grip--vert'">
        <span class="spl-grip-dot" />
        <span class="spl-grip-dot" />
        <span class="spl-grip-dot" />
      </div>
    </div>

    <!-- ── RIGHT / BOTTOM PANEL ─────────────────────────────────── -->
    <div class="spl-panel spl-panel-right" :style="rightStyle">
      <!-- Collapsed strip -->
      <div v-if="collapsedSide === 'right'" class="spl-collapsed-strip" role="button" tabindex="0"
        :aria-label="`Expand ${rightLabel ?? 'right panel'}`" @click="toggleRight" @keydown.enter="toggleRight">
        <u-icon :name="rightCollapseIcon" class="spl-strip-expand" />
        <slot name="right-strip">
          <u-icon v-if="rightIcon" :name="rightIcon" class="spl-strip-icon" />
          <span v-if="rightLabel" class="spl-strip-label">{{ rightLabel }}</span>
        </slot>
      </div>

      <!-- Panel content — stable DOM parent (see left panel comment) -->
      <div v-else class="spl-panel-content">
        <slot name="right" />
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────────────────── */
.spl-layout {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--color-white, #fff);
  padding: 0.5rem;
  /* space for handle */
  /* background-color: var(--color-surface-subtle);
  border-radius: 0.75rem;
  margin: 0.5rem;
  border: 2px solid var(--color-surface-strong); */
}

.spl-layout--horizontal {
  flex-direction: row;
}

.spl-layout--vertical {
  flex-direction: column;
}

.spl-layout--resizing {
  cursor: col-resize;
}

.spl-layout--vertical.spl-layout--resizing {
  cursor: row-resize;
}

/* ── Panels ──────────────────────────────────────────────────────── */
.spl-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.spl-panel-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 2px;
  background: #fff;
  border-radius: .2rem;
}

/* ── Collapsed strip ─────────────────────────────────────────────── */
.spl-collapsed-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: var(--ui-bg, #fff);
  border: 1px solid var(--ui-border, #e2e8f0);
  border-radius: 12px;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
  gap: 6px;
}

/* Horizontal layout: strip is vertical (column) on left/right */
.spl-layout--horizontal .spl-collapsed-strip {
  flex-direction: column;
  width: 44px;
  height: 100%;
  padding: 12px 0;
}

/* Vertical layout: strip is horizontal (row) on top/bottom */
.spl-layout--vertical .spl-collapsed-strip {
  flex-direction: row;
  height: 44px;
  width: 100%;
  padding: 0 12px;
}

.spl-collapsed-strip:hover {
  background: var(--ui-bg-accented, #f1f5f9);
  border-color: var(--color-primary, #6366f1);
}

.spl-strip-icon {
  width: 16px;
  height: 16px;
  color: var(--color-content-secondary, #6b7280);
  flex-shrink: 0;
}

.spl-strip-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-content-secondary, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Rotate label to read vertically in horizontal layout */
.spl-layout--horizontal .spl-strip-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.spl-strip-expand {
  width: 14px;
  height: 14px;
  color: var(--color-content-tertiary, #9ca3af);
  flex-shrink: 0;
}

/* ── Resize Handle ───────────────────────────────────────────────── */
.spl-handle {
  flex: 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  transition: background 0.15s ease;
  border-radius: 4px;
  margin: 2rem 2px;
}

.spl-handle--vertical {
  cursor: row-resize;
  margin: 0 8px;
}

/* Expand hit area */
.spl-handle::before {
  content: '';
  position: absolute;
  inset: 0 -4px;
}

.spl-handle--vertical::before {
  inset: -4px 0;
}

.spl-handle:hover {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, transparent);
}

.spl-handle--disabled {
  cursor: default;
  pointer-events: none;
  opacity: 0.3;
}

/* ── Grip dots ───────────────────────────────────────────────────── */
.spl-handle-grip {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.spl-handle-grip--vert {
  flex-direction: column;
}

.spl-handle-grip--horiz {
  flex-direction: row;
}

.spl-handle:hover .spl-handle-grip {
  opacity: 0.8;
}

.spl-grip-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary, #6366f1);
}

/* Active resize */
.spl-layout--resizing .spl-handle {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 20%, transparent);
}

.spl-layout--resizing .spl-handle .spl-handle-grip {
  opacity: 1;
}
</style>