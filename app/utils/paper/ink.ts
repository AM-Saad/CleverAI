/**
 * Ink primitives for the sketch (`paper`) block.
 *
 * Everything here is pure and world-space: a stroke's coordinates are authored
 * once and never rescaled. Zooming, panning and resizing the paper are camera
 * concerns (see `usePaperCamera`) and must never touch these numbers.
 */

export interface PaperStroke {
  id: string;
  color: string;
  size: number;
  path: string;
}

export interface PaperRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StrokeGeometry {
  /** Flat [x0, y0, x1, y1, …] sample list used for hit-testing. */
  points: number[];
  bounds: PaperRect;
}

/**
 * Parsed geometry is derived from the immutable `path` string, so the string
 * itself is a safe cache key. Bounded so a very long editing session can't grow
 * the cache without limit.
 */
const GEOMETRY_CACHE_LIMIT = 4000;
const geometryCache = new Map<string, StrokeGeometry>();

const NUMBER_PATTERN = /[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;

export function parseStrokeGeometry(path: string): StrokeGeometry {
  const cached = geometryCache.get(path);
  if (cached) return cached;

  const points: number[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const matches = path.match(NUMBER_PATTERN);
  if (matches) {
    for (let i = 0; i + 1 < matches.length; i += 2) {
      const x = Number.parseFloat(matches[i]!);
      const y = Number.parseFloat(matches[i + 1]!);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      points.push(x, y);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const geometry: StrokeGeometry = {
    points,
    bounds: points.length
      ? { minX, minY, maxX, maxY }
      : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  };

  if (geometryCache.size >= GEOMETRY_CACHE_LIMIT) geometryCache.clear();
  geometryCache.set(path, geometry);

  return geometry;
}

/** World-space bounding box of every stroke, or null when there is no ink. */
export function strokesBounds(strokes: readonly PaperStroke[]): PaperRect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const stroke of strokes) {
    const geometry = parseStrokeGeometry(stroke.path);
    if (!geometry.points.length) continue;
    found = true;
    // Half the nib width bleeds outside the centre line.
    const pad = stroke.size / 2;
    if (geometry.bounds.minX - pad < minX) minX = geometry.bounds.minX - pad;
    if (geometry.bounds.minY - pad < minY) minY = geometry.bounds.minY - pad;
    if (geometry.bounds.maxX + pad > maxX) maxX = geometry.bounds.maxX + pad;
    if (geometry.bounds.maxY + pad > maxY) maxY = geometry.bounds.maxY + pad;
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

export function unionRect(a: PaperRect | null, b: PaperRect | null): PaperRect | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function expandRect(rect: PaperRect, padding: number): PaperRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

export function rectsIntersect(a: PaperRect, b: PaperRect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Squared distance from (px, py) to segment (ax, ay)–(bx, by). */
function distanceToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  let t = 0;
  if (lengthSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

/**
 * True when an eraser of `radius` centred at (x, y) touches the stroke.
 * Bounds-rejects first so a full sample walk only happens for nearby strokes.
 */
export function strokeHitTest(
  stroke: PaperStroke,
  x: number,
  y: number,
  radius: number,
): boolean {
  const geometry = parseStrokeGeometry(stroke.path);
  const { points, bounds } = geometry;
  if (!points.length) return false;

  const reach = radius + stroke.size / 2;
  if (
    x < bounds.minX - reach ||
    x > bounds.maxX + reach ||
    y < bounds.minY - reach ||
    y > bounds.maxY + reach
  ) {
    return false;
  }

  const reachSq = reach * reach;
  if (points.length === 2) {
    const dx = x - points[0]!;
    const dy = y - points[1]!;
    return dx * dx + dy * dy <= reachSq;
  }

  for (let i = 0; i + 3 < points.length; i += 2) {
    if (
      distanceToSegmentSq(x, y, points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!) <=
      reachSq
    ) {
      return true;
    }
  }

  return false;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Incremental quadratic-midpoint smoothing.
 *
 * Each sample appends one `Q` segment in O(1); the previous implementation
 * re-ran a spline over the whole point list on every pointer move, which made
 * long strokes progressively laggier.
 */
export function createStrokeBuilder() {
  let path = "";
  let count = 0;
  let lastX = 0;
  let lastY = 0;
  let prevX = 0;
  let prevY = 0;

  return {
    get length() {
      return count;
    },
    /** Returns the live path (already including the trailing sample). */
    add(x: number, y: number): string {
      if (count === 0) {
        path = `M ${round(x)} ${round(y)}`;
      } else if (count === 1) {
        path += ` L ${round((lastX + x) / 2)} ${round((lastY + y) / 2)}`;
      } else {
        path += ` Q ${round(lastX)} ${round(lastY)} ${round((lastX + x) / 2)} ${round((lastY + y) / 2)}`;
      }

      prevX = lastX;
      prevY = lastY;
      lastX = x;
      lastY = y;
      count += 1;
      return this.preview();
    },
    /** Path including a provisional segment to the newest sample. */
    preview(): string {
      if (count === 0) return "";
      if (count === 1) return `${path} L ${round(lastX + 0.01)} ${round(lastY)}`;
      return `${path} L ${round(lastX)} ${round(lastY)}`;
    },
    /** Final path. A single tap becomes a dot so pointing at the page still marks it. */
    finish(): string {
      if (count === 0) return "";
      if (count === 1) return `M ${round(lastX)} ${round(lastY)} L ${round(lastX + 0.01)} ${round(lastY)}`;
      return `${path} L ${round(lastX)} ${round(lastY)}`;
    },
    lastPoint(): [number, number] {
      return [lastX, lastY];
    },
    previousPoint(): [number, number] {
      return [prevX, prevY];
    },
    reset() {
      path = "";
      count = 0;
    },
  };
}

export type StrokeBuilder = ReturnType<typeof createStrokeBuilder>;
