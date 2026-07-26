<template>
  <NodeViewWrapper
    class="paper"
    :class="{
      'paper--active': isActive,
      'paper--resizing': isResizing,
      'paper--compact': isCompact,
    }"
    :style="{ width: `${W}px`, marginLeft: xOffset ? `${xOffset}px` : undefined }"
    data-type="paper"
    @pointerenter="isHovered = true"
    @pointerleave="isHovered = false"
  >
    <!-- Viewport. Fixed box; the camera decides which part of the unbounded
         world it shows. Its size never affects stroke coordinates. -->
    <div
      ref="frameRef"
      class="paper-frame"
      tabindex="-1"
      role="application"
      aria-label="Sketch canvas"
      :style="{ height: `${H}px`, cursor: frameCursor }"
      @keydown="onFrameKeydown"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerenter="refreshFrameRect"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
      @dblclick="onDoubleClick"
      @contextmenu="onContextMenu"
    >
      <svg class="paper-canvas" shape-rendering="geometricPrecision">
        <defs>
          <pattern
            :id="gridId"
            ref="gridPatternRef"
            :width="gridStep"
            :height="gridStep"
            patternUnits="userSpaceOnUse"
          >
            <circle
              v-if="gridType === 'dots'"
              class="paper-grid-mark"
              :cx="gridStep / 2"
              :cy="gridStep / 2"
              r="1"
            />
            <path
              v-else-if="gridType === 'lines'"
              class="paper-grid-mark paper-grid-mark--stroke"
              :d="`M 0 ${gridStep - 0.5} H ${gridStep}`"
            />
            <path
              v-else-if="gridType === 'graph'"
              class="paper-grid-mark paper-grid-mark--stroke"
              :d="`M ${gridStep - 0.5} 0 V ${gridStep} M 0 ${gridStep - 0.5} H ${gridStep}`"
            />
          </pattern>
        </defs>

        <rect
          v-if="gridType !== 'none'"
          class="paper-grid"
          width="100%"
          height="100%"
          :fill="`url(#${gridId})`"
        />

        <!-- World layer. Its transform is written imperatively during gestures
             so a pan/zoom frame never re-diffs the stroke list. -->
        <g ref="worldRef">
          <path
            v-for="line in lines"
            :key="line.id"
            v-memo="[line.path, line.color, line.size, pendingErase.has(line.id)]"
            class="paper-stroke"
            :class="{ 'paper-stroke--erasing': pendingErase.has(line.id) }"
            :d="line.path"
            :stroke="line.color"
            :stroke-width="line.size"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-if="livePath"
            class="paper-stroke"
            :d="livePath"
            :stroke="color"
            :stroke-width="size"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>

        <!-- Eraser ring lives in screen space so it stays a constant size. -->
        <circle
          v-if="eraserCursor"
          class="paper-eraser-ring"
          :cx="eraserCursor.x"
          :cy="eraserCursor.y"
          :r="ERASER_RADIUS_PX"
        />
      </svg>

      <!-- Edge glow: the canvas is scrolling itself to keep up with the pen. -->
      <div
        v-for="side in EDGES"
        :key="side"
        class="paper-edge"
        :class="[`paper-edge--${side}`, { 'paper-edge--on': edgeGlow[side] }]"
      />

      <!-- Toolbar floats over the canvas, so activating never reflows the note. -->
      <Transition name="paper-fade">
        <div v-if="isActive" class="paper-toolbar" contenteditable="false" @pointerdown.stop>
          <div class="paper-toolbar-group">
            <UiToolbarButton
              v-for="tool in TOOLS"
              :key="tool.id"
              :icon="tool.icon"
              :label="tool.label"
              :tooltip="tool.tooltip"
              :active="activeTool === tool.id"
              @click="selectTool(tool.id)"
            />
          </div>

          <span class="paper-sep" />

          <template v-if="activeTool === 'pen'">
            <div class="paper-color-swatch-wrapper">
              <span class="paper-color-swatch" :style="{ backgroundColor: color }" />
              <!-- design-allow: native color picker — no Ui primitive wraps the OS color-picker UX -->
              <input v-model="color" type="color" class="paper-color-input" title="Stroke color" >
            </div>

            <template v-if="!isCompact">
              <!-- design-allow: native range input — no Ui primitive wraps a slider -->
              <input
                v-model.number="size"
                type="range"
                min="1"
                max="12"
                class="paper-range"
                title="Stroke width"
              >
              <span class="paper-size-label">{{ size }}px</span>
            </template>
            <span class="paper-sep" />
          </template>

          <div class="paper-toolbar-group">
            <UiToolbarButton
              icon="i-lucide-undo-2"
              label="Undo"
              tooltip="Undo (⌘Z)"
              :disabled="!canUndo"
              @click="undo"
            />
            <UiToolbarButton
              icon="i-lucide-redo-2"
              label="Redo"
              tooltip="Redo (⌘⇧Z)"
              :disabled="!canRedo"
              @click="redo"
            />
          </div>

          <span class="paper-sep" />

          <UiToolbarButton
            icon="i-lucide-grid-3x3"
            label="Toggle grid"
            :tooltip="`Grid: ${gridType}`"
            :active="gridType !== 'none'"
            @click="cycleGrid"
          />

          <template v-if="!isCompact">
            <span class="paper-sep" />
            <div class="paper-toolbar-group">
              <UiToolbarButton
                icon="i-lucide-minus"
                label="Zoom out"
                tooltip="Zoom out (−)"
                :disabled="!canZoomOut"
                @click="zoomOut"
              />
              <UiToolbarButton
                :icon-only="false"
                :label="zoomPercentLabel"
                tooltip="Reset to 100% (0)"
                class="paper-zoom-label"
                @click="resetZoom"
              />
              <UiToolbarButton
                icon="i-lucide-plus"
                label="Zoom in"
                tooltip="Zoom in (+)"
                :disabled="!canZoomIn"
                @click="zoomIn"
              />
              <UiToolbarButton
                icon="i-lucide-scan"
                label="Fit sketch"
                tooltip="Fit sketch (1)"
                @click="fitSketch"
              />
            </div>

            <span class="paper-sep" />

            <UiToolbarButton icon="i-lucide-download" label="Export as PNG" @click="exportPng" />
            <UiToolbarButton
              icon="i-lucide-eraser"
              label="Clear all"
              :disabled="!lines.length"
              @click="clearDrawing"
            />
            <UiToolbarButton
              icon="i-lucide-trash-2"
              label="Delete sketch"
              tone="error"
              @click="props.deleteNode()"
            />
          </template>

          <template v-else>
            <span class="paper-sep" />
            <UiActionMenu :items="compactMenuItems" size="xs" label="More options" />
          </template>
        </div>
      </Transition>

      <!-- Status chips -->
      <div class="paper-hud paper-hud--left" contenteditable="false">
        <Transition name="paper-fade">
          <div v-if="showZoomChip" class="paper-chip paper-chip--mono">{{ zoomPercentLabel }}</div>
        </Transition>
        <Transition name="paper-fade">
          <div v-if="isResizing" class="paper-chip paper-chip--mono">
            {{ Math.round(W) }} × {{ Math.round(H) }}
          </div>
        </Transition>
      </div>

      <div class="paper-hud paper-hud--right" contenteditable="false">
        <Transition name="paper-fade">
          <UiButton
            v-if="isActive && contentOffscreen"
            type="button"
            tone="neutral"
            variant="soft"
            size="xs"
            class="paper-action-btn"
            @pointerdown.stop
            @click="fitSketch"
          >
            <UiIcon name="i-lucide-locate-fixed" class="h-3.5 w-3.5" />
            Recenter
          </UiButton>
        </Transition>

        <div
          v-if="!isActive"
          class="paper-chip paper-chip--hint"
          :class="{ 'paper-chip--pressing': isPressPending }"
        >
          <UiIcon name="i-lucide-hand" class="h-3 w-3" />
          <span>{{ activationHint }}</span>
        </div>
        <UiButton
          v-else
          type="button"
          tone="primary"
          variant="soft"
          size="xs"
          class="paper-action-btn"
          @pointerdown.stop
          @click="deactivate"
        >
          <UiIcon name="i-lucide-check" class="h-3.5 w-3.5" />
          Done
        </UiButton>
      </div>

      <div v-if="!lines.length && !isDrawing" class="paper-empty-hint" contenteditable="false">
        <UiIcon name="i-lucide-pencil-line" class="h-5 w-5 opacity-40" />
        <span>{{ activationHint }} to sketch</span>
      </div>
    </div>

    <!-- Resize handles. Reachable on touch (shown whenever the block is active
         or selected) with a hit area far larger than the visible grip. -->
    <div
      v-for="dir in RESIZE_DIRS"
      :key="dir"
      class="paper-handle"
      :class="[`paper-handle--${dir}`, { 'paper-handle--visible': handlesVisible }]"
      :aria-label="`Resize sketch (${dir})`"
      @pointerdown="onResizeStart(dir, $event)"
    >
      <span class="paper-handle-grip" />
    </div>

    <!-- Atom node: no editable content inside the sketch. -->
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from "vue";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import UiActionMenu from "~/components/ui/UiActionMenu.vue";
import { designTokenValues, type DesignTokenName } from "~/design-system/tokens.generated";
import { useHaptics } from "~/composables/pwa/useHaptics";
import { useMediaQuery } from "~/composables/ui/useMotionCommon";
import { usePaperCamera, PAPER_MAX_SCALE, PAPER_MIN_SCALE } from "~/composables/ui/usePaperCamera";
import {
  createStrokeBuilder,
  expandRect,
  strokeHitTest,
  strokesBounds,
  type PaperStroke,
  type StrokeBuilder,
} from "~/utils/paper/ink";

