/**
 * Shared icon manifest — read by both `generate-icons.ts` (which emits the
 * `IconName` registry) and `build-icon-sprite.ts` (which emits the symbols),
 * so the two can never disagree about which icons exist.
 */

/** Suffix identifying an AI-assisted variant, e.g. `notebook-pen-ai`. */
export const AI_VARIANT_SUFFIX = '-ai'

/**
 * Base icons that get a generated `-ai` companion.
 *
 * The sparkle is already this app's AI motif — it is the second most-used icon
 * and is literally labelled "AI" in the note editor. Composing it onto a base
 * mark as a fixed badge turns that ad-hoc habit into a system: `notebook-pen`
 * is a note, `notebook-pen-ai` is an AI-written one, and the relationship reads
 * the same everywhere.
 *
 * Keep this list to concepts where "AI-generated X" is a real product state.
 */
export const AI_VARIANT_BASES = [
  'notebook-pen',
  'file-text',
  'layers',
  'list-check',
  'graduation-cap',
  'languages',
] as const

/**
 * How far the base mark shrinks to clear the badge. Anchored bottom-left, so
 * the base keeps its baseline and vacates the top-right corner.
 */
export const AI_BASE_SCALE = 0.72

/**
 * The badge: a four-point sparkle centred in the vacated corner.
 *
 * Hand-authored at final size rather than scaled down from Lucide's sparkle —
 * a scaled sparkle needs its own stroke compensation and ends up chunky. Spans
 * x 15.7–23.3, y 0.7–8.3, leaving room for the stroke inside the 24 box.
 */
export const AI_BADGE_PATH =
  'M19.5 0.7 Q20.3 3.7 23.3 4.5 Q20.3 5.3 19.5 8.3 Q18.7 5.3 15.7 4.5 Q18.7 3.7 19.5 0.7 Z'

/**
 * Stroke width that survives a transform: the group is scaled, so the inherited
 * token has to be divided back out to keep the weight visually constant.
 * `var()` resolves against the host's custom properties even through an
 * external `<use>` shadow tree, which is what keeps these on the token.
 */
export function compensatedStrokeWidth(scale: number) {
  return `calc(var(--component-icon-stroke-width, 1.5) / ${scale})`
}

/** Registry name for a base icon's AI variant. */
export function aiVariantName(base: string) {
  return `${base}${AI_VARIANT_SUFFIX}`
}
