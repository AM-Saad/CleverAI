/**
 * Fractional ranking for board items (LexoRank-style, float flavour).
 *
 * Items carry a fractional `order` rank instead of contiguous integers, so
 * moving one card is a SINGLE write (a value between its new neighbours) rather
 * than rewriting every card in the column. Ranks needn't be contiguous; gaps
 * left behind by a move are harmless.
 *
 * Precision: floats give ~50 successive midpoint insertions between the same two
 * neighbours before they collapse — `needsRebalance` detects that so the caller
 * can relabel the whole column with fresh, evenly-spaced ranks.
 */

/** Spacing for appended/prepended items and full rebalances. */
export const RANK_GAP = 1024;

/** Smallest gap we'll still split; below this we rebalance instead. */
const MIN_GAP = 1e-6;

/**
 * A rank strictly between `before` and `after`. Either bound may be null/undefined
 * (start or end of the list).
 */
export function rankBetween(before?: number | null, after?: number | null): number {
  if (before == null && after == null) return RANK_GAP;
  if (before == null) return (after as number) - RANK_GAP;
  if (after == null) return (before as number) + RANK_GAP;
  return (before + after) / 2;
}

/** True when two neighbour ranks are too close to safely fit a value between. */
export function needsRebalance(before: number, after: number): boolean {
  return Math.abs(after - before) < MIN_GAP;
}

/** Evenly-spaced ranks for a full column relabel (1·GAP, 2·GAP, …). */
export function rebalancedRanks<T>(ordered: T[]): number[] {
  return ordered.map((_, i) => (i + 1) * RANK_GAP);
}
