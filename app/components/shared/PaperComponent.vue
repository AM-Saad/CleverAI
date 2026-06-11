<template>
  <NodeViewWrapper class="paper-block-wrapper" data-type="paper">
    <!-- Header bar -->
    <div class="paper-block-header" contenteditable="false">
      <div class="paper-block-controls">
        <!-- Tool selector -->
        <div class="paper-tool-group">
          <button v-for="t in tools" :key="t.id" type="button" class="paper-tool-btn"
            :class="{ 'paper-tool-btn--active': activeTool === t.id }" :title="t.label" @click="activeTool = t.id">
            <span class="paper-tool-icon" v-html="t.svg" />
          </button>
        </div>

        <span class="paper-sep" />

        <!-- Color (only for pen) -->
        <template v-if="activeTool === 'pen'">
          <div class="paper-color-swatch-wrapper">
            <span class="paper-color-swatch" :style="{ backgroundColor: color }" />
            <input type="color" v-model="color" class="paper-color-input" title="Stroke color" />
          </div>
          <div class="paper-presets">
            <button v-for="c in presetColors" :key="c" type="button" class="paper-preset-btn"
              :class="{ 'paper-preset-btn--active': color === c }" :style="{ backgroundColor: c }" @click="color = c" />
          </div>

          <span class="paper-sep" />

          <input type="range" min="1" max="12" v-model.number="size" class="paper-range" title="Stroke width" />
          <span class="paper-size-label">{{ size }}px</span>
        </template>

        <template v-if="activeTool === 'eraser'">
          <span class="paper-hint">Click a stroke to erase it</span>
        </template>
      </div>

      <div class="paper-block-actions">
        <!-- Undo / Redo -->
        <button type="button" class="paper-action-btn" title="Undo (⌘Z)" :disabled="!canUndo" @click="undo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        <button type="button" class="paper-action-btn" title="Redo (⌘⇧Z)" :disabled="!canRedo" @click="redo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </button>

        <span class="paper-sep" />

        <!-- Grid toggle -->
        <button type="button" class="paper-action-btn" :class="{ 'paper-action-btn--toggled': gridType !== 'none' }"
          title="Toggle grid" @click="cycleGrid">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>

        <!-- Download PNG -->
        <button type="button" class="paper-action-btn" title="Export as PNG" @click="exportPng">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <span class="paper-sep" />

        <!-- Clear -->
        <button type="button" class="paper-action-btn" title="Clear all" @click="clearDrawing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
        <!-- Delete block -->
        <button type="button" class="paper-action-btn paper-action-btn--danger" title="Delete sketch"
          @click="props.deleteNode()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Drawing surface -->
    <svg ref="canvasRef" class="paper-canvas" :style="{ height: `${H}px` }"
      :class="[`paper-grid--${gridType}`, activeTool === 'eraser' ? 'paper-canvas--eraser' : '']"
      :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" @mousedown="onPointerDown" @mouseup="onPointerUp"
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
import { ref, computed, onBeforeUnmount } from "vue";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
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
const presetColors = ["#6366f1", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#1e293b"];

const tools = [
  { id: "pen" as Tool, label: "Pen", svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>' },
  { id: "eraser" as Tool, label: "Eraser", svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>' },
];

// ─── State ──────────────────────────────────────────────────────
const activeTool = ref<Tool>("pen");
const color = ref("#6366f1");
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
  const cx = "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
  const cy = "touches" in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
  return [((cx - rect.left) / rect.width) * W, ((cy - rect.top) / rect.height) * H.value];
}

function onPointerDown(event: MouseEvent | TouchEvent) {
  if (activeTool.value !== "pen") return;
  isDrawing.value = true;
  points = [];
  currentId = crypto.randomUUID();
  const pos = svgCoords(event);
  if (pos) points.push(pos);
  canvasRef.value?.addEventListener("mousemove", onPointerMove);
  canvasRef.value?.addEventListener("touchmove", onPointerMove, { passive: false });
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
    lines: [...currentLines.value, { id: currentId, color: color.value, size: size.value, path: pathStr }],
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
  props.updateAttributes({ lines: currentLines.value.filter((l: StrokeLine) => l.id !== id) });
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
    ctx.fillStyle = "#ffffff";
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
  dragStartY = "touches" in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
  dragStartHeight = props.node.attrs.height ?? 280;
  
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
  window.addEventListener("touchmove", onResizeMove, { passive: false });
  window.addEventListener("touchend", onResizeEnd);
}

function onResizeMove(event: MouseEvent | TouchEvent) {
  const cy = "touches" in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
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

onBeforeUnmount(() => {
  canvasRef.value?.removeEventListener("mousemove", onPointerMove);
  canvasRef.value?.removeEventListener("touchmove", onPointerMove);
  onResizeEnd();
});
</script>

<style>
.paper-block-wrapper {
  margin: 1.25rem 0;
  border-radius: 0.75rem;
  overflow: hidden;
  /* border: 1px solid var(--color-border-secondary, rgba(0,0,0,0.08)); */
  /* box-shadow: 0 2px 8px rgba(0,0,0,0.06); */
  /* transition: box-shadow 0.2s ease; */
  position: relative;
}

.paper-block-wrapper:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* ─── Header ───────────────────────────────────────────────────── */
.paper-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: var(--color-surface-subtle, #f8fafc);
  border-bottom: 1px solid var(--color-border-secondary, rgba(0, 0, 0, 0.06));
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

.paper-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-content-secondary, #64748b);
  cursor: pointer;
  transition: all 0.12s ease;
}

.paper-tool-btn:hover {
  background: var(--color-surface-strong, rgba(0, 0, 0, 0.05));
  color: var(--color-content-on-surface, #1e293b);
}

.paper-tool-btn--active {
  background: var(--color-primary, #6366f1) !important;
  color: #fff !important;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.3);
}

.paper-tool-icon {
  display: flex;
  align-items: center;
}

/* Separator */
.paper-sep {
  width: 1px;
  height: 18px;
  background: var(--color-border-secondary, rgba(0, 0, 0, 0.08));
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
  border-radius: 5px;
  border: 2px solid rgba(0, 0, 0, 0.1);
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
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* Range + labels */
.paper-range {
  width: 50px;
  height: 4px;
  accent-color: var(--color-primary, #6366f1);
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

/* Action buttons */
.paper-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--color-content-secondary, #64748b);
  cursor: pointer;
  transition: all 0.12s;
}

.paper-action-btn:hover {
  background: var(--color-surface-strong, rgba(0, 0, 0, 0.05));
  color: var(--color-content-on-surface);
}

.paper-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.paper-action-btn--toggled {
  color: var(--color-primary, #6366f1);
}

.paper-action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* ─── Canvas ───────────────────────────────────────────────────── */
.paper-canvas {
  display: block;
  width: 100%;
  background: var(--color-background, #fff);
  cursor: crosshair;
  touch-action: none;
  min-height: 180px;
}

.paper-canvas--eraser {
  cursor: pointer;
}

/* Grid backgrounds */
.paper-grid--dots {
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

.paper-grid--lines {
  background-image: repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0, 0, 0, 0.06) 20px);
  background-size: 100% 20px;
}

.paper-grid--graph {
  background-image: linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
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
  color: var(--color-content-disabled, #94a3b8);
  font-size: 0.75rem;
}

/* ─── Dark Mode ────────────────────────────────────────────────── */
.dark .paper-block-header {
  background: #1e2030;
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.dark .paper-canvas {
  background: #191b28;
}

.dark .paper-grid--dots {
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
}

.dark .paper-grid--lines {
  background-image: repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255, 255, 255, 0.05) 20px);
}

.dark .paper-grid--graph {
  background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
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
  background: var(--color-surface-subtle, #f8fafc);
  border-top: 1px solid var(--color-border-secondary, rgba(0, 0, 0, 0.06));
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
  background-color: var(--color-content-disabled, #cbd5e1);
}

.dark .paper-resize-handle {
  background: #1e2030;
  border-top-color: rgba(255, 255, 255, 0.06);
}

.dark .paper-resize-handle:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dark .paper-resize-grip {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>