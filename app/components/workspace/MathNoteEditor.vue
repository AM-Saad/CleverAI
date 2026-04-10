<script setup lang="ts">
// import { useMathRecognition } from "~/composables/ai/useMathRecognition";
import { useLocalMathRecognition } from "~/composables/ai/useLocalMathRecognition";
import { useInfiniteCanvas } from "~/composables/ui/useInfiniteCanvas";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { MathNoteMetadata } from "@@/shared/utils/note.contract";
import { motion } from "motion-v";

/**
 * MathNoteEditor — Canvas-based handwritten math note editor.
 *
 * RESPONSIBILITIES (UI layer only):
 *  - Ink capture on an HTML5 canvas (persistent — ink stays across recognitions)
 *  - Canvas snapshot persistence via Base64 DataURL for reload recovery
 *  - Tracking bounding boxes of new strokes since the last recognition
 *  - Smart-cropping the canvas to only the new strokes before sending to AI
 *  - Inline "solve" — draws result directly on canvas when LaTeX ends with =
 *  - KaTeX overlays at the bounding box location for feedback
 *  - "Clear Area" tool to erase the current stroke region without wiping history
 *  - Emitting changes up to the parent for persistence in the NOTES store
 *
 * All AI / math logic is delegated to `useMathRecognition`.
 */

const props = defineProps<{
  /** ID of the note being edited (used for persistence key) */
  noteId: string;
  /** Pre-existing math metadata to restore (lines + scope) */
  initialMetadata?: MathNoteMetadata;
  /** Whether the editor is currently in fullscreen mode */
  isFullscreen?: boolean;
}>();

const emit = defineEmits<{
  /** Fired after every successful recognition so the parent can persist */
  (e: "update", metadata: MathNoteMetadata): void;
  (e: "toggle-fullscreen"): void;
  (e: "delete"): void;
}>();

// ── AI composable (Using new Local AI hook while preserving the old file) ──
const {
  recognizeWithLocalAI,
  restoreScope,
  getScope,
  isRecognizing,
  recognitionError,
  isDownloading,
  progress
} = useLocalMathRecognition();

// ── Toast ──
const toast = useToast();

// Variables handled by useInfiniteCanvas

// ── Lines (recognised strokes) ──
const lines = ref<MathNoteMetadata["lines"]>(
  props.initialMetadata?.lines ?? []
);

// ── Stroke timeout for auto-recognition ──
const STROKE_TIMEOUT_MS = 3800;
let strokeTimer: ReturnType<typeof setTimeout> | null = null;

// ── Infinite Canvas Core ──
const {
  canvasRef,
  allStrokes,
  pendingBounds,
  camera,
  edgeGlowStyle,
  worldToScreen,
  startStroke,
  continueStroke,
  endStroke,
  onWheel,
  clearCanvas: _clearCanvas,
  clearArea: _clearArea,
  clearAll: _clearAll,
  redrawAll,
  setupCanvas
} = useInfiniteCanvas({
  initialStrokes: props.initialMetadata?.strokes ?? [],
  lines: lines,
  onStrokeEnded: () => {
    if (strokeTimer) clearTimeout(strokeTimer);
    strokeTimer = setTimeout(() => {
      triggerRecognition();
    }, STROKE_TIMEOUT_MS);
  }
});

// ── Overlay state ──
type OverlayEntry = {
  id: number;
  latex: string;
  result: string | null;
  box: { minX: number; minY: number; maxX: number; maxY: number };
  visible: boolean;
};
const overlays = ref<OverlayEntry[]>([]);
let overlayIdCounter = 0;

onMounted(async () => {
  if (canvasRef.value) {
    setupCanvas();
  }
  // Restore scope from metadata
  if (props.initialMetadata?.scope) {
    await restoreScope(props.initialMetadata.scope);
  }
});

