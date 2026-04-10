<script setup lang="ts">
import Konva from "konva";
import { useCanvasHistory } from "~/composables/ui/useCanvasHistory";
import type { CanvasShape, CanvasNoteMetadata } from "@@/shared/utils/note.contract";

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

// ── State ──
// Use JSON.parse(JSON.stringify) to strip Vue proxies to prevent DataCloneError on structuredClone
const shapes = shallowRef<CanvasShape[]>(
  JSON.parse(JSON.stringify(props.initialMetadata?.shapes ?? []))
);
const selectedShapeId = ref<string | null>(null);
const activeTool = ref<"select" | "hand" | "rect" | "circle" | "line" | "arrow" | "text" | "freedraw">("select");

const fillColor = ref("#3b82f6");
const strokeColor = ref("#1e293b");
const strokeWidthState = ref(2);
const strokeDashState = ref<number[] | undefined>(undefined);

// ── Stage Viewport (Infinite Canvas) ──
const stageScale = ref(1);
const stagePosition = ref({ x: 0, y: 0 });

// ── Refs ──
const stageRef = ref<any>(null);
const transformerRef = ref<any>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const stageSize = ref({ width: 800, height: 400 });

// ── History ──
const { canUndo, canRedo, pushState, undo, redo } = useCanvasHistory(
  props.initialMetadata?.shapes ?? []
);

// ── Context menu ──
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  shapeId: null as string | null,
});

// ── Drawing state ──
let isDrawing = false;
let drawStart = { x: 0, y: 0 };
let currentDrawId: string | null = null;
let freeDrawPoints: number[] = [];

// ── Auto-save ──
const SAVE_TIMEOUT_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (!selectedShapeId.value) return;
  const idx = shapes.value.findIndex((s) => s.id === selectedShapeId.value);
  if (idx !== -1 && shapes.value[idx]) {
    Object.assign(shapes.value[idx], overrides);
    triggerRef(shapes);
    commitState();
  }
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

// ── Canvas sizing ──
onMounted(() => {
  if (containerRef.value) {
    const windowHeight = window.innerHeight;
    const rect = containerRef.value.getBoundingClientRect();
    // Default to a 60vh canvas size, to give plenty of space
    stageSize.value = { width: rect.width, height: Math.max(windowHeight * 0.6, 400) };
  }
});

// Window resize listener
onMounted(() => {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === containerRef.value) {
        stageSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    }
  });
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  onUnmounted(() => {
    resizeObserver.disconnect();
  });
});

// ── ID generation ──
let idCounter = Date.now();
function genId(): string {
  return `shape-${idCounter++}`;
}

// ── Shape defaults ──
function makeShape(type: CanvasShape["type"], overrides: Partial<CanvasShape> = {}): CanvasShape {
  return {
    id: genId(),
    type,
    x: 100,
    y: 100,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: type === "freedraw" || type === "line" || type === "arrow" ? undefined : fillColor.value,
    stroke: strokeColor.value,
    strokeWidth: strokeWidthState.value,
    dash: strokeDashState.value,
    opacity: 1,
    draggable: true,
    ...overrides,
  };
}

// ── Toolbar: add shapes ──
function addStar() {
  const s = makeShape("star", {
    numPoints: 5,
    innerRadius: 20,
    outerRadius: 45,
    x: 150 + Math.random() * 200,
    y: 120 + Math.random() * 150,
  });
  shapes.value.push(s);
  triggerRef(shapes);
  selectedShapeId.value = s.id;
  commitState();
  updateTransformer();
}

// ── Transformer management ──
function updateTransformer() {
  nextTick(() => {
    const tr = transformerRef.value?.getNode();
    if (!tr) return;
    const stage = tr.getStage();
    if (!stage) return;

    if (!selectedShapeId.value || activeTool.value === "hand") {
      tr.nodes([]);
      return;
    }

    const node = stage.findOne(`#${selectedShapeId.value}`);
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
  });
}

// ── Infinite Canvas: Zoom & Pan ──
function handleStageWheel(e: any) {
  e.evt.preventDefault();
  const stage = e.target.getStage();
  const oldScale = stage.scaleX();

  if (e.evt.ctrlKey || e.evt.metaKey) {
    // Zoom
    const scaleBy = 1.05;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
  
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
  
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const boundedScale = Math.max(0.1, Math.min(newScale, 10));
  
    stageScale.value = boundedScale;
    stagePosition.value = {
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale,
    };
  } else {
    // Pan
    stagePosition.value = {
      x: stage.x() - e.evt.deltaX,
      y: stage.y() - e.evt.deltaY,
    };
  }
}

