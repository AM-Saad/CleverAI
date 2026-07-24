<template>
  <NodeViewWrapper class="paper-block-wrapper" :class="{ 'paper-block-wrapper--resizing': isResizing }"
    :style="{ width: `${W}px`, marginLeft: xOffset ? `${xOffset}px` : undefined }" data-type="paper">
    <!-- Header bar -->
    <div class="paper-block-header" contenteditable="false">
      <div class="paper-block-controls">
        <!-- Tool selector -->
        <div class="paper-tool-group">
          <UiToolbarButton v-for="t in tools" :key="t.id" :icon="t.icon" :label="t.label" :active="activeTool === t.id"
            @click="activeTool = t.id" />
        </div>

        <span class="paper-sep" />

        <!-- Color (only for pen) -->
        <template v-if="activeTool === 'pen'">
          <div class="paper-color-swatch-wrapper">
            <span class="paper-color-swatch" :style="{ backgroundColor: color }" />
            <!-- design-allow: native color picker — no Ui primitive wraps the OS color-picker UX -->
            <input type="color" v-model="color" class="paper-color-input" title="Stroke color" />
          </div>

          <!-- design-allow: 14px color-swatch selectors, no shared style contract with Ui* buttons applies at this scale -->
          <!-- <div class="paper-presets">
            <button v-for="c in presetColors" :key="c" type="button" class="paper-preset-btn"
              :class="{ 'paper-preset-btn--active': color === c }" :style="{ backgroundColor: c }"
              :aria-label="`Use color ${c}`" :aria-pressed="color === c" @click="color = c" />
          </div> -->

          <span class="paper-sep" />

          <!-- design-allow: native range slider — no Ui primitive wraps type=range -->
          <input type="range" min="1" max="12" v-model.number="size" class="paper-range" title="Stroke width" />
          <span class="paper-size-label">{{ size }}px</span>
        </template>

        <template v-if="activeTool === 'eraser'">
          <span class="paper-hint">Click a stroke to erase it</span>
        </template>
      </div>

      <div class="paper-block-actions">
        <!-- Undo / Redo -->
        <UiToolbarButton icon="i-lucide-undo-2" label="Undo" tooltip="Undo (⌘Z)" :disabled="!canUndo" @click="undo" />
        <UiToolbarButton icon="i-lucide-redo-2" label="Redo" tooltip="Redo (⌘⇧Z)" :disabled="!canRedo" @click="redo" />

        <span class="paper-sep" />

        <!-- Grid toggle -->
        <UiToolbarButton icon="i-lucide-grid-3x3" label="Toggle grid" :active="gridType !== 'none'"
          @click="cycleGrid" />

        <span class="paper-sep" />

        <!-- Zoom -->
        <div class="paper-zoom-group">
          <UiToolbarButton icon="i-lucide-minus" label="Zoom out" tooltip="Zoom out" :disabled="!canZoomOut"
            @click="zoomOut" />
          <UiToolbarButton :icon-only="false" :label="zoomPercentLabel" tooltip="Reset zoom" @click="resetZoom" />
          <UiToolbarButton icon="i-lucide-plus" label="Zoom in" tooltip="Zoom in" :disabled="!canZoomIn"
            @click="zoomIn" />
        </div>

        <span class="paper-sep" />

        <!-- Download PNG -->
        <UiToolbarButton icon="i-lucide-download" label="Export as PNG" @click="exportPng" />

        <span class="paper-sep" />

        <!-- Clear -->
        <UiToolbarButton icon="i-lucide-eraser" label="Clear all" @click="clearDrawing" />
        <!-- Delete block -->
        <UiToolbarButton icon="i-lucide-trash-2" label="Delete sketch" tone="error" @click="props.deleteNode()" />
      </div>
    </div>

    <!-- Canvas frame: fixed-size viewport. Content pans/zooms inside it via
         .paper-canvas-stage; the frame's own box never changes size. -->
    <div class="paper-canvas-frame" ref="frameRef" @wheel="onWheel" @dblclick="onDoubleClick"
      @touchstart="onFrameTouchStart" @touchmove="onFrameTouchMove" @touchend="onFrameTouchEnd"
      @touchcancel="onFrameTouchEnd">
      <!-- Zoomable/pannable stage — only the drawing surface scales; hints,
           badges and buttons below stay outside it so they stay legible. -->
      <div class="paper-canvas-stage" :class="{ 'paper-canvas-stage--gesturing': isGesturing }" :style="stageStyle">
        <!-- Drawing surface -->
        <svg ref="canvasRef" class="paper-canvas" :style="{ width: '100%', height: `${H}px` }" :class="[
          `paper-grid--${gridType}`,
          activeTool === 'eraser' ? 'paper-canvas--eraser' : '',
          isActive ? 'paper-canvas--active' : '',
          isResizing ? 'paper-canvas--resizing' : '',
        ]" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMinYMin slice" @mousedown="onPointerDown"
          @touchstart.prevent="onPointerDown">
          <!-- Existing strokes (clickable for eraser) -->
          <path v-for="line in currentLines" :key="line.id" :d="line.path" :stroke="line.color"
            :stroke-width="line.size" fill="none" stroke-linecap="round" stroke-linejoin="round"
            :class="{ 'paper-stroke--erasable': activeTool === 'eraser' }" @click="eraseLine(line.id)" />
          <!-- Active stroke preview -->
          <path v-if="activePath" :d="activePath" :stroke="color" :stroke-width="size" fill="none"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
        </svg>
      </div>

      <!-- Empty hint -->
      <div v-if="!currentLines.length && !isDrawing" class="paper-empty-hint" contenteditable="false">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
          <path d="m12 19 7-7 3 3-7 7-3-3z" />
          <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="m2 2 7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
        <span>Hold to sketch</span>
      </div>

      <!-- Live zoom readout while actively pinching / ctrl+scrolling -->
      <div v-if="isGesturing" class="paper-zoom-indicator">{{ zoomPercentLabel }}</div>

      <!-- Activation state: hold-to-draw hint (inactive) / explicit exit (active) -->
      <div v-if="!isActive" class="paper-hold-hint" :class="{ 'paper-hold-hint--pressing': isPressPending }"
        contenteditable="false">
        <UiIcon name="i-lucide-hand" class="h-3 w-3" />
        <span>Hold to draw</span>
      </div>
      <UiButton v-else type="button" tone="primary" variant="soft" size="xs" class="paper-done-btn" @pointerdown.stop
        @click="deactivate">
        <UiIcon name="i-lucide-check" class="h-3.5 w-3.5" />
        Done
      </UiButton>
    </div>

    <!-- Resize handles (attached to paper-block-wrapper card) -->
    <div v-for="dir in RESIZE_DIRS" :key="dir" :class="['paper-resize-handle', `paper-resize-handle--${dir}`]"
      @mousedown="onResizeStart(dir, $event)" @touchstart.prevent="onResizeStart(dir, $event)">
      <template v-if="dir === 'nw'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          class="paper-resize-icon">
          <path d="M17 7H7v10" />
        </svg>
      </template>
      <template v-else-if="dir === 'ne'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          class="paper-resize-icon">
          <path d="M7 7h10v10" />
        </svg>
      </template>
      <template v-else-if="dir === 'sw'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          class="paper-resize-icon">
          <path d="M17 17H7V7" />
        </svg>
      </template>
      <template v-else-if="dir === 'se'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          class="paper-resize-icon">
          <path d="M7 17h10V7" />
        </svg>
      </template>
      <div v-else class="paper-resize-grip" />
    </div>

    <node-view-content class="content-dom" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import {
  designTokenValues,
  type DesignTokenName,
} from "~/design-system/tokens.generated";
import { useHaptics } from "~/composables/pwa/useHaptics";
// @ts-ignore — d3 has no bundled type declarations
import * as d3 from "d3";

