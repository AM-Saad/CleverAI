/**
 * Stable per-entity accent colors.
 *
 * Design intent (handoff README): a note's type-spine color, a saved word's
 * highlight, a board tag — the same color follows that entity across every
 * screen. This is intentional visual memory, so the mapping must be
 * deterministic, never random per render.
 *
 * All values are design tokens (the accent palette in tokens.generated.css).
 */

/** The eight stable accent tokens, in palette order. */
export const ACCENT_TOKENS = [
  "--color-accent-blue",
  "--color-accent-indigo",
  "--color-accent-purple",
  "--color-accent-pink",
  "--color-accent-rose",
  "--color-accent-teal",
  "--color-accent-cyan",
  "--color-accent-orange",
] as const;

export type AccentToken = (typeof ACCENT_TOKENS)[number];

/** `var(--token)` wrapper so callers can drop the result straight into styles. */
export function accentVar(token: AccentToken): string {
  return `var(${token})`;
}

/**
 * Note type → spine color. Deterministic by `noteType` (no schema field needed):
 *   TEXT → indigo · MATH → success/info · CANVAS → orange.
 */
export function noteSpineVar(noteType: string | null | undefined): string {
  switch ((noteType ?? "TEXT").toUpperCase()) {
    case "MATH":
      return "var(--color-success)";
    case "CANVAS":
      return "var(--color-accent-orange)";
    case "TEXT":
    default:
      return "var(--color-accent-indigo)";
  }
}

/** Stable string → accent token via a small FNV-1a hash (used for saved words). */
export function accentTokenFor(key: string): AccentToken {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const index = Math.abs(hash) % ACCENT_TOKENS.length;
  return ACCENT_TOKENS[index]!;
}

/** Stable string → `var(--accent…)`. */
export function accentVarFor(key: string): string {
  return accentVar(accentTokenFor(key));
}

/**
 * Resolve a tag color. Board tags carry an explicit `UserTag.color` (hex or a
 * token name); fall back to a stable hash of the tag name so untagged-color
 * tags still read consistently.
 */
export function tagColorVar(tag: { name: string; color?: string | null }): string {
  if (tag.color) {
    return tag.color.startsWith("--") ? `var(${tag.color})` : tag.color;
  }
  return accentVarFor(tag.name);
}

/**
 * A translucent tint of any token/color, per the README rule
 * (`color-mix(in srgb, <color> N%, transparent)`).
 */
export function tint(color: string, percent = 12): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