function handleStageDragEnd(e: any) {
  // If the stage itself triggered dragend (Panning)
  if (e.target === e.target.getStage()) {
    stagePosition.value = {
      x: e.target.x(),
      y: e.target.y(),
    };
    return;
  }
}

// ── Stage events ──
function getRelativePointerPosition(stage: any) {
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  const pos = stage.getPointerPosition();
  return transform.point(pos);
}

function handleStageMouseDown(e: any) {
  // Close context menu
  closeContextMenu();

  const stage = e.target.getStage();

  if (activeTool.value === "hand") {
    // Hand tool disables drawing/selecting
    selectedShapeId.value = null;
    updateTransformer();
    return;
  }

  // Get pointer relative to the scaled/panned infinite canvas coordinate system
  const pos = getRelativePointerPosition(stage);

  // If using a drawing tool, start drawing
  if (activeTool.value !== "select" && activeTool.value !== "freedraw") {
    isDrawing = true;
    drawStart = { x: pos.x, y: pos.y };
    const newId = genId();
    currentDrawId = newId;

    if (activeTool.value === "rect") {
      shapes.value.push(makeShape("rect", { id: newId, x: pos.x, y: pos.y, width: 0, height: 0 }));
    } else if (activeTool.value === "circle") {
      shapes.value.push(makeShape("circle", { id: newId, x: pos.x, y: pos.y, radius: 0 }));
    } else if (activeTool.value === "line") {
      shapes.value.push(makeShape("line", { id: newId, x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], fill: undefined }));
    } else if (activeTool.value === "arrow") {
      shapes.value.push(makeShape("arrow", { id: newId, x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], fill: undefined }));
    } else if (activeTool.value === "text") {
      const s = makeShape("text", { id: newId, x: pos.x, y: pos.y, text: "Text", fontSize: 18, fontFamily: "Inter, system-ui, sans-serif", fill: strokeColor.value, stroke: undefined });
      shapes.value.push(s);
      selectedShapeId.value = newId;
      isDrawing = false;
      currentDrawId = null;
      activeTool.value = "select";
      commitState();
      updateTransformer();
    }
    triggerRef(shapes);
    return;
  }

  // Free draw tool
  if (activeTool.value === "freedraw") {
    isDrawing = true;
    const newId = genId();
    currentDrawId = newId;
    freeDrawPoints = [pos.x, pos.y];
    shapes.value.push(makeShape("freedraw", {
      id: newId,
      x: 0,
      y: 0,
      points: [...freeDrawPoints],
      fill: undefined,
      tension: 0.5,
      closed: false,
    }));
    triggerRef(shapes);
    return;
  }

  // Select tool: click on stage background → deselect
  if (e.target === stage) {
    selectedShapeId.value = null;
    updateTransformer();
    return;
  }

  // Click on transformer → do nothing
  const clickedOnTransformer = e.target.getParent()?.className === "Transformer";
  if (clickedOnTransformer) return;

  // Click on a shape → select it
  const id = e.target.id();
  if (id && shapes.value.find((s) => s.id === id)) {
    selectedShapeId.value = id;

    // Sync current tool colors to the selected shape's colors
    const shape = shapes.value.find((s) => s.id === id);
    if (shape) {
      if (shape.fill && shape.type !== "freedraw" && shape.type !== "line" && shape.type !== "arrow") {
        fillColor.value = shape.fill;
      }
      if (shape.stroke) strokeColor.value = shape.stroke;
      if (shape.strokeWidth) strokeWidthState.value = shape.strokeWidth;
      strokeDashState.value = shape.dash;
    }

  } else {
    selectedShapeId.value = null;
  }
  updateTransformer();
}

function handleStageMouseMove(e: any) {
  if (activeTool.value === "hand") return;
  if (!isDrawing || !currentDrawId) return;

  const stage = e.target.getStage();
  const pos = getRelativePointerPosition(stage);

  const idx = shapes.value.findIndex((s) => s.id === currentDrawId);
  if (idx === -1) return;

  const shape = shapes.value[idx];
  if (!shape) return;

  if (activeTool.value === "rect") {
    shape.width = Math.abs(pos.x - drawStart.x);
    shape.height = Math.abs(pos.y - drawStart.y);
    shape.x = Math.min(pos.x, drawStart.x);
    shape.y = Math.min(pos.y, drawStart.y);
  } else if (activeTool.value === "circle") {
    const dx = pos.x - drawStart.x;
    const dy = pos.y - drawStart.y;
    shape.radius = Math.sqrt(dx * dx + dy * dy);
    shape.x = drawStart.x;
    shape.y = drawStart.y;
  } else if (activeTool.value === "line" || activeTool.value === "arrow") {
    shape.points = [drawStart.x, drawStart.y, pos.x, pos.y];
  } else if (activeTool.value === "freedraw") {
    freeDrawPoints.push(pos.x, pos.y);
    shape.points = [...freeDrawPoints];
  }

  triggerRef(shapes);
}