interface StrokeLine {
  id: string;
  color: string;
  size: number;
  path: string;
}

type Tool = "pen" | "eraser";
type GridType = "none" | "dots" | "lines" | "graph";
type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const props = defineProps(nodeViewProps);
const haptics = useHaptics();

// ─── Sizing (wrapper only — never rescales stroke data) ──────────
// Width tracks the available container space until the user explicitly
// resizes it; height defaults to 280 and grows from there. Both are clamped
// live so a saved size never overflows a narrower parent (e.g. after
// rotating the device).
const MIN_WIDTH = 260;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 2000;
const EXPAND_EDGE_THRESHOLD = 36;
const EXPAND_STEP = 96;
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

const containerWidth = ref(0);
const localWidth = ref<number | null>(null);
const localXOffset = ref<number | null>(null);

// Zoom/pan: a pure view transform on the stage that wraps the SVG. The
// viewBox and every stored stroke coordinate stay untouched — this only
// changes what's on screen, never the content, so it's local/ephemeral like
// `activeTool` or `gridType` rather than a persisted node attribute.
const frameRef = ref<HTMLDivElement | null>(null);
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPinching = ref(false);
const isWheelZooming = ref(false);
let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
const isGesturing = computed(() => isPinching.value || isWheelZooming.value);
const canZoomIn = computed(() => zoom.value < MAX_ZOOM - 0.001);
const canZoomOut = computed(() => zoom.value > MIN_ZOOM + 0.001);
const zoomPercentLabel = computed(() => `${Math.round(zoom.value * 100)}%`);
const stageStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}));