/**
 * PaperComponent — an infinite sketch surface embedded in a document.
 *
 * The model is deliberately small: strokes live in an unbounded **world**, the
 * block is a fixed **frame**, and a **camera** maps one onto the other.
 *
 *  - Resizing changes the frame only. Ink never moves or rescales; growing from
 *    a top/left handle compensates the camera so the drawing stays put and new
 *    canvas appears where the handle was pulled.
 *  - Zoom and pan only move the camera. Nothing is persisted, so a view change
 *    can never dirty the document.
 *  - Infinite writing is the camera following the pen past the frame edge; the
 *    surface itself has no size to run out of.
 */

const props = defineProps(nodeViewProps);

type Tool = "pen" | "pan" | "eraser";
type GridType = "none" | "dots" | "lines" | "graph";
type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Gesture = "none" | "hold" | "draw" | "erase" | "pan" | "pinch";
type Edge = "top" | "right" | "bottom" | "left";

const MIN_WIDTH = 260;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 2400;
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const EDGES: Edge[] = ["top", "right", "bottom", "left"];

const ZOOM_STEP = 1.25;
/** Pointer travel (screen px) before a press is treated as drawing. */
const DRAW_INTENT_PX = 2.5;
/** Minimum spacing between recorded samples, in screen px. */
const SAMPLE_SPACING_PX = 1.4;
const HOLD_ACTIVATE_MS = 300;
const HOLD_CANCEL_DISTANCE_PX = 10;
const ERASER_RADIUS_PX = 13;
/** Distance from a frame edge at which the camera starts following the pen. */
const EDGE_PAN_ZONE_PX = 52;
const EDGE_PAN_MAX_SPEED = 900; // px/s
const GRID_BASE_STEP = 24;
const UNDO_LIMIT = 60;

const haptics = useHaptics();
const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
const gridId = `paper-grid-${Math.random().toString(36).slice(2, 9)}`;

// ── Element refs ─────────────────────────────────────────────────
const frameRef = ref<HTMLDivElement | null>(null);
const worldRef = ref<SVGGElement | null>(null);
const gridPatternRef = ref<SVGPatternElement | null>(null);

// ── Tools & appearance ───────────────────────────────────────────
const TOOLS = [
  { id: "pen" as Tool, label: "Pen", tooltip: "Pen (P)", icon: "i-lucide-pencil" },
  { id: "pan" as Tool, label: "Pan canvas", tooltip: "Pan (H, or hold Space)", icon: "i-lucide-hand" },
  { id: "eraser" as Tool, label: "Eraser", tooltip: "Eraser (E)", icon: "i-lucide-eraser" },
];

const activeTool = ref<Tool>("pen");
const color = ref<string>(designTokenValues["--color-accent-indigo"]);
const size = ref(3);
const gridType = ref<GridType>("none");
const gridStep = ref(GRID_BASE_STEP);

const isHovered = ref(false);
const isActive = ref(false);
const isPressPending = ref(false);
const isDrawing = ref(false);
const isSpacePressed = ref(false);
const livePath = ref<string | null>(null);
const eraserCursor = ref<{ x: number; y: number } | null>(null);
const pendingErase = shallowRef<Set<string>>(new Set());
const edgeGlow = reactive<Record<Edge, boolean>>({
  top: false,
  right: false,
  bottom: false,
  left: false,
});