function handleStageMouseUp() {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentDrawId) {
    selectedShapeId.value = currentDrawId;
    currentDrawId = null;
    // Switch back to select for rect/circle/line/arrow (not freedraw)
    if (activeTool.value !== "freedraw") {
      activeTool.value = "select";
    }
    commitState();
    updateTransformer();
  }
}

// ── Shape events ──
function handleShapeDragEnd(e: any) {
  const id = e.target.id();
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx === -1 || !shapes.value[idx]) return;

  shapes.value[idx].x = e.target.x();
  shapes.value[idx].y = e.target.y();
  triggerRef(shapes);
  commitState();
}

function handleTransformEnd(e: any) {
  const id = e.target.id();
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx === -1 || !shapes.value[idx]) return;

  const shape = shapes.value[idx];
  const node = e.target;
  
  shape.x = node.x();
  shape.y = node.y();
  shape.rotation = node.rotation();
  shape.scaleX = node.scaleX();
  shape.scaleY = node.scaleY();

  // For rect, bake scale into width/height to avoid styling stretch artifacts
  if (shape.type === "rect" && shape.width && shape.height) {
    shape.width = node.width() * node.scaleX();
    shape.height = node.height() * node.scaleY();
    shape.scaleX = 1;
    shape.scaleY = 1;
  }

  // Same for circle
  if (shape.type === "circle" && shape.radius) {
    shape.radius = node.radius() * Math.max(node.scaleX(), node.scaleY());
    shape.scaleX = 1;
    shape.scaleY = 1;
  }

  triggerRef(shapes);
  commitState();
}

// ── Double-click text editing ──
function handleDblClick(e: any) {
  const id = e.target.id();
  const shape = shapes.value.find((s) => s.id === id);
  if (!shape || shape.type !== "text") return;

  const textNode = e.target;
  const stage = textNode.getStage();
  const stageBox = stage.container().getBoundingClientRect();
  const textPosition = textNode.getAbsolutePosition(); // Handles stage pan/zoom !

  const input = document.createElement("textarea");
  document.body.appendChild(input);

  input.value = shape.text || "";
  input.style.position = "absolute";
  input.style.top = `${stageBox.top + textPosition.y}px`;
  input.style.left = `${stageBox.left + textPosition.x}px`;
  // Width needs to account for stage scaling + text node scaling
  const effectiveScale = textNode.scaleX() * stage.scaleX();
  input.style.width = `${Math.max(textNode.width() * effectiveScale, 100)}px`;
  input.style.fontSize = `${(shape.fontSize || 18) * effectiveScale}px`;
  input.style.fontFamily = shape.fontFamily || "Inter, system-ui, sans-serif";
  input.style.border = "2px solid #3b82f6";
  input.style.borderRadius = "4px";
  input.style.padding = "4px";
  input.style.margin = "0";
  input.style.outline = "none";
  input.style.resize = "none";
  input.style.background = "white";
  input.style.color = shape.fill || "#1e293b";
  input.style.zIndex = "9999";
  input.style.lineHeight = "1.2";

  input.focus();

  const removeInput = () => {
    if (!document.body.contains(input)) return;
    const newText = input.value;
    document.body.removeChild(input);
    const idx = shapes.value.findIndex((s) => s.id === id);
    if (idx !== -1 && shapes.value[idx]) {
      shapes.value[idx].text = newText;
      triggerRef(shapes);
      commitState();
      updateTransformer(); // refresh bounding box handler
    }
  };

  input.addEventListener("blur", removeInput);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" || (ev.key === "Enter" && !ev.shiftKey)) {
      ev.preventDefault();
      input.blur();
    }
  });

  // Temporarily hide the text node while editing
  textNode.hide();
  const recoverOriginalText = () => { textNode.show(); stage.draw(); }
  input.addEventListener("blur", recoverOriginalText);
}