let lastProcessedStrokeIndex = 0;
let globalMinX = Infinity, globalMinY = Infinity, globalMaxX = -Infinity, globalMaxY = -Infinity;

function updateBounds() {
  for (let j = lastProcessedStrokeIndex; j < allStrokes.value.length; j++) {
    const s = allStrokes.value[j];
    if (!s) continue;
    for (let i = 0; i < s.x.length; i++) {
      if (s.x[i]! < globalMinX) globalMinX = s.x[i]!;
      if (s.x[i]! > globalMaxX) globalMaxX = s.x[i]!;
      if (s.y[i]! < globalMinY) globalMinY = s.y[i]!;
      if (s.y[i]! > globalMaxY) globalMaxY = s.y[i]!;
    }
  }
  lastProcessedStrokeIndex = allStrokes.value.length;
}

// ── Recognition trigger ──
async function triggerRecognition() {
  console.log("[MathNoteEditor] triggerRecognition called");
  const canvas = canvasRef.value;
  if (!canvas || !allStrokes.value.length) return;

  // 1. Calculate the global bounding box of ALL ink incrementally
  updateBounds();

  let minX = globalMinX, minY = globalMinY, maxX = globalMaxX, maxY = globalMaxY;

  // Fallback if no valid points
  if (minX === Infinity) {
    minX = 0; minY = 0;
    maxX = canvas.getBoundingClientRect().width;
    maxY = canvas.getBoundingClientRect().height;
  }

  // 2. Normalize strokes so the top-left starts at 0,0 locally
  // This ensures MyScript always processes the strokes accurately regardless of camera pan
  const normalizedStrokes = allStrokes.value.map(s => ({
    ...s,
    x: s.x.map(x => x - minX),
    y: s.y.map(y => y - minY)
  }));

  const strokeBox = pendingBounds.value
    ? { ...pendingBounds.value }
    : { minX, minY, maxX, maxY };

  // Adjust strokeBox to match normalized coordinates
  const normalizedStrokeBox = {
    minX: strokeBox.minX - minX,
    minY: strokeBox.minY - minY,
    maxX: strokeBox.maxX - minX,
    maxY: strokeBox.maxY - minY,
  };

  try {
    const outcome = await recognizeWithLocalAI(normalizedStrokes, normalizedStrokeBox, {
      width: Math.ceil(maxX - minX) || 1,
      height: Math.ceil(maxY - minY) || 1,
    });
    console.log("[MathNoteEditor] local AI outcome:", outcome);

    // Shift result bounding box back to world coordinates
    if (outcome.boundingBox) {
      outcome.boundingBox.minX += minX;
      outcome.boundingBox.minY += minY;
      outcome.boundingBox.maxX += minX;
      outcome.boundingBox.maxY += minY;
    }
    console.log("[MathNoteEditor] outcome.boundingBox:", outcome.boundingBox);

    const trimmedLatex = outcome.latex.trim();
    console.log("[MathNoteEditor] trimmedLatex:", trimmedLatex);
    // UI Feedback for low confidence/empty extraction
    if (!trimmedLatex) {
      console.warn("[MathNoteEditor] Recognition returned empty LaTeX.");
      toast.add({
        title: "Low Confidence",
        description: "Could not clearly recognize the math. Please write more clearly or try again.",
        color: "warning",
        icon: "i-heroicons-exclamation-triangle",
      });
      // Allow them to keep drawing, just don't save an empty block
      pendingBounds.value = null;
      return;
    }

    // Append line with bounding box
    lines.value = [
      ...lines.value,
      {
        latex: outcome.latex,
        expression: outcome.expression,
        result: outcome.result,
        boundingBox: outcome.boundingBox ?? strokeBox,
      },
    ];

    console.log("[MathNoteEditor] lines.value:", lines.value);

    console.log("[MathNoteEditor] outcome:", outcome);
    console.log("[MathNoteEditor] strokeBox:", strokeBox);
    console.log("[MathNoteEditor] trimmedLatex:", trimmedLatex);
    // If LaTeX ends with "=" and we have a result, redraw to show inline result
    if (trimmedLatex.endsWith("=") && outcome.result !== null) {
      requestAnimationFrame(redrawAll);
    }

    // Show overlay at the bounding box location
    showOverlay(outcome.latex, outcome.result, outcome.boundingBox ?? strokeBox);

    // Reset pending bounds for the next batch of strokes
    pendingBounds.value = null;

    // Capture scope and emit for persistence
    const scope = await getScope();
    emit("update", {
      lines: lines.value,
      scope,
      strokes: allStrokes.value,
    });
  } catch (err) {
    console.error("[MathNoteEditor] Recognition failed:", err);
  }
}