// ── Geometry ─────────────────────────────────────────────────────
const containerWidth = ref(0);
const draftWidth = ref<number | null>(null);
const draftHeight = ref<number | null>(null);
const draftOffset = ref<number | null>(null);
const isResizing = ref(false);

const lines = computed<PaperStroke[]>(() => (props.node.attrs.lines || []) as PaperStroke[]);

const xOffset = computed<number>(() => draftOffset.value ?? (props.node.attrs.xOffset ?? 0));

const W = computed<number>(() => {
  if (draftWidth.value !== null) return draftWidth.value;
  const stored = props.node.attrs.width as number | null | undefined;
  if (!containerWidth.value) return stored ?? 600;
  const available = Math.max(MIN_WIDTH, containerWidth.value - xOffset.value);
  return Math.round(clamp(stored ?? containerWidth.value, MIN_WIDTH, available));
});

const H = computed<number>(() =>
  draftHeight.value ?? clamp((props.node.attrs.height as number) ?? 280, MIN_HEIGHT, MAX_HEIGHT),
);

const isCompact = computed(() => W.value < 520);
const viewport = computed(() => ({ width: W.value, height: H.value }));
const inkBounds = computed(() => strokesBounds(lines.value));

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

// ── Camera ───────────────────────────────────────────────────────
const camera = usePaperCamera({
  viewport,
  contentBounds: inkBounds,
  reducedMotion,
  onChange: syncCamera,
});

const { displayScale, contentOffscreen } = camera;

const zoomPercentLabel = computed(() => `${Math.round(displayScale.value * 100)}%`);
const canZoomIn = computed(() => displayScale.value < PAPER_MAX_SCALE - 0.001);
const canZoomOut = computed(() => displayScale.value > PAPER_MIN_SCALE + 0.001);
const showZoomChip = computed(
  () => isActive.value && Math.abs(displayScale.value - 1) > 0.001,
);

/**
 * Writes the camera straight to the DOM. Bypassing the VDOM here is what keeps
 * a pan at 60fps regardless of how many strokes the sketch holds.
 */
function syncCamera() {
  const { x, y, scale } = camera.state;

  worldRef.value?.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})`);

  if (gridType.value !== "none") {
    const step = adaptiveGridStep(scale);
    if (Math.abs(step - gridStep.value) > 0.01) gridStep.value = step;
    gridPatternRef.value?.setAttribute(
      "patternTransform",
      `translate(${mod(x, step).toFixed(2)} ${mod(y, step).toFixed(2)})`,
    );
  }

  // While the camera chases the pen, the world point under the (stationary)
  // finger keeps changing — keep sampling so the line follows the view.
  if (gesture.value === "draw" && isAutoPanning) appendSampleAtScreen(lastScreenX, lastScreenY);
}

/** Keeps on-screen grid spacing legible at every zoom level. */
function adaptiveGridStep(scale: number) {
  let step = GRID_BASE_STEP * scale;
  while (step < 14) step *= 2;
  while (step > 64) step /= 2;
  return step;
}

function mod(value: number, m: number) {
  return m > 0 ? ((value % m) + m) % m : 0;
}

/**
 * The frame's position is cached for the duration of a gesture. Reading it per
 * sample would force a synchronous layout on every pointer move — and because
 * this component writes the camera transform straight to the DOM, that layout
 * would be invalidated each frame, which is exactly the thrash pattern that
 * makes canvases feel heavy.
 */
let cachedFrameRect: DOMRect | null = null;

function refreshFrameRect() {
  cachedFrameRect = frameRef.value?.getBoundingClientRect() ?? null;
}

function invalidateFrameRect() {
  cachedFrameRect = null;
}

function frameToScreen(clientX: number, clientY: number) {
  if (!cachedFrameRect) refreshFrameRect();
  const rect = cachedFrameRect;
  if (!rect) return { x: 0, y: 0 };
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// ── Undo / redo (local to the sketch) ────────────────────────────
const undoStack = ref<PaperStroke[][]>([]);
const redoStack = ref<PaperStroke[][]>([]);
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

function snapshot(): PaperStroke[] {
  return lines.value.map((line) => ({ ...line }));
}

function pushUndo() {
  undoStack.value.push(snapshot());
  if (undoStack.value.length > UNDO_LIMIT) undoStack.value.shift();
  redoStack.value = [];
}

function undo() {
  const previous = undoStack.value.pop();
  if (!previous) return;
  redoStack.value.push(snapshot());
  props.updateAttributes({ lines: previous });
}

function redo() {
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(snapshot());
  props.updateAttributes({ lines: next });
}

// ── Activation gate ──────────────────────────────────────────────
// Touch starts passive so a swipe that merely crosses the sketch still scrolls
// the note; a deliberate hold hands the surface its gestures. Mouse and stylus
// have no such conflict, so they take effect on contact.
const isTouchPrimary = ref(false);
const activationHint = computed(() => (isTouchPrimary.value ? "Hold" : "Draw"));
const handlesVisible = computed(() => isActive.value || isHovered.value || props.selected);

const penCursor = computed(() => {
  const tint = encodeURIComponent(color.value);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='${tint}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m18 2 4 4-14 14H4v-4L18 2z'/%3E%3C/svg%3E") 3 20, crosshair`;
});

const frameCursor = computed(() => {
  if (!isActive.value) return "default";
  if (gesture.value === "pan") return "grabbing";
  if (activeTool.value === "pan" || isSpacePressed.value) return "grab";
  if (activeTool.value === "eraser") return "none";
  return penCursor.value;
});

function activate() {
  if (isActive.value) return;
  isActive.value = true;
  // Focus moves off ProseMirror and onto the frame, so keystrokes reach the
  // sketch instead of typing into (or undoing) the surrounding document.
  frameRef.value?.focus({ preventScroll: true });
  haptics.selection();
}

function deactivate() {
  finishGesture();
  isActive.value = false;
  isPressPending.value = false;
  isSpacePressed.value = false;
  camera.setAutoPan(0, 0);
  clearEdgeGlow();
}

function selectTool(tool: Tool) {
  activeTool.value = tool;
}

// ── Pointer routing ──────────────────────────────────────────────
// Every gesture funnels through one pointer map so touch, pen and mouse share
// the same state machine and can't start two gestures at once.
interface PointerSample {
  x: number;
  y: number;
}

const pointers = new Map<number, PointerSample>();
/** Reactive so the cursor and hint follow the gesture; written a handful of
 *  times per gesture, never per frame. */
