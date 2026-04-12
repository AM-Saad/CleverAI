import { computed, nextTick, ref, triggerRef, watch, type Ref, type ShallowRef } from "vue";
import type { CanvasShape } from "@@/shared/utils/note.contract";
import {
  boundsFromPoints,
  boundsIntersect,
  buildSnapGuides,
  clampNumber,
  findClosestSnapMatch,
  getBoundsPositions,
  getShapeBounds,
  getSnapStops,
  normalizeShapeTransform,
  type BoundsRect,
  type GuideLine,
} from "~/utils/canvas/geometry";

export type CanvasTool =
  | "select"
  | "hand"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "freedraw"
  | "star";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  shapeId: string | null;
}

interface StagePosition {
  x: number;
  y: number;
}

interface SelectionRectState {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseCanvasStageInteractionsOptions {
  shapes: ShallowRef<CanvasShape[]>;
  fillColor: Ref<string>;
  strokeColor: Ref<string>;
  strokeWidth: Ref<number>;
  strokeDash: Ref<number[] | undefined>;
  stageScale: Ref<number>;
  stagePosition: Ref<StagePosition>;
  constrainStagePosition: (position: StagePosition, scale?: number) => StagePosition;
  transformerRef: Ref<any>;
  commitState: () => void;
  snapThresholdPx: number;
  snapGuidePadding: number;
}

export function useCanvasStageInteractions(options: UseCanvasStageInteractionsOptions) {
  const selectedShapeIds = ref<string[]>([]);
  const selectedShapeId = computed<string | null>({
    get: () => selectedShapeIds.value[0] ?? null,
    set: (value) => {
      selectedShapeIds.value = value ? [value] : [];
    },
  });
  const activeTool = ref<CanvasTool>("select");
  const inputMode = ref<"mouse" | "touch">("mouse");
  const snapEnabled = ref(true);
  const snapGuides = ref<GuideLine[]>([]);
  const selectionRect = ref<SelectionRectState>({
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const contextMenu = ref<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    shapeId: null,
  });

  let isDrawing = false;
  let drawStart = { x: 0, y: 0 };
  let currentDrawId: string | null = null;
  let freeDrawPoints: number[] = [];
  let selectionStart: { x: number; y: number } | null = null;
  let selectionAdditive = false;
  let dragSelectionState: {
    leaderId: string;
    leaderStart: StagePosition;
    startPositions: Map<string, StagePosition>;
  } | null = null;
  let idCounter = Date.now();

  function genId(): string {
    return `shape-${idCounter++}`;
  }

  function clearSnapGuides() {
    if (snapGuides.value.length) {
      snapGuides.value = [];
    }
  }

  function clearSelection() {
    selectedShapeIds.value = [];
  }

  function isMultiSelectModifier(event?: Event) {
    if (!event) {
      return false;
    }

    const keyboardEvent = event as MouseEvent & KeyboardEvent;
    return Boolean(keyboardEvent.shiftKey || keyboardEvent.metaKey || keyboardEvent.ctrlKey);
  }

  function setSelection(ids: string[]) {
    selectedShapeIds.value = Array.from(new Set(ids));
  }

  function toggleShapeSelection(id: string) {
    if (selectedShapeIds.value.includes(id)) {
      selectedShapeIds.value = selectedShapeIds.value.filter((shapeId) => shapeId !== id);
      return;
    }

    selectedShapeIds.value = [...selectedShapeIds.value, id];
  }

  function getSelectionTargetIds() {
    const contextId = contextMenu.value.shapeId;
    if (selectedShapeIds.value.length) {
      if (!contextId || selectedShapeIds.value.includes(contextId)) {
        return [...selectedShapeIds.value];
      }
    }

    return contextId ? [contextId] : [];
  }

  function getSelectionOrderedIndices() {
    const targetIds = getSelectionTargetIds();
    return options.shapes.value
      .map((shape, index) => ({ id: shape.id, index }))
      .filter(({ id }) => targetIds.includes(id))
      .sort((left, right) => left.index - right.index);
  }

  function isEmptyStageTarget(target: any, stage: any) {
    return target === stage || target?.getType?.() === "Layer";
  }

  function updateSelectionRect(startX: number, startY: number, endX: number, endY: number) {
    const bounds = boundsFromPoints(startX, startY, endX, endY);
    selectionRect.value = {
      visible: true,
      x: bounds.left,
      y: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
    };
  }

  function clearSelectionRect() {
    selectionRect.value = {
      visible: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  watch(snapEnabled, (enabled) => {
    if (!enabled) {
      clearSnapGuides();
    }
  });

  function setInputModeFromEvent(event?: Event) {
    if (!event) {
      return;
    }

    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType === "touch" || event.type.startsWith("touch")) {
      inputMode.value = "touch";
      return;
    }

    if (pointerType === "mouse" || event.type.startsWith("mouse")) {
      inputMode.value = "mouse";
    }
  }

  function selectTool(toolId: string) {
    activeTool.value = toolId as CanvasTool;
  }

  function makeShape(type: CanvasShape["type"], overrides: Partial<CanvasShape> = {}): CanvasShape {
    return {
      id: genId(),
      type,
      x: 100,
      y: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fill: type === "freedraw" || type === "line" || type === "arrow" ? undefined : options.fillColor.value,
      stroke: options.strokeColor.value,
      strokeWidth: options.strokeWidth.value,
      dash: options.strokeDash.value,
      opacity: 1,
      draggable: true,
      ...overrides,
    };
  }

  function getNodeBounds(node: any): BoundsRect {
    const stage = node.getStage?.();
    const rect = node.getClientRect({ relativeTo: stage, skipShadow: true });

    return {
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };
  }

  function updateTransformer() {
    nextTick(() => {
      const transformer = options.transformerRef.value?.getNode();
      if (!transformer) {
        return;
      }

      const stage = transformer.getStage();
      if (!stage) {
        return;
      }

      if (!selectedShapeIds.value.length || activeTool.value === "hand") {
        transformer.nodes([]);
        return;
      }

      const nodes = selectedShapeIds.value
        .map((shapeId) => stage.findOne(`#${shapeId}`))
        .filter(Boolean);
      transformer.nodes(nodes);
    });
  }

  function syncDraggedSelectionNodes(node: any, leaderId: string) {
    if (!dragSelectionState || dragSelectionState.leaderId !== leaderId) {
      return;
    }

    const deltaX = node.x() - dragSelectionState.leaderStart.x;
    const deltaY = node.y() - dragSelectionState.leaderStart.y;
    const stage = node.getStage?.();

    for (const [selectedId, startPosition] of dragSelectionState.startPositions.entries()) {
      if (selectedId === leaderId) continue;
      const selectedNode = stage?.findOne?.(`#${selectedId}`);
      selectedNode?.position({
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY,
      });
    }
  }

  function handleStageWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();

    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }

      const deltaModeScale = e.evt.deltaMode === 1 ? 16 : (e.evt.deltaMode === 2 ? window.innerHeight : 1);
      const normalizedDelta = e.evt.deltaY * deltaModeScale;
      const zoomFactor = Math.exp(-normalizedDelta * 0.0015);
      const boundedScale = clampNumber(oldScale * zoomFactor, 0.1, 10);

      if (Math.abs(boundedScale - oldScale) < 0.0001) {
        return;
      }

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      options.stageScale.value = boundedScale;
      options.stagePosition.value = options.constrainStagePosition(
        {
          x: pointer.x - mousePointTo.x * boundedScale,
          y: pointer.y - mousePointTo.y * boundedScale,
        },
        boundedScale
      );
      return;
    }

