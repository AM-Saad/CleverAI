<script setup lang="ts">
import CanvasNoteToolbar from "./CanvasNoteToolbar.vue";
import { useCanvasHistory } from "~/composables/ui/useCanvasHistory";
import { useCanvasStageInteractions, type CanvasTool } from "~/composables/ui/useCanvasStageInteractions";
import { useCanvasViewport } from "~/composables/ui/useCanvasViewport";
import type { CanvasShape, CanvasNoteMetadata } from "@@/shared/utils/note.contract";
import {
  clampNumber,
  type BoundsRect,
} from "~/utils/canvas/geometry";

/**
 * CanvasNoteEditor — Full-featured Konva canvas editor.
 *
 * FEATURES:
 *  - Infinite Canvas (Pan tool & Mouse Wheel Zoom)
 *  - Fullscreen support
 *  - Add shapes: Rect, Circle, Line, Arrow, Text, Free Draw, Star
 *  - Dynamic Styling: Fill color, Border color, Border width, Border style (dash) for selected items
 *  - Drag & drop (all shapes draggable by default)
 *  - Transformer (resize + rotate handles)
 *  - Undo / Redo (Cmd+Z / Cmd+Shift+Z)
 *  - Z-index via context menu (Bring to Front / Send to Back etc.)
 *  - Keyboard shortcuts protected (ignores if editing input/text)
 */

const props = defineProps<{
  noteId: string;
  initialMetadata?: CanvasNoteMetadata;
  isFullscreen?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", metadata: CanvasNoteMetadata): void;
  (e: "toggle-fullscreen"): void;
  (e: "delete"): void;
}>();

const DEFAULT_WORLD_BOUNDS: BoundsRect = {
  left: -600,
  top: -400,
  right: 1600,
  bottom: 1200,
};
const WORLD_MIN_WIDTH = 2200;
const WORLD_MIN_HEIGHT = 1600;
const CONTENT_EDGE_PADDING = 160;
const WORLD_PADDING = 320;
const VIEWPORT_FIT_RATIO = 0.78;
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 112;
const STROKE_WIDTH_MIN = 0.5;
const STROKE_WIDTH_MAX = 32;
const SNAP_THRESHOLD_PX = 10;
const SNAP_GUIDE_PADDING = 48;

// ── State ──
// Use JSON.parse(JSON.stringify) to strip Vue proxies to prevent DataCloneError on structuredClone
const shapes = shallowRef<CanvasShape[]>(
  JSON.parse(JSON.stringify(props.initialMetadata?.shapes ?? []))
);
const fillColor = ref("#3b82f6");
const strokeColor = ref("#1e293b");
const strokeWidthState = ref(2);
const strokeDashState = ref<number[] | undefined>(undefined);
const strokeWidthInput = ref(String(strokeWidthState.value));

// ── Stage Viewport (Infinite Canvas) ──
// ── Refs ──
const stageRef = ref<any>(null);
const transformerRef = ref<any>(null);
const isCanvasFocused = ref(false);
const isAspectRatioLocked = ref(false);

// ── History ──
const { canUndo, canRedo, pushState, undo, redo } = useCanvasHistory(
  props.initialMetadata?.shapes ?? []
);

// ── Auto-save ──
const SAVE_TIMEOUT_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const {
  containerRef,
  constrainStageDrag,
  constrainStagePosition,
  focusCanvasHome,
  handleMinimapDrag,
  handleMinimapPointer,
  isMinimapCollapsed,
  minimapRef,
  minimapShapes,
  minimapViewport,
  stagePosition,
  stageScale,
  stageSize,
  toggleMinimap,
} = useCanvasViewport({
  shapes,
  isFullscreen: toRef(props, "isFullscreen"),
  defaultWorldBounds: DEFAULT_WORLD_BOUNDS,
  worldMinWidth: WORLD_MIN_WIDTH,
  worldMinHeight: WORLD_MIN_HEIGHT,
  contentEdgePadding: CONTENT_EDGE_PADDING,
  worldPadding: WORLD_PADDING,
  viewportFitRatio: VIEWPORT_FIT_RATIO,
  minimapWidth: MINIMAP_WIDTH,
  minimapHeight: MINIMAP_HEIGHT,
});