const gesture = ref<Gesture>("none");
let strokeBuilder: StrokeBuilder | null = null;
let strokeCommitsOnRelease = false;
let strokeArmed = false;
let strokeOriginX = 0;
let strokeOriginY = 0;
let lastSampleX = 0;
let lastSampleY = 0;
let lastScreenX = 0;
let lastScreenY = 0;
let isAutoPanning = false;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let pinchDistance = 0;
let pinchMidX = 0;
let pinchMidY = 0;
let velocityX = 0;
let velocityY = 0;
let lastMoveTime = 0;
/** The pointer that owns the current single-pointer gesture. Stray pointers
 *  (a resting palm, a third finger) must not feed it samples. */
let activePointerId: number | null = null;

function onPointerDown(event: PointerEvent) {
  if (event.button === 2) return;

  refreshFrameRect();
  const local = frameToScreen(event.clientX, event.clientY);
  pointers.set(event.pointerId, local);
  capturePointer(event.pointerId);
  activePointerId = event.pointerId;

  if (pointers.size === 2) {
    beginPinch();
    return;
  }
  if (pointers.size > 2) return;

  lastScreenX = local.x;
  lastScreenY = local.y;

  const wantsPan =
    activeTool.value === "pan" || isSpacePressed.value || event.button === 1;

  if (wantsPan) {
    event.preventDefault();
    activate();
    beginPan(local.x, local.y);
    return;
  }

  // Touch on a passive sketch: wait for a deliberate hold before taking over.
  if (event.pointerType === "touch" && !isActive.value) {
    gesture.value = "hold";
    isPressPending.value = true;
    strokeOriginX = local.x;
    strokeOriginY = local.y;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      isPressPending.value = false;
      activate();
      // A deliberate hold that never moves is still a mark.
      beginStroke(strokeOriginX, strokeOriginY, { commitOnRelease: true });
    }, HOLD_ACTIVATE_MS);
    return;
  }

  event.preventDefault();
  activate();

  if (activeTool.value === "eraser") {
    beginErase(local.x, local.y);
    return;
  }

  // Sampling starts now, but ink is only committed once the pointer travels —
  // so clicking the sketch to focus it doesn't leave a stray dot.
  beginStroke(local.x, local.y, { commitOnRelease: event.pointerType !== "mouse" });
}

function onPointerMove(event: PointerEvent) {
  const local = frameToScreen(event.clientX, event.clientY);

  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, local);

  if (activeTool.value === "eraser" && isActive.value) {
    eraserCursor.value = local;
  }

  if (gesture.value === "pinch") {
    updatePinch();
    return;
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) return;

  if (gesture.value === "hold") {
    if (Math.hypot(local.x - strokeOriginX, local.y - strokeOriginY) > HOLD_CANCEL_DISTANCE_PX) {
      cancelHold();
    }
    return;
  }

  if (gesture.value === "pan") {
    updatePan(local.x, local.y);
    return;
  }

  if (gesture.value === "erase") {
    lastScreenX = local.x;
    lastScreenY = local.y;
    collectErase(local.x, local.y);
    return;
  }

  if (gesture.value !== "draw") return;

  event.preventDefault();
  lastScreenX = local.x;
  lastScreenY = local.y;

  // Coalesced events recover the full stylus sample rate that a single
  // pointermove per frame would throw away.
  const batch =
    typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];

  if (batch.length > 1) {
    for (const sample of batch) {
      const point = frameToScreen(sample.clientX, sample.clientY);
      appendSampleAtScreen(point.x, point.y);
    }
  } else {
    appendSampleAtScreen(local.x, local.y);
  }

  updateEdgePan(local.x, local.y);
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  releasePointer(event.pointerId);

  if (gesture.value === "pinch") {
    if (pointers.size < 2) endPinch();
    return;
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  activePointerId = null;
  finishGesture();
}

function onPointerCancel(event: PointerEvent) {
  pointers.delete(event.pointerId);
  releasePointer(event.pointerId);

  if (gesture.value === "pinch") {
    if (pointers.size < 2) endPinch();
    return;
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  activePointerId = null;

  if (gesture.value === "hold") {
    cancelHold();
    return;
  }

  finishGesture();
}

// Capture keeps a gesture bound to this frame even when the pointer strays
// outside it. Both calls throw if the browser has already retired the pointer,
// which is routine during fast multi-touch.
function capturePointer(pointerId: number) {
  try {
    frameRef.value?.setPointerCapture(pointerId);
  } catch {
    // Pointer is no longer active; the gesture still works without capture.
  }
}

function releasePointer(pointerId: number) {
  try {
    if (frameRef.value?.hasPointerCapture?.(pointerId)) {
      frameRef.value.releasePointerCapture(pointerId);
    }
  } catch {
    // Already released by the browser.
  }
}

function onPointerLeave() {
  eraserCursor.value = null;
}

function onContextMenu(event: MouseEvent) {
  if (isActive.value) event.preventDefault();
}

function cancelHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  isPressPending.value = false;
  if (gesture.value === "hold") gesture.value = "none";
}

function finishGesture() {
  cancelHold();

  switch (gesture.value) {
    case "draw":
      endStroke();
      break;
    case "erase":
      endErase();
      break;
    case "pan":
      endPan();
      break;
    default:
      break;
  }

  gesture.value = "none";
}

// ── Drawing ──────────────────────────────────────────────────────
function beginStroke(screenX: number, screenY: number, opts: { commitOnRelease: boolean }) {
  gesture.value = "draw";
  strokeBuilder = createStrokeBuilder();
  strokeArmed = false;
  strokeCommitsOnRelease = opts.commitOnRelease;
  strokeOriginX = screenX;
  strokeOriginY = screenY;
  lastScreenX = screenX;
  lastScreenY = screenY;

  const world = camera.screenToWorld(screenX, screenY);
  lastSampleX = world.x;
  lastSampleY = world.y;
  strokeBuilder.add(world.x, world.y);

  // The stroke in progress isn't in `contentBounds` yet, so bounds would fight
  // the pen. They come back the moment the stroke lands.
  camera.setBoundsEnabled(false);
}

function appendSampleAtScreen(screenX: number, screenY: number) {
  if (!strokeBuilder) return;

  const world = camera.screenToWorld(screenX, screenY);
  const spacing = SAMPLE_SPACING_PX / camera.state.scale;
  const dx = world.x - lastSampleX;
  const dy = world.y - lastSampleY;

  if (!strokeArmed) {
    const travelled = Math.hypot(screenX - strokeOriginX, screenY - strokeOriginY);
    if (travelled < DRAW_INTENT_PX) return;
    strokeArmed = true;
    isDrawing.value = true;
  }

  if (dx * dx + dy * dy < spacing * spacing) return;

  lastSampleX = world.x;
  lastSampleY = world.y;
  livePath.value = strokeBuilder.add(world.x, world.y);
}