    options.stagePosition.value = options.constrainStagePosition({
      x: stage.x() - e.evt.deltaX,
      y: stage.y() - e.evt.deltaY,
    });
  }

  function handleStageDragEnd(e: any) {
    if (e.target === e.target.getStage()) {
      options.stagePosition.value = options.constrainStagePosition({
        x: e.target.x(),
        y: e.target.y(),
      });
    }
  }

  function getRelativePointerPosition(stage: any) {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  }

  function syncSelectedShapeStyles(shape: CanvasShape) {
    if (shape.fill && shape.type !== "freedraw" && shape.type !== "line" && shape.type !== "arrow") {
      options.fillColor.value = shape.fill;
    }

    if (shape.stroke) {
      options.strokeColor.value = shape.stroke;
    }

    if (shape.strokeWidth) {
      options.strokeWidth.value = shape.strokeWidth;
    }

    options.strokeDash.value = shape.dash;
  }

  function handleStageMouseDown(e: any) {
    closeContextMenu();
    clearSnapGuides();
    setInputModeFromEvent(e?.evt);

    const stage = e.target.getStage();

    if (activeTool.value === "hand") {
      clearSelection();
      updateTransformer();
      return;
    }

    const pos = getRelativePointerPosition(stage);
    const additiveSelection = isMultiSelectModifier(e?.evt);

    if (activeTool.value === "text") {
      const shape = makeShape("text", {
        x: pos.x,
        y: pos.y,
        text: "Text",
        fontSize: 18,
        fontFamily: "Inter, system-ui, sans-serif",
        fill: options.strokeColor.value,
        stroke: undefined,
      });
      options.shapes.value.push(shape);
      triggerRef(options.shapes);
      selectedShapeId.value = shape.id;
      activeTool.value = "select";
      options.commitState();
      updateTransformer();
      return;
    }

    if (activeTool.value === "star") {
      const shape = makeShape("star", {
        x: pos.x,
        y: pos.y,
        numPoints: 5,
        innerRadius: 20,
        outerRadius: 45,
      });
      options.shapes.value.push(shape);
      triggerRef(options.shapes);
      selectedShapeId.value = shape.id;
      activeTool.value = "select";
      options.commitState();
      updateTransformer();
      return;
    }

    if (activeTool.value !== "select" && activeTool.value !== "freedraw") {
      isDrawing = true;
      drawStart = { x: pos.x, y: pos.y };
      const newId = genId();
      currentDrawId = newId;

      if (activeTool.value === "rect") {
        options.shapes.value.push(makeShape("rect", { id: newId, x: pos.x, y: pos.y, width: 0, height: 0 }));
      } else if (activeTool.value === "circle") {
        options.shapes.value.push(makeShape("circle", { id: newId, x: pos.x, y: pos.y, radius: 0 }));
      } else if (activeTool.value === "ellipse") {
        options.shapes.value.push(makeShape("ellipse", { id: newId, x: pos.x, y: pos.y, radiusX: 0, radiusY: 0 }));
      } else if (activeTool.value === "line") {
        options.shapes.value.push(makeShape("line", { id: newId, x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], fill: undefined }));
      } else if (activeTool.value === "arrow") {
        options.shapes.value.push(makeShape("arrow", { id: newId, x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], fill: undefined }));
      }

      triggerRef(options.shapes);
      return;
    }

    if (activeTool.value === "freedraw") {
      isDrawing = true;
      const newId = genId();
      currentDrawId = newId;
      freeDrawPoints = [pos.x, pos.y];
      options.shapes.value.push(makeShape("freedraw", {
        id: newId,
        x: 0,
        y: 0,
        points: [...freeDrawPoints],
        fill: undefined,
        tension: 0.5,
        closed: false,
      }));
      triggerRef(options.shapes);
      return;
    }

    if (isEmptyStageTarget(e.target, stage)) {
      if (activeTool.value === "select" && inputMode.value !== "touch") {
        selectionStart = pos;
        selectionAdditive = additiveSelection;
        updateSelectionRect(pos.x, pos.y, pos.x, pos.y);
        if (!selectionAdditive) {
          clearSelection();
          updateTransformer();
        }
        return;
      }

      clearSelection();
      updateTransformer();
      return;
    }

    const clickedOnTransformer = e.target.getParent()?.className === "Transformer";
    if (clickedOnTransformer) {
      return;
    }

    const id = e.target.id();
    if (id && options.shapes.value.find((shape) => shape.id === id)) {
      if (activeTool.value === "select" && additiveSelection) {
        toggleShapeSelection(id);
      } else if (selectedShapeIds.value.length > 1 && selectedShapeIds.value.includes(id)) {
        // Preserve the current multi-selection when interacting with one of its members.
      } else {
        selectedShapeId.value = id;
      }

      const shape = options.shapes.value.find((item) => item.id === id);
      if (shape) {
        syncSelectedShapeStyles(shape);
      }
    } else {
      clearSelection();
    }

    updateTransformer();
  }

  function handleShapeDragStart(e: any) {
    const leaderId = e.target.id();
    if (!leaderId || !selectedShapeIds.value.includes(leaderId) || selectedShapeIds.value.length < 2) {
      dragSelectionState = null;
      return;
    }

    const startPositions = new Map<string, StagePosition>();
    for (const shapeId of selectedShapeIds.value) {
      const shape = options.shapes.value.find((item) => item.id === shapeId);
      if (!shape) continue;
      startPositions.set(shapeId, { x: shape.x ?? 0, y: shape.y ?? 0 });
    }

    dragSelectionState = {
      leaderId,
      leaderStart: { x: e.target.x(), y: e.target.y() },
      startPositions,
    };
  }

  function handleStageMouseMove(e: any) {
    if (selectionStart) {
      const stage = e.target.getStage();
      const pos = getRelativePointerPosition(stage);
      updateSelectionRect(selectionStart.x, selectionStart.y, pos.x, pos.y);
      return;
    }

    if (activeTool.value === "hand" || !isDrawing || !currentDrawId) {
      return;
    }

    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);
    const idx = options.shapes.value.findIndex((shape) => shape.id === currentDrawId);
    if (idx === -1) {
      return;
    }

    const shape = options.shapes.value[idx];
    if (!shape) {
      return;
    }

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
    } else if (activeTool.value === "ellipse") {
      shape.radiusX = Math.abs(pos.x - drawStart.x) / 2;
      shape.radiusY = Math.abs(pos.y - drawStart.y) / 2;
      shape.x = (pos.x + drawStart.x) / 2;
      shape.y = (pos.y + drawStart.y) / 2;
    } else if (activeTool.value === "line" || activeTool.value === "arrow") {
      shape.points = [drawStart.x, drawStart.y, pos.x, pos.y];
    } else if (activeTool.value === "freedraw") {
      freeDrawPoints.push(pos.x, pos.y);
      shape.points = [...freeDrawPoints];
    }

    triggerRef(options.shapes);
  }

  function handleStageMouseUp(e?: any) {
    if (selectionStart) {
      const stage = e?.target?.getStage?.() ?? e?.target ?? null;
      // selectionRect is already normalised by updateSelectionRect → use it directly.
      // Recomputing via boundsFromPoints(start, rect.x+width) was wrong for right→left
      // and bottom→top drags because rect.x+width always equals max(start,end), making
      // the resulting bounds degenerate (zero width/height) in those directions.
      const selectionBounds: BoundsRect = {
        left: selectionRect.value.x,
        top: selectionRect.value.y,
        right: selectionRect.value.x + selectionRect.value.width,
        bottom: selectionRect.value.y + selectionRect.value.height,
      };
      const didDragSelection = selectionRect.value.width > 4 || selectionRect.value.height > 4;
      const matchedIds = didDragSelection
        ? options.shapes.value
          .filter((shape) => {
            const node = stage?.findOne?.(`#${shape.id}`);
            const bounds = node ? getNodeBounds(node) : getShapeBounds(shape);
            return boundsIntersect(selectionBounds, bounds);
          })
          .map((shape) => shape.id)
        : [];

      if (selectionAdditive) {
        setSelection([...selectedShapeIds.value, ...matchedIds]);
      } else {
        setSelection(matchedIds);
      }

      if (selectedShapeIds.value.length === 1) {
        const shape = options.shapes.value.find((item) => item.id === selectedShapeIds.value[0]);
        if (shape) {
          syncSelectedShapeStyles(shape);
        }
      }

      selectionStart = null;
      selectionAdditive = false;
      clearSelectionRect();
      updateTransformer();
      return;
    }

    if (!isDrawing) {
      return;
    }

    isDrawing = false;
    if (currentDrawId) {
      selectedShapeId.value = currentDrawId;
      currentDrawId = null;
      if (activeTool.value !== "freedraw") {
        activeTool.value = "select";
      }
      options.commitState();
      updateTransformer();
    }
  }

  function handleShapeDragMove(e: any) {
    const node = e.target;
    const shapeId = node.id();
    if (!shapeId) {
      return;
    }

    if (!snapEnabled.value || activeTool.value !== "select") {
      syncDraggedSelectionNodes(node, shapeId);
      clearSnapGuides();
      return;
    }

    const threshold = options.snapThresholdPx / Math.max(options.stageScale.value, 0.1);
    const currentBounds = getNodeBounds(node);
    const verticalMatch = findClosestSnapMatch(
      getBoundsPositions(currentBounds, "vertical"),
      getSnapStops(options.shapes.value, shapeId, "vertical"),
      threshold
    );
    const horizontalMatch = findClosestSnapMatch(
      getBoundsPositions(currentBounds, "horizontal"),
      getSnapStops(options.shapes.value, shapeId, "horizontal"),
      threshold
    );

    if (!verticalMatch && !horizontalMatch) {
      syncDraggedSelectionNodes(node, shapeId);
      clearSnapGuides();
      return;
    }

    node.position({
      x: node.x() + (verticalMatch?.diff ?? 0),
      y: node.y() + (horizontalMatch?.diff ?? 0),
    });
    syncDraggedSelectionNodes(node, shapeId);

    const snappedBounds = {
      left: currentBounds.left + (verticalMatch?.diff ?? 0),
      right: currentBounds.right + (verticalMatch?.diff ?? 0),
      top: currentBounds.top + (horizontalMatch?.diff ?? 0),
      bottom: currentBounds.bottom + (horizontalMatch?.diff ?? 0),
    };

    snapGuides.value = buildSnapGuides(snappedBounds, verticalMatch, horizontalMatch, options.snapGuidePadding);
  }

  function handleShapeDragEnd(e: any) {
    const id = e.target.id();
    const stage = e.target.getStage?.();

    if (dragSelectionState && dragSelectionState.leaderId === id) {
      for (const selectedId of selectedShapeIds.value) {
        const idx = options.shapes.value.findIndex((shape) => shape.id === selectedId);
        if (idx === -1 || !options.shapes.value[idx]) continue;

        const node = stage?.findOne?.(`#${selectedId}`);
        if (!node) continue;

        options.shapes.value[idx].x = node.x();
        options.shapes.value[idx].y = node.y();
      }
      dragSelectionState = null;
    } else {
      const idx = options.shapes.value.findIndex((shape) => shape.id === id);
      if (idx === -1 || !options.shapes.value[idx]) {
        return;
      }

      options.shapes.value[idx].x = e.target.x();
      options.shapes.value[idx].y = e.target.y();
    }

    clearSnapGuides();
    triggerRef(options.shapes);
    options.commitState();
  }

  function handleTransformEnd(e: any) {
    const stage = e.target.getStage?.();
    // Konva fires `transformend` on EACH individual node when a multi-selection is
    // transformed.  Processing all selectedShapeIds on every event causes N² normalise
    // passes (e.g. 3 selected → 9 normalise calls) and produces wrong/random sizes.
    // Each event is responsible only for its own target; collectively all shapes are
    // normalised exactly once.
    const transformTargetIds = [e.target.id()];

    let didUpdate = false;

    for (const targetId of transformTargetIds) {
      const idx = options.shapes.value.findIndex((shape) => shape.id === targetId);
      if (idx === -1 || !options.shapes.value[idx]) {
        continue;
      }

      const node = stage?.findOne?.(`#${targetId}`) ?? (targetId === e.target.id() ? e.target : null);
      if (!node) {
        continue;
      }

      const shape = options.shapes.value[idx];
      shape.x = node.x();
      shape.y = node.y();
      shape.rotation = node.rotation();
      normalizeShapeTransform(shape, node);
      didUpdate = true;
    }

    if (!didUpdate) {
      return;
    }

    clearSnapGuides();
    triggerRef(options.shapes);
    options.commitState();
    // Re-attach transformer to the freshly-normalised nodes so its internal
    // reference frame is correct for the next potential transform.
    updateTransformer();
  }

  function handleDblClick(e: any) {
    const id = e.target.id();
    const shape = options.shapes.value.find((item) => item.id === id);
    if (!shape || shape.type !== "text") {
      return;
    }

    const textNode = e.target;
    const stage = textNode.getStage();
    const stageBox = stage.container().getBoundingClientRect();
    const textPosition = textNode.getAbsolutePosition();

    const input = document.createElement("textarea");
    document.body.appendChild(input);

    input.value = shape.text || "";
    input.style.position = "absolute";
    input.style.top = `${stageBox.top + textPosition.y}px`;
    input.style.left = `${stageBox.left + textPosition.x}px`;
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
      if (!document.body.contains(input)) {
        return;
      }

      const newText = input.value;
      document.body.removeChild(input);
      const idx = options.shapes.value.findIndex((item) => item.id === id);
      if (idx !== -1 && options.shapes.value[idx]) {
        options.shapes.value[idx].text = newText;
        triggerRef(options.shapes);
        options.commitState();
        updateTransformer();
      }
    };

    input.addEventListener("blur", removeInput);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        input.blur();
      }
    });

    textNode.hide();
    const recoverOriginalText = () => {
      textNode.show();
      stage.draw();
    };
    input.addEventListener("blur", recoverOriginalText);
  }

  function handleContextMenu(e: any) {
    e.evt.preventDefault();
    const id = e.target.id();
    if (!id || !options.shapes.value.find((shape) => shape.id === id)) {
      return;
    }

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const stageBox = stage.container().getBoundingClientRect();
    contextMenu.value = {
      visible: true,
      x: stageBox.left + pointer.x,
      y: stageBox.top + pointer.y,
      shapeId: id,
    };

    if (activeTool.value !== "hand") {
      if (!selectedShapeIds.value.includes(id)) {
        selectedShapeId.value = id;
      }
      updateTransformer();
    }
  }

  function bringToFront() {
    const selectedIndices = getSelectionOrderedIndices();
    if (!selectedIndices.length) {
      return;
    }

    const selectionIds = new Set(selectedIndices.map(({ id }) => id));
    const selectedItems = selectedIndices.map(({ index }) => options.shapes.value[index]!);
    const updated = options.shapes.value.filter((shape) => !selectionIds.has(shape.id));
    updated.push(...selectedItems);
    options.shapes.value = updated;
    contextMenu.value.visible = false;
    options.commitState();
  }

  function bringForward() {
    const selectedIndices = getSelectionOrderedIndices();
    if (!selectedIndices.length) {
      return;
    }

    const updated = [...options.shapes.value];
    for (let index = selectedIndices.length - 1; index >= 0; index -= 1) {
      const currentIndex = selectedIndices[index]!.index;
      if (currentIndex >= updated.length - 1) continue;
      if (selectedIndices.some(({ index: selectedIndex }) => selectedIndex === currentIndex + 1)) continue;
      [updated[currentIndex], updated[currentIndex + 1]] = [updated[currentIndex + 1]!, updated[currentIndex]!];
      for (const selected of selectedIndices) {
        if (selected.index === currentIndex) {
          selected.index += 1;
        } else if (selected.index === currentIndex + 1) {
          selected.index -= 1;
        }
      }
    }
    options.shapes.value = updated;
    contextMenu.value.visible = false;
    options.commitState();
  }

  function sendBackward() {
    const selectedIndices = getSelectionOrderedIndices();
    if (!selectedIndices.length) {
      return;
    }

    const updated = [...options.shapes.value];
    for (let index = 0; index < selectedIndices.length; index += 1) {
      const currentIndex = selectedIndices[index]!.index;
      if (currentIndex <= 0) continue;
      if (selectedIndices.some(({ index: selectedIndex }) => selectedIndex === currentIndex - 1)) continue;
      [updated[currentIndex - 1], updated[currentIndex]] = [updated[currentIndex]!, updated[currentIndex - 1]!];
      for (const selected of selectedIndices) {
        if (selected.index === currentIndex) {
          selected.index -= 1;
        } else if (selected.index === currentIndex - 1) {
          selected.index += 1;
        }
      }
    }
    options.shapes.value = updated;
    contextMenu.value.visible = false;
    options.commitState();
  }

  function sendToBack() {
    const selectedIndices = getSelectionOrderedIndices();
    if (!selectedIndices.length) {
      return;
    }

    const selectionIds = new Set(selectedIndices.map(({ id }) => id));
    const selectedItems = selectedIndices.map(({ index }) => options.shapes.value[index]!);
    const updated = options.shapes.value.filter((shape) => !selectionIds.has(shape.id));
    updated.unshift(...selectedItems);
    options.shapes.value = updated;
    contextMenu.value.visible = false;
    options.commitState();
  }

  function duplicateShape() {
    const targetIds = getSelectionTargetIds();
    if (!targetIds.length) {
      return;
    }

    const originals = options.shapes.value.filter((shape) => targetIds.includes(shape.id));
    const duplicates = originals.map((original, index) => ({
      ...JSON.parse(JSON.stringify(original)),
      id: genId(),
      x: (original.x || 0) + 30 + index * 8,
      y: (original.y || 0) + 30 + index * 8,
    } satisfies CanvasShape));

    options.shapes.value.push(...duplicates);
    triggerRef(options.shapes);
    setSelection(duplicates.map((shape) => shape.id));
    contextMenu.value.visible = false;
    options.commitState();
    updateTransformer();
  }

  function deleteSelected() {
    const targetIds = getSelectionTargetIds();
    if (!targetIds.length) {
      return;
    }

    options.shapes.value = options.shapes.value.filter((shape) => !targetIds.includes(shape.id));
    clearSelection();
    contextMenu.value.visible = false;
    options.commitState();
    updateTransformer();
  }

  function closeContextMenu() {
    contextMenu.value.visible = false;
  }

  return {
    activeTool,
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
    snapEnabled,
    snapGuides,
    bringForward,
    bringToFront,
    clearSelection,
    sendBackward,
    sendToBack,
    updateTransformer,
  };
}