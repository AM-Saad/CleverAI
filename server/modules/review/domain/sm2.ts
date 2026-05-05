export interface SM2Params {
  currentEF: number;
  currentInterval: number;
  currentRepetitions: number;
  grade: number;
}

export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SM2Policy {
  minEaseFactor: number;
  maxIntervalDays: number;
  firstIntervalDays: number;
  secondIntervalDays: number;
}

export const DEFAULT_SM2_POLICY: SM2Policy = {
  minEaseFactor: 1.3,
  maxIntervalDays: 180,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
};

export function calculateSM2(
  params: SM2Params,
  policy: SM2Policy = DEFAULT_SM2_POLICY
): SM2Result {
  const { currentEF, currentInterval, currentRepetitions, grade } = params;

  let easeFactor = currentEF;
  let intervalDays = currentInterval;
  let repetitions = currentRepetitions;

  if (grade >= 3) {
    if (repetitions === 0) {
      intervalDays = policy.firstIntervalDays;
    } else if (repetitions === 1) {
      intervalDays = policy.secondIntervalDays;
    } else {
      intervalDays = Math.round(currentInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = policy.firstIntervalDays;
  }

  easeFactor =
    easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  if (easeFactor < policy.minEaseFactor) {
    easeFactor = policy.minEaseFactor;
  }

  if (intervalDays > policy.maxIntervalDays) {
    intervalDays = policy.maxIntervalDays;
  }

  return { easeFactor, intervalDays, repetitions };
}

export function calculateNextReviewDate(
  intervalDays: number,
  now = new Date()
): Date {
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
  return nextReviewAt;
}

export function calculateNextStreak(currentStreak: number, grade: number) {
  return grade >= 3 ? currentStreak + 1 : 0;
}

export function isMasteredByInterval(intervalDays: number) {
  return intervalDays >= 21;
}
