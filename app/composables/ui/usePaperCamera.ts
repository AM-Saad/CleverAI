import { onBeforeUnmount, ref, type Ref } from "vue";
import type { PaperRect } from "~/utils/paper/ink";

/**
 * The camera that maps the sketch's world space onto the paper's viewport.
 *
 *   screenX = worldX * scale + x
 *
 * All zoom/pan/resize behaviour resolves to this one transform, which is why
 * resizing the paper can never move or rescale ink: the frame is a window, the
 * camera decides which part of an unbounded world it looks at.
 *
 * Direct manipulation (drag, pinch, wheel) is applied 1:1 on the event that
 * produced it — no smoothing, so content tracks the finger exactly. Smoothing
 * exists only where nothing is under the user's finger: release momentum,
 * rubber-band settle, and animated transitions (buttons, double-tap, fit).
 */

export interface PaperCameraState {
  x: number;
  y: number;
  scale: number;
}

export interface UsePaperCameraOptions {
  /** Live size of the frame, in CSS pixels. */
  viewport: Ref<{ width: number; height: number }>;
  /** World-space bounds of the ink, or null while the sketch is empty. */
  contentBounds: Ref<PaperRect | null>;
  /** Invoked after every camera mutation; write the transform to the DOM here. */
  onChange: () => void;
  reducedMotion?: Ref<boolean>;
}

export const PAPER_MIN_SCALE = 0.25;
export const PAPER_MAX_SCALE = 5;

/** iOS-style progressive resistance past a boundary. */
const RUBBER_CONSTANT = 0.55;
/** Fraction of momentum retained per millisecond, applied as decay^dt. */
const MOMENTUM_DECAY = 0.9955;
const MOMENTUM_MIN_SPEED = 0.015; // px/ms
const MOMENTUM_MAX_SPEED = 4; // px/ms
const SETTLE_MS = 420;
/** How much of the content must stay reachable inside the frame. */
const KEEP_VISIBLE_PX = 88;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

function rubberOffset(overflow: number, dimension: number): number {
  if (dimension <= 0) return 0;
  return (1 - 1 / ((overflow * RUBBER_CONSTANT) / dimension + 1)) * dimension;
}

interface Tween {
  fromX: number;
  fromY: number;
  fromScale: number;
  toX: number;
  toY: number;
  toScale: number;
  start: number;
  duration: number;
}