// ── Context Menu ──
function handleContextMenu(e: any) {
  e.evt.preventDefault();
  const id = e.target.id();
  if (!id || !shapes.value.find((s) => s.id === id)) return;

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();
  const stageBox = stage.container().getBoundingClientRect();

  contextMenu.value = {
    visible: true,
    x: stageBox.left + pointer.x,
    y: stageBox.top + pointer.y,
    shapeId: id,
  };

  if (activeTool.value !== "hand") {
    selectedShapeId.value = id;
    updateTransformer();
  }
}

function bringToFront() {
  const id = contextMenu.value.shapeId;
  if (!id) return;
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const item = shapes.value[idx]!;
  const updated = shapes.value.filter((_, i) => i !== idx);
  updated.push(item);
  shapes.value = updated;
  contextMenu.value.visible = false;
  commitState();
}

function bringForward() {
  const id = contextMenu.value.shapeId;
  if (!id) return;
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx === -1 || idx === shapes.value.length - 1) return;
  const updated = [...shapes.value];
  [updated[idx], updated[idx + 1]] = [updated[idx + 1]!, updated[idx]!];
  shapes.value = updated;
  contextMenu.value.visible = false;
  commitState();
}

function sendBackward() {
  const id = contextMenu.value.shapeId;
  if (!id) return;
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx <= 0) return;
  const updated = [...shapes.value];
  [updated[idx - 1], updated[idx]] = [updated[idx]!, updated[idx - 1]!];
  shapes.value = updated;
  contextMenu.value.visible = false;
  commitState();
}

function sendToBack() {
  const id = contextMenu.value.shapeId;
  if (!id) return;
  const idx = shapes.value.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const item = shapes.value[idx]!;
  const updated = shapes.value.filter((_, i) => i !== idx);
  updated.unshift(item);
  shapes.value = updated;
  contextMenu.value.visible = false;
  commitState();
}

function duplicateShape() {
  const id = contextMenu.value.shapeId || selectedShapeId.value;
  if (!id) return;
  const original = shapes.value.find((s) => s.id === id);
  if (!original) return;
  const dup: CanvasShape = { ...JSON.parse(JSON.stringify(original)), id: genId(), x: (original.x || 0) + 30, y: (original.y || 0) + 30 };
  shapes.value.push(dup);
  triggerRef(shapes);
  selectedShapeId.value = dup.id;
  contextMenu.value.visible = false;
  commitState();
  updateTransformer();
}

function deleteSelected() {
  const id = contextMenu.value.shapeId || selectedShapeId.value;
  if (!id) return;
  shapes.value = shapes.value.filter((s) => s.id !== id);
  selectedShapeId.value = null;
  contextMenu.value.visible = false;
  commitState();
  updateTransformer();
}

// ── Undo / Redo ──
function handleUndo() {
  const state = undo();
  if (state) {
    shapes.value = state;
    selectedShapeId.value = null;
    updateTransformer();
    scheduleAutoSave();
  }
}

function handleRedo() {
  const state = redo();
  if (state) {
    shapes.value = state;
    selectedShapeId.value = null;
    updateTransformer();
    scheduleAutoSave();
  }
}

// ── Keyboard shortcuts ──
defineShortcuts({
  meta_z: () => handleUndo(),
  meta_shift_z: () => handleRedo(),
  meta_d: () => duplicateShape(),
  delete: () => {
    if (selectedShapeId.value) deleteSelected();
  },
  backspace: () => {
    if (selectedShapeId.value) deleteSelected();
  },
  escape: () => {
    selectedShapeId.value = null;
    activeTool.value = "select";
    updateTransformer();
  }
});

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
    draggable: activeTool.value === "select" && shape.draggable,
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

// ── Color presets ──
const colorPresets = [
  "transparent", "#1e293b", "#64748b", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];
const borderStyles = [
  { label: 'Solid', dash: undefined },
  { label: 'Dashed', dash: [10, 5] },
  { label: 'Dotted', dash: [2, 4] },
]
const borderThickness = [
  { label: '1px', width: 1 },
  { label: '3px', width: 3 },
  { label: '5px', width: 5 },
]

// ── Floating Toolbar config (Dropdowns) ──
const borderThicknessItems = computed<any[][]>(() => [[
  ...borderThickness.map((b) => ({
    label: b.label,
    onSelect: () => setStrokeWidth(b.width),
  }))
]]);

