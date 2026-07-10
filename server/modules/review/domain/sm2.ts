import {
  calculateOfflineNextReviewDate as sharedCalculateNextReviewDate,
  calculateOfflineNextStreak as sharedCalculateNextStreak,
  calculateOfflineSM2 as sharedCalculateSM2,
} from "../../../../shared/utils/sm2";

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

/** Shared with the browser so an offline optimistic grade uses server maths. */
export const calculateSM2 = (params: SM2Params, policy: SM2Policy = DEFAULT_SM2_POLICY): SM2Result =>
  sharedCalculateSM2(params, policy);
export const calculateNextReviewDate = (intervalDays: number, now = new Date()) =>
  sharedCalculateNextReviewDate(intervalDays, now);
export const calculateNextStreak = (currentStreak: number, grade: number) =>
  sharedCalculateNextStreak(currentStreak, grade);

export function isMasteredByInterval(intervalDays: number) {
  return intervalDays >= 21;
}