const {
  activeTool,
  bringForward,
  bringToFront,
  closeContextMenu,
  contextMenu,
  deleteSelected,
  duplicateShape,
  handleContextMenu,
  handleDblClick,
  handleShapeDragStart,
  handleShapeDragEnd,
  handleShapeDragMove,
  handleStageDragEnd,
  handleStageMouseDown,
  handleStageMouseMove,
  handleStageMouseUp,
  handleStageWheel,
  handleTransformEnd,
  inputMode,
  selectTool,
  selectedShapeIds,
  selectedShapeId,
  selectionRect,
  sendBackward,
  sendToBack,
  snapEnabled,
  snapGuides,
  clearSelection,
  updateTransformer,
} = useCanvasStageInteractions({
  shapes,
  fillColor,
  strokeColor,
  strokeWidth: strokeWidthState,
  strokeDash: strokeDashState,
  stageScale,
  stagePosition,
  constrainStagePosition,
  transformerRef,
  commitState,
  snapThresholdPx: SNAP_THRESHOLD_PX,
  snapGuidePadding: SNAP_GUIDE_PADDING,
});

function scheduleAutoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    emit("update", { shapes: JSON.parse(JSON.stringify(shapes.value)) });
  }, SAVE_TIMEOUT_MS);
}

function commitState() {
  pushState(JSON.parse(JSON.stringify(shapes.value)));
  scheduleAutoSave();
}

// ── Apply Style to Selected ──
function applyToSelected(overrides: Partial<CanvasShape>) {
  if (!selectedShapeIds.value.length) return;

  let didUpdate = false;
  for (const shapeId of selectedShapeIds.value) {
    const shape = shapes.value.find((candidate) => candidate.id === shapeId);
    if (!shape) continue;

    Object.assign(shape, overrides);
    didUpdate = true;
  }

  if (!didUpdate) return;

  triggerRef(shapes);
  commitState();
}

function setFillColor(c: string) {
  fillColor.value = c;
  applyToSelected({ fill: c });
}

function setStrokeColor(c: string) {
  strokeColor.value = c;
  applyToSelected({ stroke: c });
}

function setStrokeWidth(w: number) {
  strokeWidthState.value = w;
  applyToSelected({ strokeWidth: w });
}

function setStrokeDash(d: number[] | undefined) {
  strokeDashState.value = d;
  applyToSelected({ dash: d });
}

function syncStrokeWidthInput(value = strokeWidthState.value) {
  strokeWidthInput.value = String(value);
}

function applyStrokeWidthInput() {
  const parsed = Number(strokeWidthInput.value);
  if (!Number.isFinite(parsed)) {
    syncStrokeWidthInput();
    return;
  }

  const next = Math.round(clampNumber(parsed, STROKE_WIDTH_MIN, STROKE_WIDTH_MAX) * 10) / 10;
  setStrokeWidth(next);
}

watch(strokeWidthState, (value) => {
  syncStrokeWidthInput(value);
}, { immediate: true });

const selectedShapes = computed(() => shapes.value.filter((shape) => selectedShapeIds.value.includes(shape.id)));
const transformerEnabledAnchors = computed(() => {
  const singleSelectedShape = selectedShapes.value.length === 1 ? selectedShapes.value[0] : null;
  if (!singleSelectedShape) {
    return [
      "top-left",
      "top-center",
      "top-right",
      "middle-right",
      "bottom-right",
      "bottom-center",
      "bottom-left",
      "middle-left",
    ];
  }

  switch (singleSelectedShape.type) {
    case "circle":
    case "star":
    case "text":
      return ["top-left", "top-right", "bottom-right", "bottom-left"];
    default:
      return [
        "top-left",
        "top-center",
        "top-right",
        "middle-right",
        "bottom-right",
        "bottom-center",
        "bottom-left",
        "middle-left",
      ];
  }
});

const keepAspectRatio = computed(() => {
  if (isAspectRatioLocked.value) {
    return true;
  }

  if (selectedShapes.value.length !== 1) {
    return false;
  }

  return ["circle", "star", "text"].includes(selectedShapes.value[0]!.type);
});

// ── Undo / Redo ──
function handleUndo() {
  const state = undo();
  if (state) {
    shapes.value = state;
    clearSelection();
    updateTransformer();
    scheduleAutoSave();
  }
}

