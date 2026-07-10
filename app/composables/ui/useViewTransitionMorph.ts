import { computed, nextTick, readonly, ref } from "vue";

/**
 * useViewTransitionMorph — the single owner of View Transitions API mechanics.
 *
 * Implements the shared-element morph (Una Kravets / Emil Kowalski technique):
 * two elements take turns carrying the same `view-transition-name`, and the
 * browser morphs one into the other. Used by quick capture to morph a create
 * button into the capture sheet, and the sheet into the entity's full page.
 *
 * Nothing else in the app should call `document.startViewTransition` directly.
 *
 * Fallbacks (both resolve to a plain state update — UiSheet's own slide-up
 * remains the visible animation):
 *  - browsers without the View Transitions API
 *  - `prefers-reduced-motion: reduce` — the global reduced-motion CSS rule in
 *    main.css does NOT cover `::view-transition-*` pseudo-elements (they are
 *    not matched by `*`), so the skip must happen here in JS.
 */

export const MORPH_NAME = "quick-capture";
/**
 * Name the CaptureSheet panel carries while open (UiSheet `morph-name`). It
 * makes the panel its own morph group, so in-sheet mode swaps animate the
 * sheet's bounds (springy grow/shrink) instead of hard-cutting between the
 * menu-sized and editor-sized panel. Styled in main.css.
 */
export const SHEET_MORPH_NAME = "capture-sheet";

type MorphTarget = HTMLElement | null | (() => HTMLElement | null);

type DocumentWithVT = Document & {
  startViewTransition: (update: () => Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

// Module-scoped one-shot state so the morph spans surfaces:
// a page can arm the target before navigating, and the destination page's
// root picks the name up for the "new" snapshot.
const targetArmed = ref(false);
// True while a morph transition is in flight — UiSheet consumers bind this to
// the `morphing` prop so the sheet skips its own slide (which would otherwise
// be captured mid-flight by the snapshot and fight the morph).
const morphing = ref(false);

function vtSupported(): boolean {
  return (
    import.meta.client &&
    typeof document !== "undefined" &&
    "startViewTransition" in document
  );
}

/**
 * Shared JS-side reduced-motion check for animations the global CSS rule
 * can't reach (view transitions, WAAPI).
 */
export function prefersReducedMotion(): boolean {
  return (
    import.meta.client &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export interface MorphOptions {
  /** Element carrying the name in the OLD snapshot (e.g. the trigger button on open). */
  from?: MorphTarget;
  /** Element carrying the name in the NEW snapshot (e.g. the trigger button on close). */
  to?: MorphTarget;
  /** The state change (open/close a sheet, navigate) — awaited before the new snapshot. */
  update: () => void | Promise<void>;
}

function resolveTarget(target?: MorphTarget): HTMLElement | null {
  return typeof target === "function" ? target() : (target ?? null);
}

export function useViewTransitionMorph() {
  async function morph({ from, to, update }: MorphOptions): Promise<void> {
    // Only one view transition can run at a time — a second request while one
    // is in flight applies its update directly.
    if (!vtSupported() || prefersReducedMotion() || morphing.value) {
      await update();
      await nextTick();
      targetArmed.value = false;
      return;
    }

    morphing.value = true;
    const fromEl = resolveTarget(from);
    const transitionTarget = { to: null as HTMLElement | null };
    if (fromEl) fromEl.style.viewTransitionName = MORPH_NAME;

    const vt = (document as DocumentWithVT).startViewTransition(async () => {
      // Clear the old carrier before the new snapshot — duplicate names in one
      // snapshot abort the whole transition.
      if (fromEl) fromEl.style.viewTransitionName = "";
      await update();
      await nextTick();
      transitionTarget.to = resolveTarget(to);
      if (transitionTarget.to)
        transitionTarget.to.style.viewTransitionName = MORPH_NAME;
    });

    // Aborted/skipped transitions (rapid re-trigger, tab hidden) reject ALL
    // of these promises — swallow each so none surfaces as an unhandled
    // rejection; the DOM update itself has still been applied.
    vt.ready.catch(() => {});
    vt.updateCallbackDone.catch(() => {});
    try {
      await vt.finished;
    } catch {
      /* see above */
    }

    if (fromEl) fromEl.style.viewTransitionName = "";
    if (transitionTarget.to) transitionTarget.to.style.viewTransitionName = "";
    targetArmed.value = false;
    morphing.value = false;
  }

  /**
   * Arm the cross-route morph target. Call right before a morph() whose update
   * navigates; the destination page binds `:style="morphTargetStyle"` on its
   * root so it carries the name in the new snapshot. One-shot — disarmed when
   * the transition settles.
   */
  function armMorphTarget() {
    targetArmed.value = true;
  }

  const morphTargetStyle = computed(() =>
    targetArmed.value ? { viewTransitionName: MORPH_NAME } : {},
  );

  return {
    morph,
    armMorphTarget,
    morphTargetStyle,
    morphing: readonly(morphing),
  };
}