/** Follows the pen past the edge — this is what makes writing feel unbounded. */
function updateEdgePan(screenX: number, screenY: number) {
  const width = W.value;
  const height = H.value;
  let vx = 0;
  let vy = 0;

  if (screenX < EDGE_PAN_ZONE_PX) {
    vx = ((EDGE_PAN_ZONE_PX - screenX) / EDGE_PAN_ZONE_PX) * EDGE_PAN_MAX_SPEED;
  } else if (screenX > width - EDGE_PAN_ZONE_PX) {
    vx = -((screenX - (width - EDGE_PAN_ZONE_PX)) / EDGE_PAN_ZONE_PX) * EDGE_PAN_MAX_SPEED;
  }

  if (screenY < EDGE_PAN_ZONE_PX) {
    vy = ((EDGE_PAN_ZONE_PX - screenY) / EDGE_PAN_ZONE_PX) * EDGE_PAN_MAX_SPEED;
  } else if (screenY > height - EDGE_PAN_ZONE_PX) {
    vy = -((screenY - (height - EDGE_PAN_ZONE_PX)) / EDGE_PAN_ZONE_PX) * EDGE_PAN_MAX_SPEED;
  }

  edgeGlow.left = vx > 0;
  edgeGlow.right = vx < 0;
  edgeGlow.top = vy > 0;
  edgeGlow.bottom = vy < 0;

  isAutoPanning = vx !== 0 || vy !== 0;
  camera.setAutoPan(vx, vy);
}

function clearEdgeGlow() {
  edgeGlow.top = false;
  edgeGlow.right = false;
  edgeGlow.bottom = false;
  edgeGlow.left = false;
  isAutoPanning = false;
}

function endStroke() {
  camera.setAutoPan(0, 0);
  clearEdgeGlow();

  const builder = strokeBuilder;
  strokeBuilder = null;
  livePath.value = null;
  isDrawing.value = false;

  const shouldCommit =
    !!builder && builder.length > 0 && (strokeArmed || strokeCommitsOnRelease);

  if (shouldCommit) {
    pushUndo();
    props.updateAttributes({
      lines: [
        ...lines.value,
        {
          id: crypto.randomUUID(),
          color: color.value,
          size: size.value,
          path: builder.finish(),
        },
      ],
    });
  }

  // Re-armed only after the new stroke is part of the document, so the bounds
  // it just extended are the ones the camera is held to.
  camera.setBoundsEnabled(true);
}

// ── Erasing (drag, with a radius) ────────────────────────────────
function beginErase(screenX: number, screenY: number) {
  gesture.value = "erase";
  pendingErase.value = new Set();
  eraserCursor.value = { x: screenX, y: screenY };
  collectErase(screenX, screenY);
}

function collectErase(screenX: number, screenY: number) {
  const world = camera.screenToWorld(screenX, screenY);
  const radius = ERASER_RADIUS_PX / camera.state.scale;
  let changed = false;

  for (const line of lines.value) {
    if (pendingErase.value.has(line.id)) continue;
    if (strokeHitTest(line, world.x, world.y, radius)) {
      pendingErase.value.add(line.id);
      changed = true;
    }
  }

  if (changed) {
    // Set is shallow — re-trigger so the fading preview repaints.
    pendingErase.value = new Set(pendingErase.value);
    haptics.selection();
  }
}

function endErase() {
  const doomed = pendingErase.value;
  pendingErase.value = new Set();
  if (!doomed.size) return;

  pushUndo();
  props.updateAttributes({
    lines: lines.value.filter((line) => !doomed.has(line.id)),
  });
}

// ── Panning ──────────────────────────────────────────────────────
function beginPan(screenX: number, screenY: number) {
  gesture.value = "pan";
  camera.beginPan();
  lastScreenX = screenX;
  lastScreenY = screenY;
  lastMoveTime = performance.now();
  velocityX = 0;
  velocityY = 0;
}

function updatePan(screenX: number, screenY: number) {
  const now = performance.now();
  const dt = Math.max(now - lastMoveTime, 1);
  const dx = screenX - lastScreenX;
  const dy = screenY - lastScreenY;

  camera.panBy(dx, dy);

  // Blended so a single jittery sample can't define the throw.
  velocityX = velocityX * 0.7 + (dx / dt) * 0.3;
  velocityY = velocityY * 0.7 + (dy / dt) * 0.3;

  lastScreenX = screenX;
  lastScreenY = screenY;
  lastMoveTime = now;
}

function endPan() {
  const idle = performance.now() - lastMoveTime > 120;
  camera.endPan(idle ? 0 : velocityX, idle ? 0 : velocityY);
  velocityX = 0;
  velocityY = 0;
}

// ── Pinch: zoom and pan applied together, every frame ────────────
function beginPinch() {
  cancelHold();
  if (gesture.value === "draw") {
    // Abandon the stroke the second finger interrupted.
    strokeBuilder = null;
    livePath.value = null;
    isDrawing.value = false;
    camera.setAutoPan(0, 0);
    camera.setBoundsEnabled(true);
    clearEdgeGlow();
  }

  activate();
  gesture.value = "pinch";
  camera.beginPan();

  const [a, b] = [...pointers.values()];
  if (!a || !b) return;
  pinchDistance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  pinchMidX = (a.x + b.x) / 2;
  pinchMidY = (a.y + b.y) / 2;
  lastMoveTime = performance.now();
  velocityX = 0;
  velocityY = 0;
}

function updatePinch() {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return;

  const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Both components every frame: a real pinch always translates while it
  // scales, and applying only one of them is what makes zoom feel jumpy.
  camera.zoomBy(distance / pinchDistance, midX, midY);
  camera.panBy(midX - pinchMidX, midY - pinchMidY);

  const now = performance.now();
  const dt = Math.max(now - lastMoveTime, 1);
  velocityX = velocityX * 0.7 + ((midX - pinchMidX) / dt) * 0.3;
  velocityY = velocityY * 0.7 + ((midY - pinchMidY) / dt) * 0.3;

  pinchDistance = distance;
  pinchMidX = midX;
  pinchMidY = midY;
  lastMoveTime = now;
}

function endPinch() {
  gesture.value = "none";
  const idle = performance.now() - lastMoveTime > 120;
  camera.endPan(idle ? 0 : velocityX, idle ? 0 : velocityY);
  // Any finger still down must be lifted before a new gesture can start, so a
  // pinch never decays into an accidental stroke.
  pointers.clear();
  activePointerId = null;
}

