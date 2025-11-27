/**
 * SM-2 (SuperMemo 2) Spaced Repetition Algorithm
 * 
 * Calculates the next review interval, ease factor, and repetition count
 * based on the user's grade (0-5) and current card state.
 * 
 * @see https://supermemo.guru/wiki/Algorithm_SM-2
 */

export interface SM2Params {
  /** Current ease factor (typically 1.3 to 2.5+) */
  currentEF: number;
  /** Current interval in days */
  currentInterval: number;
  /** Number of successful repetitions (grade >= 3) */
  currentRepetitions: number;
  /** User's grade for this review (0-5) */
  grade: number;
}

export interface SM2Result {
  /** New ease factor after applying grade */
  easeFactor: number;
  /** Next review interval in days */
  intervalDays: number;
  /** Updated repetition count */
  repetitions: number;
}

export interface SM2Policy {
  /** Minimum allowed ease factor */
  minEaseFactor: number;
  /** Maximum allowed interval in days */
  maxIntervalDays: number;
  /** First success interval (typically 1 day) */
  firstIntervalDays: number;
  /** Second success interval (typically 6 days) */
  secondIntervalDays: number;
}

/**
 * Default SM-2 policy configuration
 */
export const DEFAULT_SM2_POLICY: SM2Policy = {
  minEaseFactor: 1.3,
  maxIntervalDays: 180,  // 6 months max
  firstIntervalDays: 1,
  secondIntervalDays: 6,
};

/**
 * Calculate next SM-2 state based on current state and grade.
 * 
 * Grade boundaries:
 * - 0-2: Incorrect responses → reset repetitions to 0, interval to 1 day
 * - 3-5: Correct responses → increment repetitions, calculate interval
 * 
 * Ease factor changes:
 * - Grade 0: EF - 0.8 (massive penalty)
 * - Grade 1: EF - 0.54 (large penalty)
 * - Grade 2: EF - 0.32 (medium penalty)
 * - Grade 3: EF - 0.14 (small penalty)
 * - Grade 4: EF ± 0 (no change)
 * - Grade 5: EF + 0.1 (reward)
 * 
 * @param params Current card state and user grade
 * @param policy Optional policy configuration (uses defaults if not provided)
 * @returns New card state with updated intervals and ease factor
 */
export function calculateSM2(
  params: SM2Params,
  policy: SM2Policy = DEFAULT_SM2_POLICY
): SM2Result {
  const { currentEF, currentInterval, currentRepetitions, grade } = params;

  let easeFactor = currentEF;
  let intervalDays = currentInterval;
  let repetitions = currentRepetitions;

  // Determine if response was correct (grade >= 3)
  if (grade >= 3) {
    // Correct response - progress continues
    if (repetitions === 0) {
      // First success
      intervalDays = policy.firstIntervalDays;
    } else if (repetitions === 1) {
      // Second success
      intervalDays = policy.secondIntervalDays;
    } else {
      // Third+ success - use formula
      intervalDays = Math.round(currentInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response (grades 0, 1, 2) - reset progress
    repetitions = 0;
    intervalDays = policy.firstIntervalDays;
  }

  // Update ease factor using SM-2 formula
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  // Ensure ease factor stays within bounds
  if (easeFactor < policy.minEaseFactor) {
    easeFactor = policy.minEaseFactor;
  }

  // Cap interval at maximum allowed days
  if (intervalDays > policy.maxIntervalDays) {
    intervalDays = policy.maxIntervalDays;
  }

  return { easeFactor, intervalDays, repetitions };
}

/**
 * Calculate the next review date based on interval days
 * 
 * @param intervalDays Number of days until next review
 * @param now Optional current date (defaults to now)
 * @returns Date object representing next review time
 */
export function calculateNextReviewDate(intervalDays: number, now = new Date()): Date {
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
  return nextReviewAt;
}
