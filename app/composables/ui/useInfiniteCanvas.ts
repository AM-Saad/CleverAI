import { ref, computed, type Ref } from 'vue';
import type { MathNoteMetadata } from '@@/shared/utils/note.contract';

export type InkStroke = { x: number[]; y: number[]; t: number[]; id: number };

export interface UseInfiniteCanvasOptions {
  initialStrokes?: InkStroke[];
  lines?: Ref<MathNoteMetadata["lines"]>;
  onStrokeEnded?: () => void;
}

export function useInfiniteCanvas(options: UseInfiniteCanvasOptions = {}) {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const ctx = ref<CanvasRenderingContext2D | null>(null);
  
  const allStrokes = ref<InkStroke[]>(options.initialStrokes ?? []);
  let activeStroke: InkStroke | null = null;
  let nextStrokeId = (options.initialStrokes?.length ?? 0);
  
  const isDrawing = ref(false);
  const camera = ref({ x: 0, y: 0, scale: 1 });
  
  const pendingBounds = ref<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const CROP_PADDING = 16;
  
  const edgeGlow = ref({ top: false, bottom: false, left: false, right: false });

  const edgeGlowStyle = computed(() => {
    const shadows: string[] = ["inset 0 2px 4px rgba(0,0,0,0.06)"];
    const color = "rgba(59, 130, 246, 0.55)"; // indigo-500
    if (edgeGlow.value.top) shadows.push(`inset 0 10px 20px -10px ${color}`);
    if (edgeGlow.value.bottom) shadows.push(`inset 0 -10px 20px -10px ${color}`);
    if (edgeGlow.value.left) shadows.push(`inset 10px 0 20px -10px ${color}`);
    if (edgeGlow.value.right) shadows.push(`inset -10px 0 20px -10px ${color}`);
    return { boxShadow: shadows.join(", ") };
  });

  function resetEdgeGlow() {
    edgeGlow.value = { top: false, bottom: false, left: false, right: false };
  }

  function screenToWorld(x: number, y: number) {
    return {
      x: (x - camera.value.x) / camera.value.scale,
      y: (y - camera.value.y) / camera.value.scale
    };
  }

  function worldToScreen(x: number, y: number) {
    return {
      x: x * camera.value.scale + camera.value.x,
      y: y * camera.value.scale + camera.value.y
    };
  }

  function applyDrawingStyles(c: CanvasRenderingContext2D) {
    c.lineWidth = 2.5;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#1e293b"; // slate-800
  }

  function setupCanvas() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const c = canvas.getContext("2d");
    if (c) {
      c.scale(dpr, dpr);
      applyDrawingStyles(c);
    }
    ctx.value = c;
    
    // Initial redraw if we have strokes
    if (allStrokes.value.length > 0) {
      requestAnimationFrame(redrawAll);
    }
  }

  function redrawAll() {
    const canvas = canvasRef.value;
    const c = ctx.value;
    if (!canvas || !c) return;

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.restore();

    c.save();
    c.translate(camera.value.x, camera.value.y);
    c.scale(camera.value.scale, camera.value.scale);

    applyDrawingStyles(c);

    for (const stroke of allStrokes.value) {
      if (stroke.x.length < 2) continue;
      c.beginPath();
      c.moveTo(stroke.x[0]!, stroke.y[0]!);
      for (let i = 1; i < stroke.x.length; i++) {
        c.lineTo(stroke.x[i]!, stroke.y[i]!);
      }
      c.stroke();
    }

    if (activeStroke && activeStroke.x.length >= 2) {
      c.beginPath();
      c.moveTo(activeStroke.x[0]!, activeStroke.y[0]!);
      for (let i = 1; i < activeStroke.x.length; i++) {
        c.lineTo(activeStroke.x[i]!, activeStroke.y[i]!);
      }
      c.stroke();
    }

    if (options.lines?.value) {
      for (const line of options.lines.value) {
        if (line.latex.trim().endsWith("=") && line.result !== null && line.boundingBox) {
          const box = line.boundingBox;
          const fontSize = Math.max(16, Math.min(24, box.maxY - box.minY));
          c.font = `bold ${fontSize}px "Nunito", system-ui, sans-serif`;
          c.fillStyle = "#10b981";
          c.textBaseline = "middle";
          const x = box.maxX + 8;
          const y = (box.minY + box.maxY) / 2;
          c.fillText(line.result.toString(), x, y);
        }
      }
    }

    c.restore();
  }

  function expandBounds(x: number, y: number) {
    if (!pendingBounds.value) {
      pendingBounds.value = { minX: x, minY: y, maxX: x, maxY: y };
    } else {
      pendingBounds.value.minX = Math.min(pendingBounds.value.minX, x);
      pendingBounds.value.minY = Math.min(pendingBounds.value.minY, y);
      pendingBounds.value.maxX = Math.max(pendingBounds.value.maxX, x);
      pendingBounds.value.maxY = Math.max(pendingBounds.value.maxY, y);
    }
  }

  function getPointerPos(e: MouseEvent) {
    if (!canvasRef.value) return { screenX: 0, screenY: 0 };
    const rect = canvasRef.value.getBoundingClientRect();
    return { screenX: e.clientX - rect.left, screenY: e.clientY - rect.top };
  }

  function startStroke(e: PointerEvent) {
    isDrawing.value = true;
    const { screenX, screenY } = getPointerPos(e);
    const { x, y } = screenToWorld(screenX, screenY);

    activeStroke = { x: [x], y: [y], t: [Date.now()], id: nextStrokeId++ };
    expandBounds(x, y);
  }

  function continueStroke(e: PointerEvent) {
    if (!isDrawing.value || !activeStroke) return;
    const { screenX, screenY } = getPointerPos(e);
    const { x, y } = screenToWorld(screenX, screenY);

    const MIN_DISTANCE_SQ = 4;
    const lastIdx = activeStroke.x.length - 1;
    const lastX = activeStroke.x[lastIdx]!;
    const lastY = activeStroke.y[lastIdx]!;
    const dx = x - lastX;
    const dy = y - lastY;

    if ((dx * dx + dy * dy) >= MIN_DISTANCE_SQ) {
      activeStroke.x.push(x);
      activeStroke.y.push(y);
      activeStroke.t.push(Date.now());
      expandBounds(x, y);
    }

    const EDGE_BUFFER = 40;
    const PAN_SPEED = 15;
    const canvas = canvasRef.value;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const isAtLeftEdge = screenX < EDGE_BUFFER;
      const isAtRightEdge = screenX > rect.width - EDGE_BUFFER;
      const isAtTopEdge = screenY < EDGE_BUFFER;
      const isAtBottomEdge = screenY > rect.height - EDGE_BUFFER;

      edgeGlow.value = { top: isAtTopEdge, bottom: isAtBottomEdge, left: isAtLeftEdge, right: isAtRightEdge };

      if (isAtLeftEdge) camera.value.x += PAN_SPEED;
      else if (isAtRightEdge) camera.value.x -= PAN_SPEED;
      if (isAtTopEdge) camera.value.y += PAN_SPEED;
      else if (isAtBottomEdge) camera.value.y -= PAN_SPEED;
    }

    requestAnimationFrame(redrawAll);
  }

  function endStroke(_e: PointerEvent) {
    if (!isDrawing.value) return;
    isDrawing.value = false;
    resetEdgeGlow();

    if (activeStroke && activeStroke.x.length > 2) {
      allStrokes.value = [...allStrokes.value, activeStroke];
    }
    activeStroke = null;
    requestAnimationFrame(redrawAll);

    if (options.onStrokeEnded) {
      options.onStrokeEnded();
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey) {
      const zoomSensitivity = 0.01;
      const delta = -e.deltaY * zoomSensitivity;
      let newScale = camera.value.scale * (1 + delta);
      newScale = Math.max(0.2, Math.min(newScale, 5));
      const { screenX, screenY } = getPointerPos(e);
      const worldX = (screenX - camera.value.x) / camera.value.scale;
      const worldY = (screenY - camera.value.y) / camera.value.scale;
      
      camera.value.scale = newScale;
      camera.value.x = screenX - worldX * camera.value.scale;
      camera.value.y = screenY - worldY * camera.value.scale;
    } else {
      camera.value.x -= e.deltaX;
      camera.value.y -= e.deltaY;
    }
    requestAnimationFrame(redrawAll);
  }

  function clearCanvas() {
    allStrokes.value = [];
    pendingBounds.value = null;
    requestAnimationFrame(redrawAll);
  }

  function clearArea() {
    if (!pendingBounds.value) return;
    const pad = CROP_PADDING;
    const bounds = pendingBounds.value;

    allStrokes.value = allStrokes.value.filter(stroke => {
      return !stroke.x.some((x, i) => {
        const y = stroke.y[i]!;
        // Keep stroke if no points are inside the boundary
        return x >= bounds.minX - pad && x <= bounds.maxX + pad &&
          y >= bounds.minY - pad && y <= bounds.maxY + pad;
      });
    });

    pendingBounds.value = null;
    requestAnimationFrame(redrawAll);
  }

  function clearAll() {
    clearCanvas();
    camera.value = { x: 0, y: 0, scale: 1 };
  }

  return {
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
    clearCanvas,
    clearArea,
    clearAll,
    redrawAll,
    setupCanvas
  };
}