// ── Wheel / trackpad ─────────────────────────────────────────────
function onWheel(event: WheelEvent) {
  if (!isActive.value) return; // Passive sketch: the page keeps its scroll.

  event.preventDefault();
  refreshFrameRect();
  const local = frameToScreen(event.clientX, event.clientY);
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H.value : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;

  // Trackpad pinch and ctrl+wheel both arrive here as a ctrl-modified wheel.
  if (event.ctrlKey || event.metaKey) {
    camera.zoomBy(Math.exp(-dy * 0.0022), local.x, local.y);
    return;
  }

  camera.beginPan();
  if (event.shiftKey && dx === 0) camera.panBy(-dy, 0);
  else camera.panBy(-dx, -dy);
  camera.settle();
}

function onDoubleClick(event: MouseEvent) {
  if (!isActive.value) return;
  event.preventDefault();
  refreshFrameRect();
  const local = frameToScreen(event.clientX, event.clientY);
  animatedZoomAt(camera.state.scale > 1.05 ? 1 : 2, local.x, local.y);
}

function animatedZoomAt(nextScale: number, screenX: number, screenY: number, duration = 260) {
  const target = clamp(nextScale, PAPER_MIN_SCALE, PAPER_MAX_SCALE);
  const world = camera.screenToWorld(screenX, screenY);
  camera.animateTo(
    { scale: target, x: screenX - world.x * target, y: screenY - world.y * target },
    duration,
  );
}

function zoomIn() {
  camera.zoomToScale(camera.state.scale * ZOOM_STEP);
}

function zoomOut() {
  camera.zoomToScale(camera.state.scale / ZOOM_STEP);
}

function resetZoom() {
  camera.reset();
  haptics.selection();
}

function fitSketch() {
  camera.fitContent();
  haptics.selection();
}

// ── Resize: changes the window, never the drawing ────────────────
// The camera is compensated so the ink stays visually pinned: pulling the top
// or left handle reveals fresh canvas exactly where the handle was dragged,
// instead of sliding the sketch across the frame.
let resizeDir: ResizeDir | null = null;
let resizePointerId: number | null = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartOffset = 0;
let appliedWidth = 0;
let appliedHeight = 0;
let appliedOffset = 0;

function onResizeStart(dir: ResizeDir, event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();

  resizeDir = dir;
  resizePointerId = event.pointerId;
  isResizing.value = true;
  resizeStartX = event.clientX;
  resizeStartY = event.clientY;
  resizeStartWidth = W.value;
  resizeStartHeight = H.value;
  resizeStartOffset = xOffset.value;
  appliedWidth = resizeStartWidth;
  appliedHeight = resizeStartHeight;
  appliedOffset = resizeStartOffset;

  draftWidth.value = resizeStartWidth;
  draftHeight.value = resizeStartHeight;
  draftOffset.value = resizeStartOffset;

  window.addEventListener("pointermove", onResizeMove);
  window.addEventListener("pointerup", onResizeEnd);
  window.addEventListener("pointercancel", onResizeEnd);

  // After the listeners: capture can throw for a pointer the browser already
  // retired, and a failed capture must not leave the drag half-armed.
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {
    // Uncaptured resize still works via the window listeners above.
  }
}

function onResizeMove(event: PointerEvent) {
  if (!resizeDir || event.pointerId !== resizePointerId) return;
  event.preventDefault();

  const dx = event.clientX - resizeStartX;
  const dy = event.clientY - resizeStartY;
  const maxWidth = containerWidth.value || resizeStartWidth;

  let nextWidth = resizeStartWidth;
  let nextOffset = resizeStartOffset;

  if (resizeDir.includes("e")) {
    nextWidth = clamp(resizeStartWidth + dx, MIN_WIDTH, maxWidth - resizeStartOffset);
  }
  if (resizeDir.includes("w")) {
    // Widening leftward eats into the offset; the block never escapes its column.
    nextWidth = clamp(resizeStartWidth - dx, MIN_WIDTH, resizeStartWidth + resizeStartOffset);
    nextOffset = resizeStartOffset + (resizeStartWidth - nextWidth);
  }

  let nextHeight = resizeStartHeight;
  if (resizeDir.includes("s")) nextHeight = clamp(resizeStartHeight + dy, MIN_HEIGHT, MAX_HEIGHT);
  if (resizeDir.includes("n")) nextHeight = clamp(resizeStartHeight - dy, MIN_HEIGHT, MAX_HEIGHT);

  nextWidth = Math.round(nextWidth);
  nextHeight = Math.round(nextHeight);
  nextOffset = Math.round(nextOffset);

  // The block's top-left is fixed in the document, so compensate the camera:
  // a west drag moves the frame's left edge, a north drag has to look like the
  // top edge moved even though the box actually grows downward.
  const offsetDelta = nextOffset - appliedOffset;
  const heightDelta = nextHeight - appliedHeight;
  const cameraDX = resizeDir.includes("w") ? -offsetDelta : 0;
  const cameraDY = resizeDir.includes("n") ? heightDelta : 0;
  if (cameraDX !== 0 || cameraDY !== 0) camera.nudge(cameraDX, cameraDY);

  draftWidth.value = nextWidth;
  draftHeight.value = nextHeight;
  draftOffset.value = nextOffset;
  appliedWidth = nextWidth;
  appliedHeight = nextHeight;
  appliedOffset = nextOffset;
}

function onResizeEnd() {
  if (!resizeDir) return;

  window.removeEventListener("pointermove", onResizeMove);
  window.removeEventListener("pointerup", onResizeEnd);
  window.removeEventListener("pointercancel", onResizeEnd);

  // One transaction for the whole drag — the old code wrote the document on
  // every pointer move, flooding history and collaboration with noise.
  const changed =
    appliedWidth !== resizeStartWidth ||
    appliedHeight !== resizeStartHeight ||
    appliedOffset !== resizeStartOffset;

  if (changed) {
    props.updateAttributes({
      width: appliedWidth,
      height: appliedHeight,
      xOffset: appliedOffset,
    });
    haptics.selection();
  }

  resizeDir = null;
  resizePointerId = null;
  isResizing.value = false;
  draftWidth.value = null;
  draftHeight.value = null;
  draftOffset.value = null;
  invalidateFrameRect();
  camera.settle();
}

// ── Grid ─────────────────────────────────────────────────────────
const gridOrder: GridType[] = ["none", "dots", "lines", "graph"];
function cycleGrid() {
  const index = gridOrder.indexOf(gridType.value);
  gridType.value = gridOrder[(index + 1) % gridOrder.length] ?? "none";
  syncCamera();
}

function clearDrawing() {
  if (!lines.value.length) return;
  pushUndo();
  props.updateAttributes({ lines: [] });
}