const W = computed(() => {
  if (isResizing.value && localWidth.value !== null) {
    return localWidth.value;
  }
  const stored = props.node.attrs.width as number | null | undefined;
  if (!containerWidth.value) return stored ?? 600;
  return Math.round(Math.min(Math.max(stored ?? containerWidth.value, MIN_WIDTH), containerWidth.value));
});
const H = computed<number>(() => props.node.attrs.height ?? 280);
const xOffset = computed<number>(() => {
  if (isResizing.value && localXOffset.value !== null) {
    return localXOffset.value;
  }
  return props.node.attrs.xOffset ?? 0;
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Stroke colors must be resolved (non-`var`) values: they are written to the
// SVG `stroke` attribute and serialized into a detached <img> for PNG export,
// where CSS custom properties would not resolve. We resolve the design-system
// tokens at runtime, falling back to the generated token values so no raw hex
// lives in this file.
const SWATCH_TOKENS: DesignTokenName[] = [
  "--color-accent-indigo",
  "--color-accent-rose",
  "--color-accent-orange",
  "--color-warning",
  "--color-success",
  "--color-accent-teal",
  "--color-accent-purple",
  "--color-content-on-background",
];

function resolveToken(name: DesignTokenName): string {
  const fallback = designTokenValues[name];
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

const presetColors = ref<string[]>([]);
function loadSwatches() {
  presetColors.value = SWATCH_TOKENS.map((t) => resolveToken(t));
}

const tools = [
  { id: "pen" as Tool, label: "Pen", icon: "i-lucide-pencil" },
  { id: "eraser" as Tool, label: "Eraser", icon: "i-lucide-eraser" },
];

// ─── State ──────────────────────────────────────────────────────
const activeTool = ref<Tool>("pen");
const color = ref<string>(designTokenValues["--color-accent-indigo"]); // resolved against the live theme at mount
const size = ref(3);
const gridType = ref<GridType>("none");
const isDrawing = ref(false);
const activePath = ref<string | null>(null);
const canvasRef = ref<SVGSVGElement | null>(null);

// Activation gate: on touch, the surface starts passive (scrolls through
// normally) and only starts capturing gestures after a deliberate hold, so a
// swipe that merely passes over the sketch while reading/scrolling the note
// isn't hijacked. Mouse input has no such conflict (wheel/scrollbar scrolling
// is unaffected either way), so it activates immediately on click.
const isActive = ref(false);
const isPressPending = ref(false);
const HOLD_ACTIVATE_MS = 500;
const HOLD_CANCEL_DISTANCE_PX = 10;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdStartX = 0;
let holdStartY = 0;

// ─── Undo/Redo ──────────────────────────────────────────────────
const undoStack = ref<StrokeLine[][]>([]);
const redoStack = ref<StrokeLine[][]>([]);

const currentLines = computed<StrokeLine[]>(() => props.node.attrs.lines || []);
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

function pushUndo() {
  undoStack.value.push(JSON.parse(JSON.stringify(currentLines.value)));
  redoStack.value = []; // clear redo on new action
}

function undo() {
  if (!canUndo.value) return;
  redoStack.value.push(JSON.parse(JSON.stringify(currentLines.value)));
  const prev = undoStack.value.pop()!;
  props.updateAttributes({ lines: prev });
}

function redo() {
  if (!canRedo.value) return;
  undoStack.value.push(JSON.parse(JSON.stringify(currentLines.value)));
  const next = redoStack.value.pop()!;
  props.updateAttributes({ lines: next });
}

// ─── Grid cycling ───────────────────────────────────────────────
const gridOrder: GridType[] = ["none", "dots", "lines", "graph"];
function cycleGrid() {
  const idx = gridOrder.indexOf(gridType.value);
  gridType.value = gridOrder[(idx + 1) % gridOrder.length] ?? "none";
}

// ─── Drawing ────────────────────────────────────────────────────
let points: [number, number][] = [];
let currentId = crypto.randomUUID();

function toSvgCoords(clientX: number, clientY: number): [number, number] | null {
  if (!canvasRef.value) return null;
  const rect = canvasRef.value.getBoundingClientRect();
  // rect is the post-zoom (visually scaled) box; divide back into SVG
  // viewBox/user-space units so strokes land under the pointer at any zoom.
  return [(clientX - rect.left) / zoom.value, (clientY - rect.top) / zoom.value];
}

function svgCoords(event: MouseEvent | TouchEvent): [number, number] | null {
  const cx =
    "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  const cy =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  return toSvgCoords(cx, cy);
}

function onPointerDown(event: MouseEvent | TouchEvent) {
  if ("touches" in event && event.touches.length > 1) {
    // Multi-touch is reserved for pinch-to-zoom (handled on the frame).
    return;
  }

  if (isActive.value) {
    startStroke(event);
    return;
  }

  const cx = "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  const cy = "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  holdStartX = cx;
  holdStartY = cy;
  isPressPending.value = true;

  if ("touches" in event) {
    window.addEventListener("touchmove", onHoldMove, { passive: true });
    window.addEventListener("touchend", onHoldCancel);
    window.addEventListener("touchcancel", onHoldCancel);
  } else {
    window.addEventListener("mousemove", onHoldMove);
    window.addEventListener("mouseup", onHoldCancel);
  }

  holdTimer = setTimeout(() => {
    holdTimer = null;
    isPressPending.value = false;
    cleanupHoldListeners();
    activateAndBegin(event);
  }, HOLD_ACTIVATE_MS);
}

function onHoldMove(event: MouseEvent | TouchEvent) {
  const cx = "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  const cy = "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  const dx = cx - holdStartX;
  const dy = cy - holdStartY;
  if (Math.hypot(dx, dy) > HOLD_CANCEL_DISTANCE_PX) {
    onHoldCancel();
  }
}

function onHoldCancel() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  isPressPending.value = false;
  cleanupHoldListeners();
}

function cleanupHoldListeners() {
  window.removeEventListener("mousemove", onHoldMove);
  window.removeEventListener("mouseup", onHoldCancel);
  window.removeEventListener("touchmove", onHoldMove);
  window.removeEventListener("touchend", onHoldCancel);
  window.removeEventListener("touchcancel", onHoldCancel);
}

function activateAndBegin(event: MouseEvent | TouchEvent) {
  isActive.value = true;
  haptics.selection();
  startStroke(event);
}

function deactivate() {
  onPointerUp();
  isActive.value = false;
}

function startStroke(event: MouseEvent | TouchEvent) {
  if (activeTool.value !== "pen") return;
  isDrawing.value = true;
  points = [];
  currentId = crypto.randomUUID();
  const pos = svgCoords(event);
  if (pos) points.push(pos);

  if ("touches" in event) {
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
    window.addEventListener("touchcancel", onPointerUp);
  } else {
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
  }
}

function onPointerMove(event: MouseEvent | TouchEvent) {
  if (!isDrawing.value) return;

  if ("touches" in event && event.touches.length > 1) {
    onPointerUp();
    return;
  }

  event.preventDefault();
  const pos = svgCoords(event);
  if (pos) {
    points.push(pos);
    activePath.value = buildPath(points);
    maybeExpandForPoint(pos[0], pos[1]);
  }
}

function onPointerUp() {
  window.removeEventListener("mousemove", onPointerMove);
  window.removeEventListener("mouseup", onPointerUp);
  window.removeEventListener("touchmove", onPointerMove);
  window.removeEventListener("touchend", onPointerUp);
  window.removeEventListener("touchcancel", onPointerUp);

  if (!isDrawing.value) return;
  isDrawing.value = false;
  activePath.value = null;

  if (points.length === 0) return;

  pushUndo();
  let pathStr = "";
  if (points.length === 1) {
    const pt = points[0];
    if (pt) {
      const [x, y] = pt;
      pathStr = `M ${x} ${y} L ${x + 0.1} ${y}`;
    }
  } else {
    pathStr = buildPath(points);
  }

  props.updateAttributes({
    lines: [
      ...currentLines.value,
      { id: currentId, color: color.value, size: size.value, path: pathStr },
    ],
  });
  points = [];
}

function buildPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  return d3.line().curve(d3.curveBasis)(pts) || "";
}

/** Grows the wrapper (never the stroke data) once ink nears the right or
 *  bottom edge, so writing never hits a hard wall mid-stroke. */
function maybeExpandForPoint(x: number, y: number) {
  const maxWidth = containerWidth.value || W.value;
  let nextWidth = W.value;
  let nextHeight = H.value;

  if (x > nextWidth - EXPAND_EDGE_THRESHOLD && nextWidth < maxWidth) {
    nextWidth = Math.min(nextWidth + EXPAND_STEP, maxWidth);
  }
  if (y > nextHeight - EXPAND_EDGE_THRESHOLD && nextHeight < MAX_HEIGHT) {
    nextHeight = Math.min(nextHeight + EXPAND_STEP, MAX_HEIGHT);
  }

  if (nextWidth !== W.value || nextHeight !== H.value) {
    props.updateAttributes({
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
    });
  }
}

// ─── Eraser ─────────────────────────────────────────────────────
function eraseLine(id: string) {
  if (!isActive.value || activeTool.value !== "eraser") return;
  pushUndo();
  props.updateAttributes({
    lines: currentLines.value.filter((l: StrokeLine) => l.id !== id),
  });
}

// ─── Clear ──────────────────────────────────────────────────────
function clearDrawing() {
  if (!currentLines.value.length) return;
  pushUndo();
  props.updateAttributes({ lines: [] });
}

// ─── Export PNG ──────────────────────────────────────────────────
function exportPng() {
  if (!canvasRef.value) return;
  const svgEl = canvasRef.value;
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W.value * 2;
    canvas.height = H.value * 2;
    const ctx = canvas.getContext("2d")!;
    // Resolved white background for the exported PNG (functional, not styling).
    ctx.fillStyle = resolveToken("--color-white");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(pngBlob);
      a.download = `sketch-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };
  img.src = url;
}

// ─── Resizing the wrapper (all edges/corners) ────────────────────
// Anchored at the top-left: width/height only ever change the visible
// canvas window, never the stored stroke coordinates. Left/top handles grow
// the box the same way right/bottom do (drag direction is simply mirrored),
// so an existing sketch is never shifted or rescaled.
let resizeDir: ResizeDir | null = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartOffsetX = 0;
const isResizing = ref(false);

function onResizeStart(dir: ResizeDir, event: MouseEvent | TouchEvent) {
  event.preventDefault();
  event.stopPropagation();
  resizeDir = dir;
  isResizing.value = true;
  resizeStartX =
    "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  resizeStartY =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  resizeStartWidth = W.value;
  resizeStartHeight = H.value;
  resizeStartOffsetX = xOffset.value;
  localWidth.value = W.value;
  localXOffset.value = xOffset.value;

  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
  window.addEventListener("touchmove", onResizeMove, { passive: false });
  window.addEventListener("touchend", onResizeEnd);
  window.addEventListener("touchcancel", onResizeEnd);
}

function onResizeMove(event: MouseEvent | TouchEvent) {
  if (!resizeDir) return;
  if ("touches" in event) event.preventDefault();

  const cx =
    "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  const cy =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  const dx = cx - resizeStartX;
  const dy = cy - resizeStartY;

  const maxWidth = containerWidth.value || resizeStartWidth;
  let nextWidth = resizeStartWidth;
  let nextHeight = resizeStartHeight;
  let nextOffsetX = resizeStartOffsetX;

  if (resizeDir.includes("e")) {
    const targetW = resizeStartWidth + dx;
    nextWidth = clamp(targetW, MIN_WIDTH, maxWidth);
  }
  if (resizeDir.includes("w")) {
    const targetW = resizeStartWidth - dx;
    nextWidth = clamp(targetW, MIN_WIDTH, maxWidth);
    const deltaW = resizeStartWidth - nextWidth;
    nextOffsetX = resizeStartOffsetX + deltaW;
  }

  if (resizeDir.includes("s")) nextHeight = resizeStartHeight + dy;
  if (resizeDir.includes("n")) nextHeight = resizeStartHeight - dy;

  localWidth.value = Math.round(nextWidth);
  localXOffset.value = Math.round(nextOffsetX);

  props.updateAttributes({
    width: Math.round(nextWidth),
    height: Math.round(clamp(nextHeight, MIN_HEIGHT, MAX_HEIGHT)),
    xOffset: Math.round(nextOffsetX),
  });
}

function onResizeEnd() {
  if (isResizing.value && localWidth.value !== null) {
    props.updateAttributes({
      width: localWidth.value,
      xOffset: localXOffset.value ?? 0,
    });
  }
  resizeDir = null;
  isResizing.value = false;
  localWidth.value = null;
  localXOffset.value = null;
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
  window.removeEventListener("touchmove", onResizeMove);
  window.removeEventListener("touchend", onResizeEnd);
  window.removeEventListener("touchcancel", onResizeEnd);
}

// ─── Zoom & pan (pinch / ctrl+wheel / buttons / double-click) ────
// The frame is a fixed-size viewport (overflow: hidden); `stageStyle`
// transforms the content inside it. Every gesture below resolves to the same
// primitive: rescale while keeping one anchor point visually pinned.
function relToFrame(clientX: number, clientY: number): { x: number; y: number } {
  const rect = frameRef.value!.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function clampPan() {
  if (zoom.value <= 1) {
    // Shrunk below 100%: center it instead of leaving it pinned to the
    // top-left corner with dead space at the bottom/right.
    panX.value = (W.value - W.value * zoom.value) / 2;
    panY.value = (H.value - H.value * zoom.value) / 2;
    return;
  }
  panX.value = clamp(panX.value, W.value * (1 - zoom.value), 0);
  panY.value = clamp(panY.value, H.value * (1 - zoom.value), 0);
}

/** Rescale to `nextZoom`, keeping whatever content sits under frame-relative
 *  point (relX, relY) pinned under that same point afterward. */
function applyZoom(nextZoom: number, relX: number, relY: number) {
  const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const contentX = (relX - panX.value) / zoom.value;
  const contentY = (relY - panY.value) / zoom.value;
  zoom.value = clamped;
  panX.value = relX - contentX * clamped;
  panY.value = relY - contentY * clamped;
  clampPan();
}

function zoomIn() {
  applyZoom(zoom.value + ZOOM_STEP, W.value / 2, H.value / 2);
}

function zoomOut() {
  applyZoom(zoom.value - ZOOM_STEP, W.value / 2, H.value / 2);
}

function resetZoom() {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
  haptics.selection();
}

function onDoubleClick(event: MouseEvent) {
  if (zoom.value > 1.01) {
    resetZoom();
    return;
  }
  const rel = relToFrame(event.clientX, event.clientY);
  applyZoom(2, rel.x, rel.y);
}

// Only ctrl/cmd+wheel zooms (trackpad pinch reports as this too); plain
// wheel/scroll passes through untouched so the note keeps scrolling normally.
function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const rel = relToFrame(event.clientX, event.clientY);
  applyZoom(zoom.value * Math.exp(-event.deltaY * 0.01), rel.x, rel.y);

  isWheelZooming.value = true;
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
  wheelIdleTimer = setTimeout(() => {
    isWheelZooming.value = false;
  }, 200);
}

function touchDist(touches: TouchList): number {
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function touchMid(touches: TouchList): { x: number; y: number } {
  const a = touches[0]!;
  const b = touches[1]!;
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

let lastPinchDist = 0;

function onFrameTouchStart(event: TouchEvent) {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  // A second finger means "pinch," not "draw" — hand off cleanly from
  // whatever the first finger was doing (pending hold or an in-progress
  // stroke; onPointerUp finalizes it exactly like a normal pen-lift).
  onHoldCancel();
  onPointerUp();
  isPinching.value = true;
  lastPinchDist = touchDist(event.touches);
}

function onFrameTouchMove(event: TouchEvent) {
  if (!isPinching.value || event.touches.length !== 2) return;
  event.preventDefault();
  const dist = touchDist(event.touches);
  const mid = touchMid(event.touches);
  const rel = relToFrame(mid.x, mid.y);
  applyZoom(zoom.value * (dist / lastPinchDist), rel.x, rel.y);
  lastPinchDist = dist;
}

function onFrameTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) isPinching.value = false;
}

// Re-clamp if the wrapper is resized (via drag handles or edge-expansion)
// while zoomed, so a shrunk box never leaves the pan drifted out of bounds.
watch([W, H], () => clampPan());

// ─── Container measurement (keeps the wrapper from exceeding its parent) ──
let containerResizeObserver: ResizeObserver | null = null;

function getOuterEditorContainer(): HTMLElement | null {
  if (!canvasRef.value) return null;
  const wrapper = canvasRef.value.closest(".paper-block-wrapper");
  return (wrapper?.parentElement as HTMLElement | null) ?? null;
}

function measureContainerWidth() {
  const outer = getOuterEditorContainer();
  if (outer) {
    containerWidth.value = outer.clientWidth;
  }
}

onMounted(() => {
  loadSwatches();
  color.value = resolveToken("--color-accent-indigo");

  measureContainerWidth();
  const outer = getOuterEditorContainer();
  if (outer) {
    containerResizeObserver = new ResizeObserver(() => measureContainerWidth());
    containerResizeObserver.observe(outer);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onPointerMove);
  window.removeEventListener("mouseup", onPointerUp);
  window.removeEventListener("touchmove", onPointerMove);
  window.removeEventListener("touchend", onPointerUp);
  window.removeEventListener("touchcancel", onPointerUp);
  onHoldCancel();
  onResizeEnd();
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
  containerResizeObserver?.disconnect();
});
</script>

<style>
.paper-block-wrapper {
  margin: 1.25rem 0;
  position: relative;
  display: block;
  box-sizing: border-box;
  max-width: 100%;
  /* border: 1px solid var(--color-secondary); */
  border-radius: var(--radius-xl);
  /* background: var(--color-surface); */
  /* box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.04)); */
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.paper-block-wrapper--resizing {
  transition: none !important;
}

/* ─── Header ───────────────────────────────────────────────────── */
.paper-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  /* background: var(--color-surface-subtle); */
  border-bottom: 1px solid var(--color-secondary);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  user-select: none;
  flex-wrap: wrap;
}

.paper-block-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.paper-block-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Tool buttons */
.paper-tool-group {
  display: flex;
  gap: 2px;
}

/* Zoom controls */
.paper-zoom-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Separator */
.paper-sep {
  width: 1px;
  height: 18px;
  background: var(--color-secondary);
  margin: 0 2px;
  flex-shrink: 0;
}

/* Color */
.paper-color-swatch-wrapper {
  position: relative;
  display: inline-flex;
}

.paper-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-lg);
  border: 2px solid color-mix(in srgb, var(--color-content-on-background) 10%, transparent);
  cursor: pointer;
}

.paper-color-input {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  opacity: 0;
  cursor: pointer;
}

.paper-presets {
  display: flex;
  gap: 2px;
}

.paper-preset-btn {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
  padding: 0;
}

.paper-preset-btn:hover {
  transform: scale(1.2);
}

.paper-preset-btn--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* Range + labels */
.paper-range {
  width: 50px;
  height: 4px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.paper-size-label {
  font-size: 0.6rem;
  font-family: monospace;
  color: var(--color-content-secondary);
  min-width: 24px;
}

.paper-hint {
  font-size: 0.65rem;
  color: var(--color-content-secondary);
  font-style: italic;
}

/* ─── Canvas frame ─────────────────────────────────────────────── */
.paper-canvas-frame {
  position: relative;
  width: 100%;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  overflow: hidden;
}

.paper-canvas-stage {
  transform-origin: 0 0;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.paper-canvas-stage--gesturing {
  transition: none !important;
}

.paper-canvas {
  display: block;
  background: var(--color-background);
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%234f46e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m18 2 4 4-14 14H4v-4L18 2z'/%3E%3Cpath d='m14.5 5.5 3 3'/%3E%3C/svg%3E") 4 20, crosshair;
  /* Inactive: let a vertical swipe scroll the note normally. Active: the
     surface owns the gesture (see .paper-canvas--active below). */
  touch-action: pan-y;
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: width, height;
}

.paper-canvas--resizing {
  transition: none !important;
}

.paper-canvas--active {
  touch-action: none;
}

.paper-canvas--eraser {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23e11d48' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/%3E%3Cpath d='M22 21H7'/%3E%3Cpath d='m5 11 9 9'/%3E%3C/svg%3E") 4 18, pointer;
}

/* Grid backgrounds */
.paper-grid--dots {
  background-image: radial-gradient(circle,
      rgba(0, 0, 0, 0.1) 1px,
      transparent 1px);
  background-size: 20px 20px;
}

.paper-grid--lines {
  background-image: repeating-linear-gradient(0deg,
      transparent,
      transparent 19px,
      rgba(0, 0, 0, 0.06) 20px);
  background-size: 100% 20px;
}

.paper-grid--graph {
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Erasable strokes */
.paper-stroke--erasable {
  cursor: pointer;
  transition: opacity 0.1s;
  pointer-events: stroke;
}

.paper-stroke--erasable:hover {
  opacity: 0.4;
  stroke-dasharray: 6 3;
}

/* Empty hint */
.paper-empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  pointer-events: none;
  color: var(--color-content-disabled);
  font-size: 0.75rem;
  text-align: center;
  padding: 0 1rem;
}



/* Hold-to-draw hint / Done button (top-right of the canvas frame) */
.paper-hold-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-background) 85%, transparent);
  color: var(--color-content-secondary);
  font-size: 0.65rem;
  font-weight: 600;
  pointer-events: none;
  opacity: 0.85;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.paper-hold-hint--pressing {
  opacity: 1;
  transform: scale(1.06);
  color: var(--color-primary);
}

.paper-done-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  box-shadow: var(--shadow-dropdown);
}

/* Live zoom readout (top-left, mirrors the hold-hint's top-right chrome) */
.paper-zoom-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-background) 85%, transparent);
  color: var(--color-content-secondary);
  font-size: 0.65rem;
  font-weight: 600;
  font-family: monospace;
  pointer-events: none;
  opacity: 0.9;
}

/* ─── Dark Mode ────────────────────────────────────────────────── */
.dark .paper-block-header {
  /* background: color-mix(in srgb, var(--color-dark) 10%, black); */
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.dark .paper-canvas {
  /* background: color-mix(in srgb, var(--color-dark) 68%, black); */
}

.dark .paper-grid--dots {
  background-image: radial-gradient(circle,
      rgba(255, 255, 255, 0.08) 1px,
      transparent 1px);
}

.dark .paper-grid--lines {
  background-image: repeating-linear-gradient(0deg,
      transparent,
      transparent 19px,
      rgba(255, 255, 255, 0.05) 20px);
}

.dark .paper-grid--graph {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
}

.dark .paper-color-swatch {
  border-color: rgba(255, 255, 255, 0.15);
}

.dark .paper-block-wrapper {
  border-color: rgba(255, 255, 255, 0.06);
}

/* ─── Resize handles (edges + corners) ────────────────────────────
   Small, edge-hugging hit targets so a scroll swipe landing near the
   border of the sketch doesn't get mistaken for a resize drag. */
.paper-resize-handle {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.paper-block-wrapper:hover .paper-resize-handle,
.paper-block-wrapper--resizing .paper-resize-handle {
  opacity: 1;
  pointer-events: auto;
}

.paper-resize-grip {
  background-color: var(--color-content-disabled);
  border-radius: var(--radius-full);
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.paper-resize-handle:hover .paper-resize-grip,
.paper-resize-handle:active .paper-resize-grip {
  opacity: 1;
}

.paper-resize-handle--n,
.paper-resize-handle--s {
  left: 50%;
  width: 56px;
  height: 4px;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.paper-resize-handle--n {
  top: -6px;
}

.paper-resize-handle--s {
  bottom: -6px;
}

.paper-resize-handle--n .paper-resize-grip,
.paper-resize-handle--s .paper-resize-grip {
  width: 26px;
  height: 4px;
}

.paper-resize-handle--e,
.paper-resize-handle--w {
  top: 50%;
  width: 2px;
  height: 56px;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.paper-resize-handle--e {
  right: -6px;
}

.paper-resize-handle--w {
  left: -6px;
}

.paper-resize-handle--e .paper-resize-grip,
.paper-resize-handle--w .paper-resize-grip {
  width: 3px;
  height: 26px;
}

.paper-resize-handle--ne,
.paper-resize-handle--nw,
.paper-resize-handle--se,
.paper-resize-handle--sw {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--color-content-secondary);
  /* filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)); */
  transition: transform 0.15s ease, color 0.15s ease, filter 0.15s ease;
  opacity: 0.1
}

.paper-resize-handle--ne:hover,
.paper-resize-handle--nw:hover,
.paper-resize-handle--se:hover,
.paper-resize-handle--sw:hover,
.paper-resize-handle--ne:active,
.paper-resize-handle--nw:active,
.paper-resize-handle--se:active,
.paper-resize-handle--sw:active {
  color: var(--color-primary);
  transform: scale(1.25);
  filter: drop-shadow(0 2px 5px color-mix(in srgb, var(--color-primary) 50%, transparent));
}

.paper-resize-handle--ne {
  top: -8px;
  right: -8px;
  cursor: nesw-resize;
}

.paper-resize-handle--nw {
  top: -8px;
  left: -8px;
  cursor: nwse-resize;
}

.paper-resize-handle--se {
  bottom: -8px;
  right: -8px;
  cursor: nwse-resize;
}

.paper-resize-handle--sw {
  bottom: -8px;
  left: -8px;
  cursor: nesw-resize;
}

.paper-resize-icon {
  width: 16px;
  height: 16px;
  pointer-events: none;
}

.dark .paper-resize-grip {
  background-color: rgba(255, 255, 255, 0.25);
}

.dark .paper-resize-handle--ne,
.dark .paper-resize-handle--nw,
.dark .paper-resize-handle--se,
.dark .paper-resize-handle--sw {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.dark .paper-resize-handle--ne:hover,
.dark .paper-resize-handle--nw:hover,
.dark .paper-resize-handle--se:hover,
.dark .paper-resize-handle--sw:hover {
  color: var(--color-primary);
}
</style>