function handleRedo() {
  const state = redo();
  if (state) {
    shapes.value = state;
    clearSelection();
    updateTransformer();
    scheduleAutoSave();
  }
}

function focusCanvasSurface() {
  containerRef.value?.el?.focus({ preventScroll: true });
}

function handleCanvasFocus() {
  isCanvasFocused.value = true;
}

function handleCanvasBlur(event: FocusEvent) {
  const nextTarget = event.relatedTarget as Node | null;
  if (containerRef.value?.el?.contains(nextTarget)) {
    return;
  }

  isCanvasFocused.value = false;
  isAspectRatioLocked.value = false;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

function handleCanvasKeydown(event: KeyboardEvent) {
  if (!isCanvasFocused.value || isEditableTarget(event.target)) {
    return;
  }

  if (event.key === "Shift") {
    isAspectRatioLocked.value = true;
    return;
  }

  const key = event.key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      handleRedo();
    } else {
      handleUndo();
    }
    return;
  }

  if ((event.metaKey || event.ctrlKey) && key === "d") {
    event.preventDefault();
    duplicateShape();
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (key === "delete" || key === "backspace") {
    if (selectedShapeIds.value.length) {
      event.preventDefault();
      deleteSelected();
    }
    return;
  }

  if (key === "escape") {
    event.preventDefault();
    clearSelection();
    activeTool.value = "select";
    updateTransformer();
    closeContextMenu();
    return;
  }

  const toolShortcuts: Record<string, CanvasTool> = {
    v: "select",
    h: "hand",
    r: "rect",
    c: "circle",
    e: "ellipse",
    l: "line",
    a: "arrow",
    t: "text",
    p: "freedraw",
    s: "star",
  };

  const nextTool = toolShortcuts[key];
  if (!nextTool) {
    return;
  }

  event.preventDefault();
  selectTool(nextTool);
}

function handleCanvasKeyup(event: KeyboardEvent) {
  if (event.key === "Shift") {
    isAspectRatioLocked.value = false;
  }
}

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer);
});

// ── Helpers ──
function getShapeConfig(shape: CanvasShape): Record<string, any> {
  const base: Record<string, any> = {
    id: shape.id,
    name: shape.id,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    scaleX: shape.scaleX,
    scaleY: shape.scaleY,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    dash: shape.dash,
    opacity: shape.opacity,
    draggable:
      activeTool.value === "select"
      && shape.draggable
      && (inputMode.value !== "touch" || selectedShapeIds.value.includes(shape.id)),
  };

  switch (shape.type) {
    case "rect":
      base.width = shape.width;
      base.height = shape.height;
      break;
    case "circle":
      base.radius = shape.radius;
      break;
    case "ellipse":
      base.radiusX = shape.radiusX;
      base.radiusY = shape.radiusY;
      break;
    case "line":
    case "freedraw":
      base.points = shape.points;
      base.tension = shape.tension ?? 0;
      base.closed = shape.closed ?? false;
      base.lineCap = "round";
      base.lineJoin = "round";
      break;
    case "arrow":
      base.points = shape.points;
      base.pointerLength = 10;
      base.pointerWidth = 10;
      break;
    case "text":
      base.text = shape.text;
      base.fontSize = shape.fontSize;
      base.fontFamily = shape.fontFamily || "Inter, system-ui, sans-serif";
      break;
    case "star":
      base.numPoints = shape.numPoints;
      base.innerRadius = shape.innerRadius;
      base.outerRadius = shape.outerRadius;
      break;
  }

  return base;
}

const stageConfig = computed(() => ({
  width: stageSize.value.width,
  height: stageSize.value.height,
  scaleX: stageScale.value,
  scaleY: stageScale.value,
  x: stagePosition.value.x,
  y: stagePosition.value.y,
  draggable: activeTool.value === "hand",
  dragBoundFunc: constrainStageDrag,
}));

