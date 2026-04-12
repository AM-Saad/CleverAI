import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import type { CanvasShape } from "@@/shared/utils/note.contract";
import {
  clampNumber,
  ensureMinBounds,
  expandBounds,
  getShapeBounds,
  rectHeight,
  rectWidth,
  type BoundsRect,
} from "~/utils/canvas/geometry";

type StagePosition = { x: number; y: number };
type StageSize = { width: number; height: number };
type ContentAreaRef = { el: HTMLDivElement | null } | null;

interface MinimapMetrics {
  world: BoundsRect;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface MinimapShape {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  outlined: boolean;
}

interface MinimapViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseCanvasViewportOptions {
  shapes: Ref<CanvasShape[]>;
  isFullscreen?: Ref<boolean | undefined>;
  defaultWorldBounds: BoundsRect;
  worldMinWidth: number;
  worldMinHeight: number;
  contentEdgePadding: number;
  worldPadding: number;
  viewportFitRatio: number;
  minimapWidth: number;
  minimapHeight: number;
  initialStageSize?: StageSize;
  minStageHeight?: number;
  viewportHeightRatio?: number;
}

export function useCanvasViewport(options: UseCanvasViewportOptions) {
  const stageScale = ref(1);
  const stagePosition = ref<StagePosition>({ x: 0, y: 0 });
  const containerRef = ref<ContentAreaRef>(null);
  const minimapRef = ref<HTMLElement | null>(null);
  const stageSize = ref<StageSize>(options.initialStageSize ?? { width: 800, height: 400 });
  const didFitInitialViewport = ref(false);
  const isMinimapCollapsed = ref(false);

  const minStageHeight = options.minStageHeight ?? 400;
  const viewportHeightRatio = options.viewportHeightRatio ?? 0.6;
  let resizeObserver: ResizeObserver | null = null;
  let fullscreenTimer: ReturnType<typeof setTimeout> | null = null;

  const contentBounds = computed<BoundsRect>(() => {
    if (!options.shapes.value.length) {
      return { ...options.defaultWorldBounds };
    }

    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const shape of options.shapes.value) {
      const bounds = getShapeBounds(shape);
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.right);
      bottom = Math.max(bottom, bounds.bottom);
    }

    return expandBounds({ left, top, right, bottom }, options.contentEdgePadding);
  });

  const worldBounds = computed<BoundsRect>(() => {
    if (!options.shapes.value.length) {
      return ensureMinBounds(
        { ...options.defaultWorldBounds },
        options.worldMinWidth,
        options.worldMinHeight
      );
    }

    return ensureMinBounds(
      expandBounds(contentBounds.value, options.worldPadding),
      options.worldMinWidth,
      options.worldMinHeight
    );
  });

  const visibleWorldRect = computed<BoundsRect>(() => {
    const scale = stageScale.value || 1;
    const left = -stagePosition.value.x / scale;
    const top = -stagePosition.value.y / scale;

    return {
      left,
      top,
      right: left + stageSize.value.width / scale,
      bottom: top + stageSize.value.height / scale,
    };
  });

  function resolveViewportStageHeight() {
    return Math.max(window.innerHeight * viewportHeightRatio, minStageHeight);
  }

  function measureStageSize(preferViewportHeight = false) {
    if (!containerRef.value?.el) {
      return false;
    }

    const rect = containerRef.value.el.getBoundingClientRect();
    stageSize.value = {
      width: rect.width,
      height: preferViewportHeight
        ? resolveViewportStageHeight()
        : (rect.height || resolveViewportStageHeight()),
    };

    return true;
  }

  function constrainStagePosition(position: StagePosition, scale = stageScale.value) {
    const world = worldBounds.value;
    const viewportWidth = stageSize.value.width;
    const viewportHeight = stageSize.value.height;
    const worldWidth = rectWidth(world) * scale;
    const worldHeight = rectHeight(world) * scale;

    let x = position.x;
    let y = position.y;

    if (worldWidth <= viewportWidth) {
      x = viewportWidth / 2 - (world.left + rectWidth(world) / 2) * scale;
    } else {
      x = clampNumber(x, viewportWidth - world.right * scale, -world.left * scale);
    }

    if (worldHeight <= viewportHeight) {
      y = viewportHeight / 2 - (world.top + rectHeight(world) / 2) * scale;
    } else {
      y = clampNumber(y, viewportHeight - world.bottom * scale, -world.top * scale);
    }

    return { x, y };
  }

  function constrainStageDrag(position: StagePosition) {
    return constrainStagePosition(position);
  }

  function centerViewportOn(worldX: number, worldY: number, scale = stageScale.value) {
    stagePosition.value = constrainStagePosition(
      {
        x: stageSize.value.width / 2 - worldX * scale,
        y: stageSize.value.height / 2 - worldY * scale,
      },
      scale
    );
  }

  function focusCanvasHome() {
    const targetBounds = options.shapes.value.length ? contentBounds.value : worldBounds.value;
    const width = Math.max(rectWidth(targetBounds), 240);
    const height = Math.max(rectHeight(targetBounds), 240);
    const fitScale = clampNumber(
      Math.min(
        (stageSize.value.width * options.viewportFitRatio) / width,
        (stageSize.value.height * options.viewportFitRatio) / height,
        1
      ),
      0.35,
      1.5
    );

    stageScale.value = fitScale;
    centerViewportOn(
      (targetBounds.left + targetBounds.right) / 2,
      (targetBounds.top + targetBounds.bottom) / 2,
      fitScale
    );
  }

  function fitInitialViewportIfNeeded() {
    if (didFitInitialViewport.value || !stageSize.value.width || !stageSize.value.height) {
      return;
    }

    if (options.shapes.value.length) {
      focusCanvasHome();
    } else {
      stagePosition.value = constrainStagePosition(stagePosition.value);
    }

    didFitInitialViewport.value = true;
  }

  const minimapMetrics = computed<MinimapMetrics>(() => {
    const world = worldBounds.value;
    const scale = Math.min(
      options.minimapWidth / rectWidth(world),
      options.minimapHeight / rectHeight(world)
    );
    const contentWidth = rectWidth(world) * scale;
    const contentHeight = rectHeight(world) * scale;

    return {
      world,
      scale,
      offsetX: (options.minimapWidth - contentWidth) / 2,
      offsetY: (options.minimapHeight - contentHeight) / 2,
    };
  });

  const minimapShapes = computed<MinimapShape[]>(() => {
    const metrics = minimapMetrics.value;

    return options.shapes.value.map((shape) => {
      const bounds = getShapeBounds(shape);

      return {
        left: metrics.offsetX + (bounds.left - metrics.world.left) * metrics.scale,
        top: metrics.offsetY + (bounds.top - metrics.world.top) * metrics.scale,
        width: Math.max((bounds.right - bounds.left) * metrics.scale, 3),
        height: Math.max((bounds.bottom - bounds.top) * metrics.scale, 3),
        color: shape.fill && shape.fill !== "transparent"
          ? shape.fill
          : (shape.stroke || "var(--color-primary)"),
        outlined: !shape.fill || shape.fill === "transparent",
      };
    });
  });

  const minimapViewport = computed<MinimapViewport>(() => {
    const metrics = minimapMetrics.value;
    const view = visibleWorldRect.value;

    return {
      left: metrics.offsetX + (view.left - metrics.world.left) * metrics.scale,
      top: metrics.offsetY + (view.top - metrics.world.top) * metrics.scale,
      width: Math.max((view.right - view.left) * metrics.scale, 10),
      height: Math.max((view.bottom - view.top) * metrics.scale, 10),
    };
  });

  function handleMinimapPointer(event: PointerEvent) {
    if (!minimapRef.value) {
      return;
    }

    const rect = minimapRef.value.getBoundingClientRect();
    const metrics = minimapMetrics.value;
    const localX = clampNumber(
      event.clientX - rect.left - metrics.offsetX,
      0,
      rectWidth(metrics.world) * metrics.scale
    );
    const localY = clampNumber(
      event.clientY - rect.top - metrics.offsetY,
      0,
      rectHeight(metrics.world) * metrics.scale
    );

    centerViewportOn(
      metrics.world.left + localX / metrics.scale,
      metrics.world.top + localY / metrics.scale
    );
  }

  function handleMinimapDrag(event: PointerEvent) {
    if (event.buttons !== 1) {
      return;
    }

    handleMinimapPointer(event);
  }

  function toggleMinimap() {
    isMinimapCollapsed.value = !isMinimapCollapsed.value;
  }

  onMounted(() => {
    if (measureStageSize(true)) {
      nextTick(() => {
        fitInitialViewportIfNeeded();
      });
    }
  });

  onMounted(() => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.value?.el) {
          stageSize.value = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };

          if (!didFitInitialViewport.value) {
            nextTick(() => {
              fitInitialViewportIfNeeded();
            });
          }
        }
      }
    });

    if (containerRef.value?.el) {
      resizeObserver.observe(containerRef.value.el);
    }
  });

  watch(
    [worldBounds, stageScale, () => stageSize.value.width, () => stageSize.value.height],
    () => {
      if (!stageSize.value.width || !stageSize.value.height) {
        return;
      }

      // Only clamp the position if it is now outside the scrollable range.
      // Do NOT auto-center here: when worldBounds expands because shapes move toward
      // the edge (during draw or after drag/resize), calling constrainStagePosition
      // (which re-centers small worlds) causes the viewport to jump unexpectedly.
      // Centering is the responsibility of focusCanvasHome / fitInitialViewportIfNeeded
      // and the dragBoundFunc; the watcher just prevents the view from going
      // completely off-screen when the world shrinks (e.g. shapes deleted).
      const world = worldBounds.value;
      const scale = stageScale.value;
      const vw = stageSize.value.width;
      const vh = stageSize.value.height;
      const worldW = rectWidth(world) * scale;
      const worldH = rectHeight(world) * scale;

      const clampedX = worldW <= vw
        ? stagePosition.value.x
        : clampNumber(stagePosition.value.x, vw - world.right * scale, -world.left * scale);
      const clampedY = worldH <= vh
        ? stagePosition.value.y
        : clampNumber(stagePosition.value.y, vh - world.bottom * scale, -world.top * scale);

      if (Math.abs(clampedX - stagePosition.value.x) > 0.5 || Math.abs(clampedY - stagePosition.value.y) > 0.5) {
        stagePosition.value = { x: clampedX, y: clampedY };
      }
    },
    { deep: true }
  );

  if (options.isFullscreen) {
    watch(options.isFullscreen, () => {
      if (fullscreenTimer) {
        clearTimeout(fullscreenTimer);
      }

      fullscreenTimer = setTimeout(() => {
        if (measureStageSize(true)) {
          stagePosition.value = constrainStagePosition(stagePosition.value);
        }
      }, 100);
    });
  }

  onUnmounted(() => {
    resizeObserver?.disconnect();

    if (fullscreenTimer) {
      clearTimeout(fullscreenTimer);
    }
  });

  return {
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
  };
}