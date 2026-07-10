export interface SM2Params { currentEF: number; currentInterval: number; currentRepetitions: number; grade: number; }
export interface SM2Result { easeFactor: number; intervalDays: number; repetitions: number; }
export interface SM2Policy { minEaseFactor: number; maxIntervalDays: number; firstIntervalDays: number; secondIntervalDays: number; }
export const OFFLINE_SM2_DEFAULT_POLICY: SM2Policy = { minEaseFactor: 1.3, maxIntervalDays: 180, firstIntervalDays: 1, secondIntervalDays: 6 };
export const calculateOfflineSM2 = ({ currentEF, currentInterval, currentRepetitions, grade }: SM2Params, policy: SM2Policy = OFFLINE_SM2_DEFAULT_POLICY): SM2Result => {
  let easeFactor = currentEF;
  let intervalDays = currentInterval;
  let repetitions = currentRepetitions;
  if (grade >= 3) {
    intervalDays = repetitions === 0 ? policy.firstIntervalDays : repetitions === 1 ? policy.secondIntervalDays : Math.round(currentInterval * easeFactor);
    repetitions += 1;
  } else { repetitions = 0; intervalDays = policy.firstIntervalDays; }
  easeFactor = Math.max(policy.minEaseFactor, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  return { easeFactor, intervalDays: Math.min(policy.maxIntervalDays, intervalDays), repetitions };
};
export const calculateOfflineNextReviewDate = (intervalDays: number, now = new Date()) => {
  const next = new Date(now);
  next.setDate(next.getDate() + intervalDays);
  return next;
};
export const calculateOfflineNextStreak = (currentStreak: number, grade: number) => grade >= 3 ? currentStreak + 1 : 0;