const transformerConfig = computed(() => ({
  rotateEnabled: true,
  flipEnabled: false,
  shiftBehavior: "none",
  keepRatio: keepAspectRatio.value,
  enabledAnchors: transformerEnabledAnchors.value,
  ignoreStroke: true,
  padding: 8,
  anchorSize: 10,
  borderStroke: "#384998",
  anchorFill: "#ffffff",
  anchorStroke: "#384998",
  anchorStrokeWidth: 1.25,
  boundBoxFunc: (oldBox: { width: number; height: number }, newBox: { width: number; height: number }) => {
    if (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12) {
      return oldBox;
    }

    return newBox;
  },
}));

function konvaComponent(type: CanvasShape["type"]): string {
  switch (type) {
    case "rect": return "v-rect";
    case "circle": return "v-circle";
    case "ellipse": return "v-ellipse";
    case "line":
    case "freedraw": return "v-line";
    case "arrow": return "v-arrow";
    case "text": return "v-text";
    case "star": return "v-star";
    default: return "v-rect";
  }
}

const interactionHint = computed(() => {
  if (inputMode.value === "touch") {
    return "Touch: tap once to select, then drag the selected shape";
  }

  if (activeTool.value === "select") {
    return "Drag on empty space to box-select | Hold Shift while resizing to lock aspect";
  }

  return "Hand mode pans | Snap guides align nearby shapes";
});

</script>