/** Manual trigger button (alternative to auto-timeout). */
function onRecognizeClick() {
  if (strokeTimer) clearTimeout(strokeTimer);
  triggerRecognition();
}

function clearCanvas() {
  lines.value = [];
  overlays.value = [];
  _clearCanvas();
  lastProcessedStrokeIndex = 0;
  globalMinX = Infinity; globalMinY = Infinity; globalMaxX = -Infinity; globalMaxY = -Infinity;
}

function clearAll() {
  clearCanvas();
  _clearAll();
  emit("update", { lines: [], scope: {}, strokes: [] });
}

/**
 * Clear Area — erases only strokes that intersect the current pending stroke region.
 * Automatically recalculates and shrinks bounds.
 */
function clearArea() {
  _clearArea();
  lastProcessedStrokeIndex = 0;
  globalMinX = Infinity; globalMinY = Infinity; globalMaxX = -Infinity; globalMaxY = -Infinity;

  // Capture updated state and emit
  getScope().then((scope) => {
    emit("update", {
      lines: lines.value,
      scope,
      strokes: allStrokes.value,
    });
  });
}

// ── Overlay management ──

/** Show a brief KaTeX overlay at the given bounding box. */
function showOverlay(
  latex: string,
  result: string | null,
  box: { minX: number; minY: number; maxX: number; maxY: number }
) {
  const id = ++overlayIdCounter;
  overlays.value.push({ id, latex, result, box, visible: true });

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    const entry = overlays.value.find((o) => o.id === id);
    if (entry) entry.visible = false;
    // Remove from DOM after fade-out transition
    setTimeout(() => {
      overlays.value = overlays.value.filter((o) => o.id !== id);
    }, 500);
  }, 4000);
}

/** Render a LaTeX string to HTML using KaTeX (falls back to raw text). */
function renderLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return latex;
  }
}

// ── UI State ──
const isExpressionsCollapsed = ref(true);
</script>