const borderStyleItems = computed<any[][]>(() => [[
  ...borderStyles.map((b) => ({
    label: b.label,
    onSelect: () => setStrokeDash(b.dash),
  }))
]]);

// ── Tool items ──
const tools = [
  { id: "select", label: "Select", icon: "i-heroicons-cursor-arrow-rays" },
  { id: "hand", label: "Pan/Zoom Camera", icon: "i-heroicons-hand-raised" },
  { id: "rect", label: "Rectangle", icon: "i-heroicons-stop" },
  { id: "circle", label: "Circle", icon: "i-heroicons-sun" },
  { id: "line", label: "Line", icon: "i-heroicons-minus" },
  { id: "arrow", label: "Arrow", icon: "i-heroicons-arrow-up-right" },
  { id: "text", label: "Text", icon: "i-heroicons-language" },
  { id: "freedraw", label: "Draw", icon: "i-heroicons-pencil" },
] as const;

// Close context menu on outside click
function closeContextMenu() {
  if (contextMenu.value) {
    contextMenu.value.visible = false;
  }
}

// Fullscreen resize handling
watch(() => props.isFullscreen, () => {
  setTimeout(() => {
    // Re-evaluate container size after a tick to let DOM settle after fullscreen transition
    if (containerRef.value) {
      const rect = containerRef.value.getBoundingClientRect();
      stageSize.value = { width: rect.width, height: Math.max(window.innerHeight * 0.6, 400) };
    }
  }, 100);
});

function toggleFullscreenLocal() {
  emit('toggle-fullscreen');
}

</script>