// ── Export ───────────────────────────────────────────────────────
// Exports the ink at its own aspect ratio rather than squeezing the world into
// the frame's box, which used to distort every sketch bigger than its window.
function exportPng() {
  const bounds = inkBounds.value;
  if (!bounds) return;

  const padding = 24;
  const rect = expandRect(bounds, padding);
  const width = Math.max(Math.ceil(rect.maxX - rect.minX), 1);
  const height = Math.max(Math.ceil(rect.maxY - rect.minY), 1);

  const paths = lines.value
    .map(
      (line) =>
        `<path d="${escapeXml(line.path)}" stroke="${escapeXml(line.color)}" stroke-width="${line.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${rect.minX} ${rect.minY} ${width} ${height}">${paths}</svg>`;

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const image = new Image();

  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    URL.revokeObjectURL(url);
    if (!context) return;

    context.fillStyle = resolveToken("--color-white");
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `sketch-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(href);
    }, "image/png");
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Stroke colours are written to SVG attributes and serialised for export, so
 *  they must be resolved values rather than `var(--…)` references. */
function resolveToken(name: DesignTokenName): string {
  const fallback = designTokenValues[name];
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const compactMenuItems = computed(() => [
  [
    { label: `Zoom (${zoomPercentLabel.value})`, icon: "i-lucide-search", onSelect: resetZoom },
    { label: "Zoom In", icon: "i-lucide-plus", disabled: !canZoomIn.value, onSelect: zoomIn },
    { label: "Zoom Out", icon: "i-lucide-minus", disabled: !canZoomOut.value, onSelect: zoomOut },
    { label: "Fit Sketch", icon: "i-lucide-scan", onSelect: fitSketch },
  ],
  [
    { label: "Export PNG", icon: "i-lucide-download", onSelect: exportPng },
    { label: "Clear All", icon: "i-lucide-eraser", disabled: !lines.value.length, onSelect: clearDrawing },
  ],
  [
    {
      label: "Delete Sketch",
      icon: "i-lucide-trash-2",
      requiresDoubleTap: true,
      onSelect: () => props.deleteNode(),
    },
  ],
]);

// ── Keyboard ─────────────────────────────────────────────────────
// Listens on the frame itself, which activation focuses. Because the frame is
// nested inside the ProseMirror DOM, this handler runs before the editor's
// keymaps — stopping propagation is what lets ⌘Z mean "undo my last stroke"
// instead of also rolling back the surrounding document.
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function onFrameKeydown(event: KeyboardEvent) {
  if (!isActive.value) return;
  // Toolbar's native inputs (color, range) keep their own key handling.
  if (isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if (event.code === "Space") {
    // Hold-to-pan; also keeps the page from scrolling underneath.
    event.preventDefault();
    event.stopPropagation();
    isSpacePressed.value = true;
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return;

  let handled = true;
  switch (key) {
    case "escape":
      deactivate();
      break;
    case "p":
      selectTool("pen");
      break;
    case "h":
      selectTool("pan");
      break;
    case "e":
      selectTool("eraser");
      break;
    case "g":
      cycleGrid();
      break;
    case "0":
      resetZoom();
      break;
    case "1":
      fitSketch();
      break;
    case "+":
    case "=":
      zoomIn();
      break;
    case "-":
      zoomOut();
      break;
    default:
      handled = false;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/** Window-level so Space is released even if focus moved mid-hold. */
function onKeyUp(event: KeyboardEvent) {
  if (event.code === "Space") isSpacePressed.value = false;
}

/** A press anywhere else hands the gestures back to the document. */
function onDocumentPointerDown(event: PointerEvent) {
  if (!isActive.value) return;
  const wrapper = frameRef.value?.closest(".paper");
  if (wrapper && event.target instanceof Node && wrapper.contains(event.target)) return;
  deactivate();
}

// ── Lifecycle ────────────────────────────────────────────────────
let containerObserver: ResizeObserver | null = null;

let didFrameInitialContent = false;

function measureContainer() {
  const wrapper = frameRef.value?.closest(".paper");
  const parent = wrapper?.parentElement;
  if (!parent) return;

  const style = getComputedStyle(parent);
  const inner =
    parent.clientWidth -
    Number.parseFloat(style.paddingLeft || "0") -
    Number.parseFloat(style.paddingRight || "0");

  // A zero measurement means "not laid out yet", not "very narrow". Treating
  // the two the same made the sketch frame itself against a placeholder width
  // and open zoomed out for no reason.
  if (inner <= 0) return;

  containerWidth.value = Math.max(Math.round(inner), MIN_WIDTH);
  invalidateFrameRect();

  if (!didFrameInitialContent) {
    didFrameInitialContent = true;
    nextTick(frameInitialContent);
  }
}

/**
 * Legacy sketches were authored against a surface that grew leftward/upward, so
 * their ink can start outside the default view. Frame it once on load rather
 * than opening on an apparently blank page.
 */
function frameInitialContent() {
  const bounds = inkBounds.value;
  if (!bounds) return;
  const fitsAsIs =
    bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX <= W.value && bounds.maxY <= H.value;
  if (fitsAsIs) return;
  camera.fitTo(bounds, { padding: 24, maxScale: 1, duration: 0 });
}

onMounted(() => {
  isTouchPrimary.value =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  color.value = resolveToken("--color-accent-indigo");

  measureContainer();
  const parent = frameRef.value?.closest(".paper")?.parentElement;
  if (parent) {
    containerObserver = new ResizeObserver(() => measureContainer());
    containerObserver.observe(parent);
  }

  syncCamera();

  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", invalidateFrameRect);
  window.addEventListener("scroll", invalidateFrameRect, true);
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("resize", invalidateFrameRect);
  window.removeEventListener("scroll", invalidateFrameRect, true);
  window.removeEventListener("pointermove", onResizeMove);
  window.removeEventListener("pointerup", onResizeEnd);
  window.removeEventListener("pointercancel", onResizeEnd);
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  if (holdTimer) clearTimeout(holdTimer);
  containerObserver?.disconnect();
  camera.setAutoPan(0, 0);
});

// Grid geometry changes are reactive; the transform that positions it is not,
// so re-sync whenever the pattern is rebuilt.
watch([gridStep, gridType], () => syncCamera());

// A resized frame changes what "in bounds" means. During a drag the camera is
// being nudged deliberately, so settling is deferred to the end of the gesture.
watch([W, H], () => {
  invalidateFrameRect();
  if (!isResizing.value) camera.settle();
});
</script>

<style>
/* Node views render outside the component's scope, so these rules are global
   by necessity — every selector is namespaced under `.paper`. */
.paper {
  position: relative;
  display: block;
  box-sizing: border-box;
  max-width: 100%;
  margin: 1.25rem 0;
  border-radius: var(--radius-xl);
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.paper--resizing {
  transition: none;
}

/* ─── Viewport ───────────────────────────────────────────────────── */
.paper-frame {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: var(--color-background);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-secondary) 70%, transparent);
  /* Passive: the note scrolls through it. Active: the surface owns its gestures. */
  touch-action: auto;
  transition: box-shadow 0.2s ease, height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  -webkit-user-select: none;
}

/* The active ring is the focus indicator; the default outline would double it. */
.paper-frame:focus,
.paper-frame:focus-visible {
  outline: none;
}

.paper--active .paper-frame {
  touch-action: none;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent),
    0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.paper--resizing .paper-frame {
  transition: box-shadow 0.2s ease;
}

/* No touch-action here: the frame decides. When passive it stays `auto`, so a
   swipe across the sketch scrolls the note; `.paper--active` flips it to none
   and every descendant inherits the effective value. */
.paper-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.paper-grid-mark {
  fill: color-mix(in srgb, var(--color-content-on-background) 22%, transparent);
}

.paper-grid-mark--stroke {
  fill: none;
  stroke: color-mix(in srgb, var(--color-content-on-background) 12%, transparent);
  stroke-width: 1;
}

.paper-stroke {
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.paper-stroke--erasing {
  opacity: 0.25;
}

.paper-eraser-ring {
  fill: color-mix(in srgb, var(--color-error) 8%, transparent);
  stroke: color-mix(in srgb, var(--color-error) 65%, transparent);
  stroke-width: 1.5;
  pointer-events: none;
}

/* ─── Edge glow: the camera is following the pen ─────────────────── */
.paper-edge {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.paper-edge--on {
  opacity: 1;
}

.paper-edge--top,
.paper-edge--bottom {
  left: 0;
  right: 0;
  height: 44px;
}

.paper-edge--left,
.paper-edge--right {
  top: 0;
  bottom: 0;
  width: 44px;
}

.paper-edge--top {
  top: 0;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent);
}

.paper-edge--bottom {
  bottom: 0;
  background: linear-gradient(to top, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent);
}

.paper-edge--left {
  left: 0;
  background: linear-gradient(to right, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent);
}

.paper-edge--right {
  right: 0;
  background: linear-gradient(to left, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent);
}

/* ─── Toolbar (floats: activating must not reflow the note) ──────── */
.paper-toolbar {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0.25rem 0.4rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  box-shadow: var(--shadow-dropdown);
  backdrop-filter: blur(12px);
  user-select: none;
}

.paper-toolbar::-webkit-scrollbar {
  display: none;
}

.paper-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.paper-sep {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  margin: 0 2px;
  background: var(--color-secondary);
}

.paper-zoom-label {
  min-width: 52px;
  font-variant-numeric: tabular-nums;
}

.paper-color-swatch-wrapper {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
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

.paper-range {
  width: 60px;
  height: 4px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.paper-size-label {
  min-width: 26px;
  font-size: 0.6rem;
  font-family: monospace;
  color: var(--color-content-secondary);
}

/* ─── Status chips ───────────────────────────────────────────────── */
.paper-hud {
  position: absolute;
  bottom: 8px;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.paper-hud--left {
  left: 8px;
}

.paper-hud--right {
  right: 8px;
}

.paper-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-background) 88%, transparent);
  color: var(--color-content-secondary);
  font-size: 0.65rem;
  font-weight: 600;
  box-shadow: var(--shadow-dropdown);
  backdrop-filter: blur(6px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.paper-chip--mono {
  font-family: monospace;
  font-variant-numeric: tabular-nums;
}

.paper-chip--pressing {
  transform: scale(1.06);
  color: var(--color-primary);
}

.paper-action-btn {
  pointer-events: auto;
  box-shadow: var(--shadow-dropdown);
}

.paper-empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1rem;
  color: var(--color-content-disabled);
  font-size: 0.75rem;
  text-align: center;
  pointer-events: none;
}

.paper-fade-enter-active,
.paper-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.paper-fade-enter-from,
.paper-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

/* ─── Resize handles ─────────────────────────────────────────────
   Generous, touch-sized hit areas with a small visible grip, so a resize is
   reachable without a mouse and a scroll near the border isn't hijacked. */
.paper-handle {
  position: absolute;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  touch-action: none;
  transition: opacity 0.2s ease;
}

.paper-handle--visible {
  opacity: 1;
  pointer-events: auto;
}

.paper-handle-grip {
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-content-on-background) 28%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-background) 80%, transparent);
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.paper-handle:hover .paper-handle-grip,
.paper-handle:active .paper-handle-grip {
  background: var(--color-primary);
  transform: scale(1.15);
}

.paper-handle--n,
.paper-handle--s {
  left: 50%;
  width: 72px;
  height: 22px;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.paper-handle--n {
  top: -11px;
}

.paper-handle--s {
  bottom: -11px;
}

.paper-handle--n .paper-handle-grip,
.paper-handle--s .paper-handle-grip {
  width: 34px;
  height: 4px;
}

.paper-handle--e,
.paper-handle--w {
  top: 50%;
  width: 22px;
  height: 72px;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.paper-handle--e {
  right: -11px;
}

.paper-handle--w {
  left: -11px;
}

.paper-handle--e .paper-handle-grip,
.paper-handle--w .paper-handle-grip {
  width: 4px;
  height: 34px;
}

.paper-handle--ne,
.paper-handle--nw,
.paper-handle--se,
.paper-handle--sw {
  width: 26px;
  height: 26px;
}

.paper-handle--ne .paper-handle-grip,
.paper-handle--nw .paper-handle-grip,
.paper-handle--se .paper-handle-grip,
.paper-handle--sw .paper-handle-grip {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-sm);
}

.paper-handle--nw {
  top: -13px;
  left: -13px;
  cursor: nwse-resize;
}

.paper-handle--ne {
  top: -13px;
  right: -13px;
  cursor: nesw-resize;
}

.paper-handle--sw {
  bottom: -13px;
  left: -13px;
  cursor: nesw-resize;
}

.paper-handle--se {
  bottom: -13px;
  right: -13px;
  cursor: nwse-resize;
}

@media (prefers-reduced-motion: reduce) {
  .paper,
  .paper-frame,
  .paper-stroke,
  .paper-edge,
  .paper-chip,
  .paper-handle,
  .paper-handle-grip {
    transition: none;
  }
}
</style>
