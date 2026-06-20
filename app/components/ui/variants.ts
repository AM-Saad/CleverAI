/**
 * Design-system variant foundation.
 *
 * Every `Ui*` primitive declares its classes with `tv()` (tailwind-variants)
 * instead of hand-rolled `computed` class maps, so variant APIs stay uniform
 * and Tailwind class conflicts resolve correctly (tailwind-merge under the hood).
 *
 * The shared scales below are the canonical vocabulary — primitives should reuse
 * `SIZES`/`TONES` and the token-based class fragments rather than inventing their
 * own. All classes reference design tokens (see app/DESIGN.md), never raw values.
 */
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

export { tv };
export type { VariantProps };

// Canonical scales — keep prop unions in sync with these.
export const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export type Size = (typeof SIZES)[number];

// Semantic tones map 1:1 to the color token families.
export const TONES = ["primary", "neutral", "success", "warning", "error", "info"] as const;
export type Tone = (typeof TONES)[number];

// Tone → color is owned by the Nuxt UI theme in app/app.config.ts — the single
// source for button/field tone classes (with hover/active states). Custom
// primitives that need a tone fill compose tokens directly (bg-success/10,
// text-success-text, …); there is intentionally no second tone map here.

/** Tokenized focus ring — primitives compose this for keyboard focus. */
export const focusRing =
  "focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]";

/** Canonical interactive motion. Keep hover/active feedback subtle and consistent. */
export const interactiveTransition =
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]";

/** Canonical pressed feedback for button-like controls. */
export const pressedScale = "active:scale-[0.98]";

/** Canonical disabled treatment for native or custom interactive controls. */
export const disabledState =
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60";