<template>
  <div class="math-note-editor flex flex-col gap-3 h-full">
    <!-- Toolbar -->
    <SharedNoteToolbar :is-fullscreen="isFullscreen" @toggleFullscreen="emit('toggle-fullscreen')"
      @delete="emit('delete')">
      <shared-note-toolbar-button variant="primary" :disabled="isRecognizing" @click="onRecognizeClick"
        :title="isRecognizing ? 'Solving...' : 'Solve Math'"
        :icon="isRecognizing ? 'i-lucide-loader' : 'i-lucide-calculator'" />

      <div class="w-px h-6 bg-surface-strong mx-1 shrink-0" />

      <shared-note-toolbar-button :disabled="!pendingBounds" @click="clearArea" icon="i-heroicons-scissors"
        title="Clear area" />

      <shared-note-toolbar-button @click="clearCanvas" icon="i-heroicons-sparkles" title="Clear canvas" />

      <shared-note-toolbar-button @click="clearAll" variant="danger" icon="i-heroicons-arrow-path" title="Reset all" />
    </SharedNoteToolbar>

    <!-- Error banner -->
    <div v-if="recognitionError" class="rounded-[var(--radius-md)] bg-error/10 px-3 py-2 text-sm text-error mx-2">
      {{ recognitionError.message }}
    </div>

    <!-- Canvas with overlay layer -->
    <SharedNoteContentArea :style="edgeGlowStyle">
      <!-- @wheel MUST NOT be .passive because we call e.preventDefault() -->
      <canvas ref="canvasRef" class="w-full h-full touch-none" style="cursor: crosshair;" @pointerdown="startStroke"
        @pointermove="continueStroke" @pointerup="endStroke" @pointerleave="endStroke" @wheel="onWheel" />

      <!-- Recognition-in-progress overlay -->
      <div v-if="isRecognizing || isDownloading"
        class="absolute inset-0 flex flex-col items-center justify-center rounded-[var(--radius-lg)] bg-background/70 backdrop-blur-sm dark:bg-surface/90 z-10 transition-opacity">
        <div class="flex items-center gap-2 mb-2">
          <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-primary animate-pulse" />
          <span class="text-sm font-medium text-content-on-surface">
            {{ isDownloading ? "Fetching local AI model..." : "Recognising locally..." }}
          </span>
        </div>
        <div v-if="isDownloading && progress > 0" class="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div class="h-full bg-primary transition-all duration-300" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>

      <!-- KaTeX result overlays at bounding box positions -->
      <TransitionGroup name="overlay-fade">
        <div v-for="overlay in overlays" :key="overlay.id" v-show="overlay.visible"
          class="absolute pointer-events-none px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-success/15 border border-success/30 backdrop-blur-sm text-xs"
          :style="{
            left: `${worldToScreen(overlay.box.minX, Math.max(0, overlay.box.minY - 28)).x}px`,
            top: `${worldToScreen(overlay.box.minX, Math.max(0, overlay.box.minY - 28)).y}px`,
          }">
          <span class="text-success" v-html="renderLatex(overlay.latex)" />
          <span v-if="overlay.result !== null" class="ml-1 font-bold text-success">
            = {{ overlay.result }}
          </span>
        </div>
      </TransitionGroup>
    </SharedNoteContentArea>

    <!-- Recognised lines (KaTeX preview) - Collapsible via motion-v -->
    <div v-if="lines.length" class="space-y-2 mx-2">
      <button @click="isExpressionsCollapsed = !isExpressionsCollapsed"
        class="flex w-full items-center justify-between rounded-[var(--radius-md)] bg-surface-subtle hover:bg-surface-strong px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-secondary transition-colors">
        <span>Recognised expressions ({{ lines.length }})</span>
        <UIcon :name="isExpressionsCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
          class="h-4 w-4 transition-transform duration-200" />
      </button>

      <!-- Motion container -->
      <motion.div :animate="isExpressionsCollapsed ? 'collapsed' : 'open'" :variants="{
        open: { opacity: 1, height: 'auto', marginTop: '8px' },
        collapsed: { opacity: 0, height: 0, marginTop: '0px' }
      }" :transition="{ type: 'spring', bounce: 0, duration: 0.4 }" class="overflow-hidden">
        <div class="space-y-2 pb-1 overflow-y-auto max-h-60 pr-1">
          <div v-for="(line, idx) in lines" :key="idx"
            class="flex items-baseline gap-3 rounded-[var(--radius-md)] border border-secondary bg-surface px-3 py-2 font-mono text-sm">
            <!-- LaTeX preview rendered via KaTeX -->
            <span class="flex-1 text-content-on-surface" v-html="renderLatex(line.latex)" />
            <span v-if="line.result !== null" class="font-bold text-success">
              = {{ line.result }}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
    <!-- <WorkspaceEditor /> -->
  </div>
</template>

<style scoped>
/* Overlay fade transition */
.overlay-fade-enter-active {
  transition: all 0.3s ease-out;
}

.overlay-fade-leave-active {
  transition: all 0.5s ease-in;
}

.overlay-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.overlay-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