<template>
  <div class="canvas-note-editor flex flex-col gap-2 h-full w-full" @click="closeContextMenu">
    <!-- Toolbar -->
    <SharedNoteToolbar :is-fullscreen="isFullscreen" @toggleFullscreen="toggleFullscreenLocal" @delete="emit('delete')">
      <!-- Shape tools -->
      <div class="flex items-center gap-0.5 mr-2">
        <shared-note-toolbar-button v-for="tool in tools" :key="tool.id" :title="tool.label"
          :active="activeTool === tool.id" :icon="tool.icon" @click="activeTool = tool.id" />

        <!-- Star button -->
        <shared-note-toolbar-button title="Star" icon="i-heroicons-star" @click="addStar" />
      </div>

      <div class="w-px h-6 bg-surface-strong shrink-0" />

      <!-- Action buttons -->
      <div class="flex items-center gap-0.5">
        <!-- Undo / Redo -->
        <shared-note-toolbar-button title="Undo" :shortcuts="['meta', 'z']" :disabled="!canUndo" icon="i-heroicons-arrow-uturn-left" @click="handleUndo" />
        <shared-note-toolbar-button title="Redo" :shortcuts="['meta', 'shift', 'z']" :disabled="!canRedo" icon="i-heroicons-arrow-uturn-right" @click="handleRedo" />

        <!-- Delete selected -->
        <shared-note-toolbar-button title="Delete selected" :shortcuts="['delete']" variant="danger" :disabled="!selectedShapeId" icon="i-heroicons-trash" @click="deleteSelected" />

        <!-- Duplicate -->
        <shared-note-toolbar-button title="Duplicate" :shortcuts="['meta', 'd']" :disabled="!selectedShapeId" icon="i-heroicons-document-duplicate" @click="duplicateShape" />
      </div>

      <div class="w-px h-6 bg-slate-300 dark:bg-slate-600 shrink-0" />

      <!-- Style Controls (Colors, Border) -->
      <div class="flex items-center gap-1.5">
        <!-- Fill Color Popover -->
        <UPopover :popper="{ arrow: true }">
          <shared-note-toolbar-button title="Fill Color" :icon-only="true">
            <div class="w-4 h-4 rounded-sm border border-slate-300 bg-white"
              :style="{ backgroundColor: fillColor === 'transparent' ? '#fff' : fillColor }">
              <UIcon v-if="fillColor === 'transparent'" name="i-heroicons-x-mark"
                class="w-full h-full text-slate-400" />
            </div>
          </shared-note-toolbar-button>
          <template #content>
            <div class="p-2 grid grid-cols-5 gap-1.5">
              <button v-for="color in colorPresets" :key="'fill' + color" :title="`Fill: ${color}`"
                class="w-6 h-6 rounded-full border-2 transition-transform duration-100 hover:scale-110 flex items-center justify-center"
                :class="fillColor === color ? 'border-indigo-500 scale-110' : 'border-slate-300 dark:border-slate-600 text-slate-400'"
                :style="{ backgroundColor: color === 'transparent' ? '#fff' : color }" @click="setFillColor(color)">
                <UIcon v-if="color === 'transparent'" name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </div>
          </template>
        </UPopover>

        <!-- Stroke Color Popover -->
        <UPopover :popper="{ arrow: true }">
          <shared-note-toolbar-button title="Border Color" :icon-only="true">
            <div class="w-4 h-4 rounded-sm border-2"
              :style="{ borderColor: strokeColor === 'transparent' ? '#cbd5e1' : strokeColor, backgroundColor: 'transparent' }">
              <UIcon v-if="strokeColor === 'transparent'" name="i-heroicons-x-mark"
                class="w-full h-full text-slate-400" />
            </div>
          </shared-note-toolbar-button>
          <template #content>
            <div class="p-2 grid grid-cols-5 gap-1.5 flex-col">
              <button v-for="color in colorPresets" :key="'stroke' + color" :title="`Border: ${color}`"
                class="w-6 h-6 rounded-full border-2 transition-transform duration-100 hover:scale-110 flex items-center justify-center"
                :class="strokeColor === color ? 'border-indigo-500 scale-110' : 'border-slate-300 dark:border-slate-600 text-slate-400'"
                :style="{ backgroundColor: color === 'transparent' ? '#fff' : color }" @click="setStrokeColor(color)">
                <UIcon v-if="color === 'transparent'" name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </div>
          </template>
        </UPopover>

        <div class="w-px h-6 bg-slate-300 dark:bg-surface-strong mx-1" />

        <!-- Stroke width and style togglers -->
        <UDropdownMenu :items="borderThicknessItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
          <shared-note-toolbar-button title="Border Thickness" icon="i-lucide-hash" />
        </UDropdownMenu>
        <UDropdownMenu :items="borderStyleItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
          <shared-note-toolbar-button title="Border Style" icon="i-lucide-activity" />
        </UDropdownMenu>
      </div>
    </SharedNoteToolbar>

    <!-- Konva Stage Space -->
    <div ref="containerRef"
      class="relative flex-1 min-h-[400px] w-full rounded-lg border border-slate-200 bg-white shadow-inner overflow-hidden cursor-crosshair"
      :class="{ 'cursor-grab': activeTool === 'hand' }">
      <ClientOnly>
        <v-stage ref="stageRef"
          :config="{ width: stageSize.width, height: stageSize.height, scaleX: stageScale, scaleY: stageScale, x: stagePosition.x, y: stagePosition.y, draggable: activeTool === 'hand' }"
          @mousedown="handleStageMouseDown" @touchstart="handleStageMouseDown" @mousemove="handleStageMouseMove"
          @touchmove="handleStageMouseMove" @mouseup="handleStageMouseUp" @touchend="handleStageMouseUp"
          @wheel="handleStageWheel" @dragend="handleStageDragEnd">
          <v-layer>
            <component v-for="shape in shapes" :is="konvaComponent(shape.type)" :key="shape.id"
              :config="getShapeConfig(shape)" @dragend="handleShapeDragEnd" @transformend="handleTransformEnd"
              @contextmenu="handleContextMenu" @dblclick="handleDblClick" />
            <v-transformer ref="transformerRef" />
          </v-layer>
        </v-stage>
      </ClientOnly>

      <!-- Zoom Map / Info corner -->
      <div
        class="absolute bottom-2 left-2 px-2 py-1 bg-white/80 rounded text-xs font-medium text-content-on-surface shadow pointer-events-none select-none backdrop-blur-sm">
        {{ Math.round(stageScale * 100) }}% | Use Hand mode to pan
      </div>
    </div>

    <!-- Context Menu (teleported to body) -->
    <Teleport to="body">
      <div v-if="contextMenu.visible"
        class="fixed z-[9999] min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 py-1 animate-in fade-in zoom-in-95 duration-100"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="bringToFront">
          <UIcon name="i-heroicons-arrow-up" class="w-4 h-4" /> Bring to Front
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="bringForward">
          <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" /> Bring Forward
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="sendBackward">
          <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" /> Send Backward
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="sendToBack">
          <UIcon name="i-heroicons-arrow-down" class="w-4 h-4" /> Send to Back
        </button>
        <div class="my-1 h-px bg-slate-200 dark:bg-slate-700" />
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="duplicateShape">
          <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" /> Duplicate
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
          @click="deleteSelected">
          <UIcon name="i-heroicons-trash" class="w-4 h-4" /> Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>
