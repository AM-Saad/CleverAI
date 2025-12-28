export interface XpCalculationParams {
  easeFactor: number;
  intervalDays: number;
  grade: number;
  now: Date;
  nextReviewAt: Date; // Used for lateness calculation
  dailyXP: number; // Current accumulated XP for the day BEFORE this event
}

export const BASE_XP = 5;
export const DAILY_XP_TARGET = 300;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateReviewXP({
  easeFactor,
  intervalDays,
  grade,
  now,
  nextReviewAt,
  dailyXP,
}: XpCalculationParams): { rawXP: number; effectiveXP: number } {
  // 1. Difficulty Multiplier (from easeFactor)
  // difficultyMultiplier = clamp(3.0 - easeFactor, 0.5, 2.0)
  const difficultyMultiplier = clamp(3.0 - easeFactor, 0.5, 2.0);

  // 2. Spacing Multiplier (from intervalDays)
  // spacingMultiplier = clamp(log2(intervalDays + 1), 0.5, 3.0)
  const spacingMultiplier = clamp(Math.log2(intervalDays + 1), 0.5, 3.0);

  // 3. Grade multiplier
  let gradeMultiplier = 0.2;
  if (grade === 5) gradeMultiplier = 1.4;
  else if (grade === 4) gradeMultiplier = 1.2;
  else if (grade === 3) gradeMultiplier = 1.0;
  else if (grade === 2) gradeMultiplier = 0.6;
  else if (grade === 1) gradeMultiplier = 0.4;
  else if (grade === 0) gradeMultiplier = 0.2;

  // 4. Late bonus
  // latenessDays = max(0, daysBetween(now, nextReviewAt))
  // lateBonus = clamp(1 + latenessDays * 0.1, 1.0, 1.5)
  // Logic: if now > nextReviewAt, it's late.
  const msLate = now.getTime() - nextReviewAt.getTime();
  const daysLate = Math.max(0, Math.floor(msLate / (1000 * 60 * 60 * 24)));
  const lateBonus = clamp(1 + daysLate * 0.1, 1.0, 1.5);

  // 5. Final XP (Raw)
  const rawXP = Math.round(
    BASE_XP *
    difficultyMultiplier *
    spacingMultiplier *
    gradeMultiplier *
    lateBonus
  );

  // 6. Daily Soft Cap Logic
  // If total <= 300 -> full XP
  // If total > 300 -> apply decay
  let effectiveXP = rawXP;
  if (dailyXP > DAILY_XP_TARGET) {
    // effectiveXP = round(rawXP * clamp(1 - (dailyXP - 300) / 300, 0.3, 1))
    // Wait, if dailyXP is 600, (600 - 300) / 300 = 1. 1 - 1 = 0. clamp(0, 0.3, 1) = 0.3.
    // If dailyXP is 301, (301-300)/300 ~= 0. 1-0 = 1.
    const decayFactor = clamp(
      1 - (dailyXP - DAILY_XP_TARGET) / DAILY_XP_TARGET,
      0.3,
      1
    );
    effectiveXP = Math.round(rawXP * decayFactor);
  } else {
    // There is a slight edge case: if dailyXP + rawXP > 300, should we split it?
    // The requirement says: "Before inserting XP: Query today’s XP sum... If total > 300 -> apply decay".
    // It implies the decay is based on the *existing* total.
    // However, if I am at 299 and get 100 XP, I get full 100 XP?
    // "If total <= 300 -> full XP" (Total here means accumulated so far).
    // Yes. simpler interpretation is current sum before this event.
    effectiveXP = rawXP;
  }

  // Ensure XP >= 1
  if (effectiveXP < 1) effectiveXP = 1;

  return { rawXP, effectiveXP };
}

export function calculateEnrollXP(dailyXP: number): number {
  const rawXP = 8;
  let effectiveXP = rawXP;
  if (dailyXP > DAILY_XP_TARGET) {
    const decayFactor = clamp(
      1 - (dailyXP - DAILY_XP_TARGET) / DAILY_XP_TARGET,
      0.3,
      1
    );
    effectiveXP = Math.round(rawXP * decayFactor);
  }
  return Math.max(1, effectiveXP);
}
