/**
 * Adaptive Item Count Logic
 *
 * Why adaptive item count exists:
 * - LLM output quality degrades with very large item counts
 * - Cost scales with output tokens; limiting items controls cost
 * - Different content densities require different coverage depths
 * - User preference (quick/balanced/deep) controls coverage granularity
 */

import {
  MIN_TOKENS_FOR_FULL_GENERATION,
  MIN_ITEMS_FOR_TINY_INPUT,
} from "./tokenEstimate";

/**
 * Compute adaptive item count based on token estimate and depth preference
 *
 * @param tokenEstimate - Estimated tokens in the input text
 * @param depth - User's coverage preference ("quick" | "balanced" | "deep")
 * @param maxItems - Optional override for maximum items
 * @returns Computed item count
 */
export function computeAdaptiveItemCount(
  tokenEstimate: number,
  depth: "quick" | "balanced" | "deep" = "balanced",
  maxItems?: number,
): number {
  // Defensive guard: very small inputs get reduced item count
  // to prevent low-quality overgeneration from sparse content
  if (tokenEstimate < MIN_TOKENS_FOR_FULL_GENERATION) {
    return MIN_ITEMS_FOR_TINY_INPUT;
  }

  // Base calculation: 1 item per X tokens
  // Depth affects the granularity
  const tokensPerItem = {
    quick: 3000, // Fewer, broader items
    balanced: 2000, // Moderate coverage
    deep: 1000, // More detailed, granular items
  }[depth];

  const baseItemCount = Math.max(5, Math.floor(tokenEstimate / tokensPerItem));

  // Apply max limit
  const defaultMaxItems = {
    quick: 15,
    balanced: 30,
    deep: 50,
  }[depth];

  const effectiveMax = maxItems ?? defaultMaxItems;

  return Math.min(baseItemCount, effectiveMax);
}