<template>
  <div class="canvas-note-editor flex flex-col gap-2 h-full w-full" @click="closeContextMenu">
    <CanvasNoteToolbar :is-fullscreen="isFullscreen" :snap-enabled="snapEnabled" :active-tool="activeTool"
      :fill-color="fillColor" :stroke-color="strokeColor" :stroke-width="strokeWidthState"
      v-model:stroke-width-input="strokeWidthInput" :stroke-width-min="STROKE_WIDTH_MIN"
      :stroke-width-max="STROKE_WIDTH_MAX" :can-undo="canUndo" :can-redo="canRedo"
      :has-selection="selectedShapeIds.length > 0" @toggle-fullscreen="emit('toggle-fullscreen')"
      @delete-note="emit('delete')" @toggle-snap="snapEnabled = !snapEnabled" @focus-canvas-home="focusCanvasHome"
      @select-tool="selectTool" @set-fill-color="setFillColor" @set-stroke-color="setStrokeColor"
      @apply-stroke-width-input="applyStrokeWidthInput" @set-border-style="setStrokeDash" @undo="handleUndo"
      @redo="handleRedo" @delete-selected="deleteSelected" @duplicate-selection="duplicateShape" />

    <!-- Konva Stage Space -->
    <SharedNoteContentArea ref="containerRef" class="min-h-[400px] cursor-crosshair" tabindex="0" role="application"
      aria-label="Canvas editor" :class="{ 'cursor-grab': activeTool === 'hand' }"
      @pointerdown.capture="focusCanvasSurface" @focus="handleCanvasFocus" @blur="handleCanvasBlur"
      @keydown="handleCanvasKeydown" @keyup="handleCanvasKeyup">
      <ClientOnly>
        <v-stage ref="stageRef" :config="stageConfig" @mousedown="handleStageMouseDown"
          @touchstart="handleStageMouseDown" @mousemove="handleStageMouseMove" @touchmove="handleStageMouseMove"
          @mouseup="handleStageMouseUp" @touchend="handleStageMouseUp" @wheel="handleStageWheel"
          @dragend="handleStageDragEnd">
          <v-layer>
            <component v-for="shape in shapes" :is="konvaComponent(shape.type)" :key="shape.id"
              :config="getShapeConfig(shape)" @dragstart="handleShapeDragStart" @dragmove="handleShapeDragMove"
              @dragend="handleShapeDragEnd" @transformend="handleTransformEnd" @contextmenu="handleContextMenu"
              @dblclick="handleDblClick" />
          </v-layer>

          <v-layer :config="{ listening: false }">
            <v-line v-for="guide in snapGuides" :key="guide.id"
              :config="{ points: guide.points, stroke: '#384998', strokeWidth: 1, dash: [6, 4], listening: false }" />
            <v-rect v-if="selectionRect.visible" :config="{
              x: selectionRect.x,
              y: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
              fill: 'rgba(56, 73, 152, 0.12)',
              stroke: '#384998',
              strokeWidth: 1,
              dash: [4, 4],
              listening: false,
            }" />
          </v-layer>

          <v-layer>
            <v-transformer ref="transformerRef" :config="transformerConfig" />
          </v-layer>
        </v-stage>
      </ClientOnly>

      <!-- Zoom map / info corner -->
      <div
        class="absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded-[var(--radius-md)] text-xs font-medium text-content-on-surface pointer-events-none select-none backdrop-blur-sm">
        {{ Math.round(stageScale * 100) }}% | {{ interactionHint }}
      </div>

      <button v-if="isMinimapCollapsed" type="button"
        class="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-[var(--radius-lg)] border border-secondary bg-surface/95 px-2 py-1.5 text-xs font-medium text-content-on-surface shadow-lg backdrop-blur-sm"
        @click.stop="toggleMinimap">
        <UIcon name="i-lucide-map" class="w-3.5 h-3.5" />
        <span>Map</span>
      </button>

      <div v-else ref="minimapRef"
        class="absolute bottom-2 right-2 z-10 rounded-[var(--radius-xl)] border border-secondary bg-surface/95 p-2 shadow-lg backdrop-blur-sm"
        @pointerdown.prevent="handleMinimapPointer" @pointermove.prevent="handleMinimapDrag">
        <div
          class="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-content-secondary">
          <span>Minimap</span>
          <div class="flex items-center gap-1">
            <button type="button" class="text-primary hover:text-primary/80" @pointerdown.stop
              @click.stop="focusCanvasHome">
              Focus
            </button>
            <button type="button" class="text-content-secondary hover:text-content-on-surface"
              aria-label="Minimize minimap" @pointerdown.stop @click.stop="toggleMinimap">
              <UIcon name="i-lucide-minus" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="relative overflow-hidden rounded-[var(--radius-lg)] border border-secondary/70 bg-background"
          :style="{
            width: `${MINIMAP_WIDTH}px`,
            height: `${MINIMAP_HEIGHT}px`,
            backgroundImage: 'linear-gradient(to right, color-mix(in srgb, var(--color-secondary) 65%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-secondary) 65%, transparent) 1px, transparent 1px)',
            backgroundSize: '16px 16px'
          }">
          <div class="absolute inset-0 rounded-[inherit] border border-primary/10" />

          <div v-for="(shape, index) in minimapShapes" :key="`minimap-${index}`"
            class="absolute rounded-[var(--radius-sm)]" :style="{
              left: `${shape.left}px`,
              top: `${shape.top}px`,
              width: `${shape.width}px`,
              height: `${shape.height}px`,
              backgroundColor: shape.outlined ? 'transparent' : shape.color,
              border: `1px solid ${shape.color}`,
              opacity: shape.outlined ? 0.9 : 0.65
            }" />

          <div class="absolute rounded-[var(--radius-sm)] border-2 border-primary bg-primary/10 shadow-sm" :style="{
            left: `${minimapViewport.left}px`,
            top: `${minimapViewport.top}px`,
            width: `${minimapViewport.width}px`,
            height: `${minimapViewport.height}px`
          }" />
        </div>
      </div>
    </SharedNoteContentArea>

    <!-- Context Menu (teleported to body) -->
    <Teleport to="body">
      <div v-if="contextMenu.visible"
        class="fixed z-[9999] min-w-[160px] rounded-[var(--radius-xl)] border border-secondary bg-surface shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-content-on-surface hover:bg-surface-subtle"
          @click="bringToFront">
          <UIcon name="i-heroicons-arrow-up" class="w-4 h-4" /> Bring to Front
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-content-on-surface hover:bg-surface-subtle"
          @click="bringForward">
          <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" /> Bring Forward
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-content-on-surface hover:bg-surface-subtle"
          @click="sendBackward">
          <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" /> Send Backward
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-content-on-surface hover:bg-surface-subtle"
          @click="sendToBack">
          <UIcon name="i-heroicons-arrow-down" class="w-4 h-4" /> Send to Back
        </button>
        <div class="my-1 h-px bg-secondary" />
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-content-on-surface hover:bg-surface-subtle"
          @click="duplicateShape">
          <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" /> Duplicate
        </button>
        <button class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error hover:bg-error/10"
          @click="deleteSelected">
          <UIcon name="i-heroicons-trash" class="w-4 h-4" /> Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>