export function usePaperCamera(options: UsePaperCameraOptions) {
  /** Hot path: mutated at pointer/animation rate, deliberately non-reactive. */
  const state: PaperCameraState = { x: 0, y: 0, scale: 1 };

  /**
   * The un-resisted position. `state` is this value pushed back through the
   * rubber band, so overscroll compresses instead of compounding frame over
   * frame.
   */
  let rawX = 0;
  let rawY = 0;

  /** Reactive mirrors — assigned only when they actually change, so a gesture
   *  frame does not force a re-render unless something user-visible moved. */
  const displayScale = ref(1);
  const isAnimating = ref(false);
  const contentOffscreen = ref(false);

  let boundsEnabled = true;
  let momentumX = 0;
  let momentumY = 0;
  let autoPanX = 0;
  let autoPanY = 0;
  let tween: Tween | null = null;
  let rafId: number | null = null;
  let lastFrame = 0;

  function prefersReducedMotion(): boolean {
    return options.reducedMotion?.value === true;
  }

  /**
   * What panning is anchored to: the ink itself once anything is drawn, and
   * the starting page while the sketch is empty.
   *
   * Anchoring to the ink (rather than to ink ∪ page) is what makes the bound
   * mean something — with the page folded in, a sketch in the corner of a wide
   * frame could still be pushed out of sight while the bound reported itself
   * satisfied by empty page area.
   */
  function contentRect(): PaperRect {
    const ink = options.contentBounds.value;
    if (ink) return ink;

    const { width, height } = options.viewport.value;
    return { minX: 0, minY: 0, maxX: Math.max(width, 1), maxY: Math.max(height, 1) };
  }

  /**
   * Camera translation limits: pan freely, but never so far that the sketch
   * leaves the frame entirely. Without this the canvas is a place to get lost.
   *
   * Reaching untouched canvas is not this bound's job — a stroke suspends
   * bounds and the edge-pan carries the camera wherever the pen goes, so the
   * canvas is extended by drawing on it, not by panning into the void first.
   */
  function panLimits(scale = state.scale) {
    const { width, height } = options.viewport.value;
    const rect = contentRect();
    const marginX = Math.min(KEEP_VISIBLE_PX, width * 0.4);
    const marginY = Math.min(KEEP_VISIBLE_PX, height * 0.4);

    return {
      minX: marginX - rect.maxX * scale,
      maxX: width - marginX - rect.minX * scale,
      minY: marginY - rect.maxY * scale,
      maxY: height - marginY - rect.minY * scale,
    };
  }

  function applyRubber() {
    if (!boundsEnabled) {
      state.x = rawX;
      state.y = rawY;
      return;
    }

    const limits = panLimits();
    const { width, height } = options.viewport.value;

    state.x =
      rawX < limits.minX
        ? limits.minX - rubberOffset(limits.minX - rawX, width)
        : rawX > limits.maxX
          ? limits.maxX + rubberOffset(rawX - limits.maxX, width)
          : rawX;

    state.y =
      rawY < limits.minY
        ? limits.minY - rubberOffset(limits.minY - rawY, height)
        : rawY > limits.maxY
          ? limits.maxY + rubberOffset(rawY - limits.maxY, height)
          : rawY;
  }

  function commit() {
    const percent = Math.round(state.scale * 100);
    if (Math.round(displayScale.value * 100) !== percent) {
      displayScale.value = state.scale;
    }

    const ink = options.contentBounds.value;
    if (ink) {
      const { width, height } = options.viewport.value;
      const left = ink.minX * state.scale + state.x;
      const top = ink.minY * state.scale + state.y;
      const right = ink.maxX * state.scale + state.x;
      const bottom = ink.maxY * state.scale + state.y;
      const visible = right > 8 && left < width - 8 && bottom > 8 && top < height - 8;
      if (contentOffscreen.value === visible) contentOffscreen.value = !visible;
    } else if (contentOffscreen.value) {
      contentOffscreen.value = false;
    }

    options.onChange();
  }

  // ── Animation loop ───────────────────────────────────────────────
  // One rAF services momentum, rubber-band settle, tweens and draw-time edge
  // panning, so these can never run as competing timers.

  function ensureLoop() {
    if (rafId !== null) return;
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    isAnimating.value = false;
  }

  function frame(now: number) {
    rafId = null;
    const dt = lastFrame ? clamp(now - lastFrame, 1, 32) : 16;
    lastFrame = now;

    if (tween) {
      const t = clamp((now - tween.start) / tween.duration, 0, 1);
      const eased = easeOutQuint(t);
      state.scale = tween.fromScale + (tween.toScale - tween.fromScale) * eased;
      state.x = tween.fromX + (tween.toX - tween.fromX) * eased;
      state.y = tween.fromY + (tween.toY - tween.fromY) * eased;
      rawX = state.x;
      rawY = state.y;
      if (t >= 1) tween = null;
      commit();
      if (tween) {
        rafId = requestAnimationFrame(frame);
      } else {
        stopLoop();
      }
      return;
    }

    let active = false;

    if (autoPanX !== 0 || autoPanY !== 0) {
      rawX += (autoPanX * dt) / 1000;
      rawY += (autoPanY * dt) / 1000;
      active = true;
    }

    if (momentumX !== 0 || momentumY !== 0) {
      rawX += momentumX * dt;
      rawY += momentumY * dt;

      const decay = MOMENTUM_DECAY ** dt;
      momentumX *= decay;
      momentumY *= decay;

      if (Math.abs(momentumX) < MOMENTUM_MIN_SPEED) momentumX = 0;
      if (Math.abs(momentumY) < MOMENTUM_MIN_SPEED) momentumY = 0;

      if (boundsEnabled) {
        // Glide stops at the edge; the settle tween takes it from there.
        const limits = panLimits();
        if (rawX < limits.minX || rawX > limits.maxX) momentumX = 0;
        if (rawY < limits.minY || rawY > limits.maxY) momentumY = 0;
      }

      active = active || momentumX !== 0 || momentumY !== 0;
    }

    applyRubber();
    commit();

    if (!active && boundsEnabled) {
      const limits = panLimits();
      const targetX = clamp(rawX, limits.minX, limits.maxX);
      const targetY = clamp(rawY, limits.minY, limits.maxY);
      if (Math.abs(targetX - rawX) > 0.5 || Math.abs(targetY - rawY) > 0.5) {
        animateTo({ x: targetX, y: targetY, scale: state.scale }, SETTLE_MS);
        return;
      }
    }

    if (active) {
      isAnimating.value = true;
      rafId = requestAnimationFrame(frame);
    } else {
      rawX = state.x;
      rawY = state.y;
      stopLoop();
    }
  }

  // ── Coordinate conversion ────────────────────────────────────────

  function screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - state.x) / state.scale,
      y: (screenY - state.y) / state.scale,
    };
  }

  function worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * state.scale + state.x,
      y: worldY * state.scale + state.y,
    };
  }

  // ── Direct manipulation ──────────────────────────────────────────

  function cancelMotion() {
    tween = null;
    momentumX = 0;
    momentumY = 0;
    rawX = state.x;
    rawY = state.y;
  }

  function beginPan() {
    cancelMotion();
    stopLoop();
  }

  /** Applied immediately on the originating event — never smoothed. */
  function panBy(dx: number, dy: number) {
    rawX += dx;
    rawY += dy;
    applyRubber();
    commit();
  }

  /** `velocity` is px/ms, as measured over the last few pointer samples. */
  function endPan(velocityX = 0, velocityY = 0) {
    momentumX = prefersReducedMotion()
      ? 0
      : clamp(velocityX, -MOMENTUM_MAX_SPEED, MOMENTUM_MAX_SPEED);
    momentumY = prefersReducedMotion()
      ? 0
      : clamp(velocityY, -MOMENTUM_MAX_SPEED, MOMENTUM_MAX_SPEED);

    if (Math.abs(momentumX) < MOMENTUM_MIN_SPEED) momentumX = 0;
    if (Math.abs(momentumY) < MOMENTUM_MIN_SPEED) momentumY = 0;

    ensureLoop();
  }

  /** Rescale, keeping the world point under (screenX, screenY) pinned there. */
  function zoomAt(nextScale: number, screenX: number, screenY: number) {
    const clamped = clamp(nextScale, PAPER_MIN_SCALE, PAPER_MAX_SCALE);
    if (clamped === state.scale) return;

    const world = screenToWorld(screenX, screenY);
    state.scale = clamped;
    rawX = screenX - world.x * clamped;
    rawY = screenY - world.y * clamped;

    if (boundsEnabled) {
      const limits = panLimits();
      rawX = clamp(rawX, limits.minX, limits.maxX);
      rawY = clamp(rawY, limits.minY, limits.maxY);
    }

    state.x = rawX;
    state.y = rawY;
    commit();
  }

  function zoomBy(factor: number, screenX: number, screenY: number) {
    zoomAt(state.scale * factor, screenX, screenY);
  }

  // ── Animated moves ───────────────────────────────────────────────

  function animateTo(target: Partial<PaperCameraState>, duration = 320) {
    const toX = target.x ?? state.x;
    const toY = target.y ?? state.y;
    const toScale = clamp(target.scale ?? state.scale, PAPER_MIN_SCALE, PAPER_MAX_SCALE);

    momentumX = 0;
    momentumY = 0;

    if (prefersReducedMotion() || duration <= 0) {
      tween = null;
      state.x = toX;
      state.y = toY;
      state.scale = toScale;
      rawX = toX;
      rawY = toY;
      commit();
      stopLoop();
      return;
    }

    tween = {
      fromX: state.x,
      fromY: state.y,
      fromScale: state.scale,
      toX,
      toY,
      toScale,
      start: performance.now(),
      duration,
    };
    isAnimating.value = true;
    ensureLoop();
  }

  /** Animate to a scale centred on the frame. */
  function zoomToScale(nextScale: number, duration = 260) {
    const { width, height } = options.viewport.value;
    const clamped = clamp(nextScale, PAPER_MIN_SCALE, PAPER_MAX_SCALE);
    const centerX = width / 2;
    const centerY = height / 2;
    const world = screenToWorld(centerX, centerY);

    animateTo(
      {
        scale: clamped,
        x: centerX - world.x * clamped,
        y: centerY - world.y * clamped,
      },
      duration,
    );
  }

  interface FitOptions {
    padding?: number;
    /** Fitting never magnifies past this, so a small doodle isn't blown up. */
    maxScale?: number;
    duration?: number;
  }

  function fitTo(rect: PaperRect, fitOptions: FitOptions = {}) {
    const { width, height } = options.viewport.value;
    if (width <= 0 || height <= 0) return;

    const padding = fitOptions.padding ?? 24;
    const rectWidth = Math.max(rect.maxX - rect.minX, 1);
    const rectHeight = Math.max(rect.maxY - rect.minY, 1);

    const scale = clamp(
      Math.min(
        (width - padding * 2) / rectWidth,
        (height - padding * 2) / rectHeight,
        fitOptions.maxScale ?? 1,
      ),
      PAPER_MIN_SCALE,
      PAPER_MAX_SCALE,
    );

    animateTo(
      {
        scale,
        x: width / 2 - ((rect.minX + rect.maxX) / 2) * scale,
        y: height / 2 - ((rect.minY + rect.maxY) / 2) * scale,
      },
      fitOptions.duration ?? 380,
    );
  }

  /** Frame the ink, or return to the page when the sketch is empty. */
  function fitContent(duration = 380) {
    const ink = options.contentBounds.value;
    fitTo(ink ?? contentRect(), { padding: 28, duration });
  }

  function reset(duration = 300) {
    animateTo({ x: 0, y: 0, scale: 1 }, duration);
  }

  // ── Draw-time edge panning (infinite writing) ────────────────────

  /** Continuous pan in px/second; (0, 0) stops it. */
  function setAutoPan(vx: number, vy: number) {
    autoPanX = vx;
    autoPanY = vy;
    if (vx !== 0 || vy !== 0) ensureLoop();
  }

  /**
   * Suspended while a stroke is live: the ink being drawn is not yet part of
   * `contentBounds`, so enforcing bounds would pull the camera back against the
   * pen. Re-enabled on stroke end, once the new bounds include it.
   */
  function setBoundsEnabled(enabled: boolean) {
    boundsEnabled = enabled;
    if (enabled) {
      rawX = state.x;
      rawY = state.y;
      ensureLoop();
    }
  }

  /** Keep the view visually stable when the frame itself is resized. */
  function nudge(dx: number, dy: number) {
    state.x += dx;
    state.y += dy;
    rawX = state.x;
    rawY = state.y;
    commit();
  }

  function settle() {
    if (!boundsEnabled) return;
    const limits = panLimits();
    const targetX = clamp(rawX, limits.minX, limits.maxX);
    const targetY = clamp(rawY, limits.minY, limits.maxY);
    if (Math.abs(targetX - state.x) > 0.5 || Math.abs(targetY - state.y) > 0.5) {
      animateTo({ x: targetX, y: targetY }, SETTLE_MS);
    }
  }

  onBeforeUnmount(() => {
    stopLoop();
    tween = null;
  });

  return {
    state,
    displayScale,
    isAnimating,
    contentOffscreen,
    contentRect,
    screenToWorld,
    worldToScreen,
    beginPan,
    panBy,
    endPan,
    zoomAt,
    zoomBy,
    zoomToScale,
    animateTo,
    fitTo,
    fitContent,
    reset,
    setAutoPan,
    setBoundsEnabled,
    nudge,
    settle,
    cancelMotion,
  };
}

export type PaperCamera = ReturnType<typeof usePaperCamera>;
