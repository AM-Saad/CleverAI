<template>
  <NodeViewWrapper class="paper-block-wrapper" data-type="paper">
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
          <div class="paper-presets">
            <!-- design-allow: 14px color-swatch selectors, no shared style contract with Ui* buttons applies at this scale -->
            <button v-for="c in presetColors" :key="c" type="button" class="paper-preset-btn"
              :class="{ 'paper-preset-btn--active': color === c }" :style="{ backgroundColor: c }"
              :aria-label="`Use color ${c}`" :aria-pressed="color === c" @click="color = c" />
          </div>

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

        <!-- Download PNG -->
        <UiToolbarButton icon="i-lucide-download" label="Export as PNG" @click="exportPng" />

        <span class="paper-sep" />

        <!-- Clear -->
        <UiToolbarButton icon="i-lucide-eraser" label="Clear all" @click="clearDrawing" />
        <!-- Delete block -->
        <UiToolbarButton icon="i-lucide-trash-2" label="Delete sketch" tone="error" @click="props.deleteNode()" />
      </div>
    </div>

    <!-- Drawing surface -->
    <svg ref="canvasRef" class="paper-canvas" :style="{ height: `${H}px` }" :class="[
      `paper-grid--${gridType}`,
      activeTool === 'eraser' ? 'paper-canvas--eraser' : '',
    ]" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" @mousedown="onPointerDown" @mouseup="onPointerUp"
      @mouseleave="onPointerUp" @touchstart.prevent="onPointerDown" @touchend="onPointerUp" @touchcancel="onPointerUp">
      <!-- Existing strokes (clickable for eraser) -->
      <path v-for="line in currentLines" :key="line.id" :d="line.path" :stroke="line.color" :stroke-width="line.size"
        fill="none" stroke-linecap="round" stroke-linejoin="round"
        :class="{ 'paper-stroke--erasable': activeTool === 'eraser' }" @click="eraseLine(line.id)" />
      <!-- Active stroke preview -->
      <path v-if="activePath" :d="activePath" :stroke="color" :stroke-width="size" fill="none" stroke-linecap="round"
        stroke-linejoin="round" opacity="0.7" />
    </svg>

    <!-- Empty hint -->
    <div v-if="!currentLines.length && !isDrawing" class="paper-empty-hint" contenteditable="false">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
        <path d="m12 19 7-7 3 3-7 7-3-3z" />
        <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="m2 2 7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
      <span>Click and drag to sketch</span>
    </div>

    <!-- Resize handle -->
    <div class="paper-resize-handle" @mousedown="onResizeStart" @touchstart.prevent="onResizeStart">
      <div class="paper-resize-grip" />
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import {
  designTokenValues,
  type DesignTokenName,
} from "~/design-system/tokens.generated";
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

const props = defineProps(nodeViewProps);

// ─── Constants ──────────────────────────────────────────────────
const W = 600;
const H = computed(() => props.node.attrs.height ?? 280);

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

function svgCoords(event: MouseEvent | TouchEvent): [number, number] | null {
  if (!canvasRef.value) return null;
  const rect = canvasRef.value.getBoundingClientRect();
  const cx =
    "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
  const cy =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  return [
    ((cx - rect.left) / rect.width) * W,
    ((cy - rect.top) / rect.height) * H.value,
  ];
}

function onPointerDown(event: MouseEvent | TouchEvent) {
  if (activeTool.value !== "pen") return;
  isDrawing.value = true;
  points = [];
  currentId = crypto.randomUUID();
  const pos = svgCoords(event);
  if (pos) points.push(pos);
  canvasRef.value?.addEventListener("mousemove", onPointerMove);
  canvasRef.value?.addEventListener("touchmove", onPointerMove, {
    passive: false,
  });
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
  }
}

function onPointerUp() {
  if (!isDrawing.value) return;
  isDrawing.value = false;
  activePath.value = null;
  canvasRef.value?.removeEventListener("mousemove", onPointerMove);
  canvasRef.value?.removeEventListener("touchmove", onPointerMove);

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

// ─── Eraser ─────────────────────────────────────────────────────
function eraseLine(id: string) {
  if (activeTool.value !== "eraser") return;
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
    canvas.width = W * 2;
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

// ─── Resizing Canvas height ──────────────────────────────────────
let dragStartY = 0;
let dragStartHeight = 280;

function onResizeStart(event: MouseEvent | TouchEvent) {
  dragStartY =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  dragStartHeight = props.node.attrs.height ?? 280;

  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
  window.addEventListener("touchmove", onResizeMove, { passive: false });
  window.addEventListener("touchend", onResizeEnd);
}

function onResizeMove(event: MouseEvent | TouchEvent) {
  const cy =
    "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
  const diffY = cy - dragStartY;
  const newHeight = Math.max(150, Math.min(600, dragStartHeight + diffY));
  props.updateAttributes({ height: newHeight });
}

function onResizeEnd() {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
  window.removeEventListener("touchmove", onResizeMove);
  window.removeEventListener("touchend", onResizeEnd);
}

onMounted(() => {
  loadSwatches();
  color.value = resolveToken("--color-accent-indigo");
});

onBeforeUnmount(() => {
  canvasRef.value?.removeEventListener("mousemove", onPointerMove);
  canvasRef.value?.removeEventListener("touchmove", onPointerMove);
  onResizeEnd();
});
</script>

<style>
.paper-block-wrapper {
  margin: 1.25rem 0;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  /* border: 1px solid var(--color-secondary, rgba(0,0,0,0.08)); */
  /* box-shadow: 0 2px 8px rgba(0,0,0,0.06); */
  /* transition: box-shadow 0.2s ease; */
  position: relative;
}

/* .paper-block-wrapper:hover {
  box-shadow: var(--shadow-dropdown);
} */

/* ─── Header ───────────────────────────────────────────────────── */
.paper-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0rem;
  /* background: var(--color-surface-subtle); */
  border-bottom: 1px solid var(--color-secondary);
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

/* ─── Canvas ───────────────────────────────────────────────────── */
.paper-canvas {
  display: block;
  width: 100%;
  background: var(--color-background);
  cursor: crosshair;
  touch-action: none;
  min-height: 180px;
}

.paper-canvas--eraser {
  cursor: pointer;
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
  top: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  pointer-events: none;
  color: var(--color-content-disabled);
  font-size: 0.75rem;
}

/* ─── Dark Mode ────────────────────────────────────────────────── */
.dark .paper-block-header {
  background: color-mix(in srgb, var(--color-dark) 80%, black);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.dark .paper-canvas {
  background: color-mix(in srgb, var(--color-dark) 68%, black);
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

/* Resize handle styling */
.paper-resize-handle {
  height: 9px;
  background: var(--color-surface-subtle);
  border-top: 1px solid var(--color-secondary);
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition: background 0.15s ease;
}

.paper-resize-handle:hover {
  background: var(--color-surface-strong, rgba(0, 0, 0, 0.05));
}

.paper-resize-grip {
  width: 24px;
  height: 3px;
  border-radius: 1.5px;
  background-color: var(--color-content-disabled);
}

.dark .paper-resize-handle {
  background: color-mix(in srgb, var(--color-dark) 80%, black);
  border-top-color: rgba(255, 255, 255, 0.06);
}

.dark .paper-resize-handle:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dark .paper-resize-grip {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
