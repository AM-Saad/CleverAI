import type { CanvasShape } from "@@/shared/utils/note.contract";

export interface BoundsRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SnapStop {
  position: number;
  bounds: BoundsRect;
}

export interface SnapMatch {
  guide: number;
  diff: number;
  bounds: BoundsRect;
}

export interface GuideLine {
  id: string;
  points: number[];
}

export type SnapOrientation = "vertical" | "horizontal";

interface TransformNodeLike {
  scaleX: () => number;
  scaleY: () => number;
  width?: () => number;
  height?: () => number;
  radius?: () => number;
  radiusX?: () => number;
  radiusY?: () => number;
  points?: () => number[];
  fontSize?: () => number;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rectWidth(bounds: BoundsRect) {
  return bounds.right - bounds.left;
}

export function rectHeight(bounds: BoundsRect) {
  return bounds.bottom - bounds.top;
}

export function expandBounds(bounds: BoundsRect, padding: number): BoundsRect {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.right + padding,
    bottom: bounds.bottom + padding,
  };
}

export function boundsFromPoints(startX: number, startY: number, endX: number, endY: number): BoundsRect {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY),
  };
}

export function boundsIntersect(a: BoundsRect, b: BoundsRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function ensureMinBounds(bounds: BoundsRect, minWidth: number, minHeight: number): BoundsRect {
  let { left, top, right, bottom } = bounds;
  const width = rectWidth(bounds);
  const height = rectHeight(bounds);

  if (width < minWidth) {
    const extra = (minWidth - width) / 2;
    left -= extra;
    right += extra;
  }

  if (height < minHeight) {
    const extra = (minHeight - height) / 2;
    top -= extra;
    bottom += extra;
  }

  return { left, top, right, bottom };
}

export function getShapeBounds(shape: CanvasShape): BoundsRect {
  const x = shape.x ?? 0;
  const y = shape.y ?? 0;
  const scaleX = Math.abs(shape.scaleX ?? 1) || 1;
  const scaleY = Math.abs(shape.scaleY ?? 1) || 1;
  const strokeBuffer = Math.max(shape.strokeWidth ?? 0, 1);

  switch (shape.type) {
    case "rect": {
      const width = Math.abs((shape.width ?? 0) * scaleX);
      const height = Math.abs((shape.height ?? 0) * scaleY);
      return {
        left: x - strokeBuffer,
        top: y - strokeBuffer,
        right: x + width + strokeBuffer,
        bottom: y + height + strokeBuffer,
      };
    }
    case "circle": {
      const radius = Math.abs(shape.radius ?? 0) * Math.max(scaleX, scaleY);
      return {
        left: x - radius - strokeBuffer,
        top: y - radius - strokeBuffer,
        right: x + radius + strokeBuffer,
        bottom: y + radius + strokeBuffer,
      };
    }
    case "ellipse": {
      const radiusX = Math.abs(shape.radiusX ?? 0) * scaleX;
      const radiusY = Math.abs(shape.radiusY ?? 0) * scaleY;
      return {
        left: x - radiusX - strokeBuffer,
        top: y - radiusY - strokeBuffer,
        right: x + radiusX + strokeBuffer,
        bottom: y + radiusY + strokeBuffer,
      };
    }
    case "line":
    case "arrow":
    case "freedraw": {
      const points = shape.points ?? [0, 0, 0, 0];
      const xs = points.filter((_, index) => index % 2 === 0).map((value) => x + value * scaleX);
      const ys = points.filter((_, index) => index % 2 === 1).map((value) => y + value * scaleY);
      const minX = xs.length ? Math.min(...xs) : x;
      const maxX = xs.length ? Math.max(...xs) : x;
      const minY = ys.length ? Math.min(...ys) : y;
      const maxY = ys.length ? Math.max(...ys) : y;
      return {
        left: minX - strokeBuffer,
        top: minY - strokeBuffer,
        right: maxX + strokeBuffer,
        bottom: maxY + strokeBuffer,
      };
    }
    case "text": {
      const fontSize = shape.fontSize ?? 18;
      const width = Math.max(120, (shape.text?.length ?? 1) * fontSize * 0.6) * scaleX;
      const height = Math.max(fontSize * 1.6, 32) * scaleY;
      return {
        left: x - strokeBuffer,
        top: y - strokeBuffer,
        right: x + width + strokeBuffer,
        bottom: y + height + strokeBuffer,
      };
    }
    case "star": {
      const radius = Math.abs(shape.outerRadius ?? 0) * Math.max(scaleX, scaleY);
      return {
        left: x - radius - strokeBuffer,
        top: y - radius - strokeBuffer,
        right: x + radius + strokeBuffer,
        bottom: y + radius + strokeBuffer,
      };
    }
    default:
      return {
        left: x - strokeBuffer,
        top: y - strokeBuffer,
        right: x + strokeBuffer,
        bottom: y + strokeBuffer,
      };
  }
}

export function getBoundsPositions(bounds: BoundsRect, orientation: SnapOrientation) {
  if (orientation === "vertical") {
    return [bounds.left, (bounds.left + bounds.right) / 2, bounds.right];
  }

  return [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom];
}

export function getSnapStops(shapes: CanvasShape[], shapeId: string, orientation: SnapOrientation): SnapStop[] {
  return shapes
    .filter((shape) => shape.id !== shapeId)
    .flatMap((shape) => {
      const bounds = getShapeBounds(shape);
      return getBoundsPositions(bounds, orientation).map((position) => ({
        position,
        bounds,
      }));
    });
}

export function findClosestSnapMatch(
  positions: number[],
  stops: SnapStop[],
  threshold: number
): SnapMatch | null {
  let best: SnapMatch | null = null;

  for (const position of positions) {
    for (const stop of stops) {
      const diff = stop.position - position;
      if (Math.abs(diff) > threshold) continue;
      if (!best || Math.abs(diff) < Math.abs(best.diff)) {
        best = {
          guide: stop.position,
          diff,
          bounds: stop.bounds,
        };
      }
    }
  }

  return best;
}

export function buildSnapGuides(
  bounds: BoundsRect,
  vertical: SnapMatch | null,
  horizontal: SnapMatch | null,
  guidePadding: number
): GuideLine[] {
  const lines: GuideLine[] = [];

  if (vertical) {
    lines.push({
      id: `v-${vertical.guide}`,
      points: [
        vertical.guide,
        Math.min(bounds.top, vertical.bounds.top) - guidePadding,
        vertical.guide,
        Math.max(bounds.bottom, vertical.bounds.bottom) + guidePadding,
      ],
    });
  }

  if (horizontal) {
    lines.push({
      id: `h-${horizontal.guide}`,
      points: [
        Math.min(bounds.left, horizontal.bounds.left) - guidePadding,
        horizontal.guide,
        Math.max(bounds.right, horizontal.bounds.right) + guidePadding,
        horizontal.guide,
      ],
    });
  }

  return lines;
}

export function normalizeShapeTransform(shape: CanvasShape, node: TransformNodeLike) {
  const scaleX = Math.abs(node.scaleX());
  const scaleY = Math.abs(node.scaleY());
  const uniformScale = Math.sqrt(scaleX * scaleY);

  if (shape.type === "rect" && shape.width && shape.height) {
    shape.width = Math.max(12, (node.width?.() ?? shape.width) * scaleX);
    shape.height = Math.max(12, (node.height?.() ?? shape.height) * scaleY);
  } else if (shape.type === "circle" && shape.radius) {
    shape.radius = Math.max(6, (node.radius?.() ?? shape.radius) * uniformScale);
  } else if (shape.type === "ellipse" && shape.radiusX && shape.radiusY) {
    shape.radiusX = Math.max(6, (node.radiusX?.() ?? shape.radiusX) * scaleX);
    shape.radiusY = Math.max(6, (node.radiusY?.() ?? shape.radiusY) * scaleY);
  } else if ((shape.type === "line" || shape.type === "arrow" || shape.type === "freedraw") && shape.points) {
    shape.points = (node.points?.() ?? shape.points).map((point: number, index: number) => {
      return index % 2 === 0 ? point * scaleX : point * scaleY;
    });
  } else if (shape.type === "text") {
    shape.fontSize = clampNumber(
      (shape.fontSize ?? node.fontSize?.() ?? 18) * uniformScale,
      8,
      240
    );
  } else if (shape.type === "star") {
    shape.innerRadius = Math.max(6, (shape.innerRadius ?? 20) * uniformScale);
    shape.outerRadius = Math.max(12, (shape.outerRadius ?? 45) * uniformScale);
  }

  shape.scaleX = 1;
  shape.scaleY = 1;
}