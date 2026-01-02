/**
 * Token Estimation Utility
 *
 * Single source of truth for token estimation across the application.
 * Used by: material upload, adaptive item count, gateway routing, cache keying.
 *
 * Why heuristic-based:
 * - Avoids dependency on tokenizer libraries (tiktoken, etc.)
 * - Fast and sufficient for cost/item-count estimation
 * - Actual token counts are tracked via LLM strategy onMeasure callbacks
 */

/**
 * Prompt version for cache key generation.
 * Increment when prompts change significantly to avoid stale cache hits.
 */
export const PROMPT_VERSION = "v1";

/**
 * Estimate token count from text.
 *
 * Formula:
 * - ~3.5 characters per token (English text average)
 * - +10% overhead for markdown/code/special formatting
 * - Math.ceil rounding for conservative estimates
 *
 * @param text - Input text to estimate tokens for
 * @returns Estimated token count (minimum 10)
 */
export function estimateTokensFromText(text: string): number {
  // Base estimate: ~3.5 chars per token for English text
  const baseTokens = Math.ceil(text.length / 3.5);
  // Add 10% overhead for formatting, special characters, etc.
  const withOverhead = Math.ceil(baseTokens * 1.1);
  // Minimum 10 tokens to avoid edge cases
  return Math.max(10, withOverhead);
}

/**
 * Minimum token threshold for meaningful generation.
 * Below this threshold, reduce item count to avoid low-quality output.
 */
export const MIN_TOKENS_FOR_FULL_GENERATION = 300;

/**
 * Minimum item count for very small inputs.
 */
export const MIN_ITEMS_FOR_TINY_INPUT = 2;
