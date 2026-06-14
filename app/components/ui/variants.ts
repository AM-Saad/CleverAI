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

/** Token-based text color per tone. */
export const toneText: Record<Tone, string> = {
  primary: "text-primary",
  neutral: "text-content-secondary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

/** Token-based solid background per tone (pairs with the readable on-tone text). */
export const toneBgSolid: Record<Tone, string> = {
  primary: "bg-primary text-on-primary",
  neutral: "bg-surface-strong text-content-on-surface-strong",
  success: "bg-success text-on-success",
  warning: "bg-warning text-on-warning",
  error: "bg-error text-on-error",
  info: "bg-info text-on-info",
};

/** Token-based subtle/tinted background per tone. */
export const toneBgSoft: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-surface-strong text-content-on-surface",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
};

/** Token-based border per tone. */
export const toneBorder: Record<Tone, string> = {
  primary: "border-primary",
  neutral: "border-secondary",
  success: "border-success",
  warning: "border-warning",
  error: "border-error",
  info: "border-info",
};

/** Tokenized focus ring — primitives compose this for keyboard focus. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
