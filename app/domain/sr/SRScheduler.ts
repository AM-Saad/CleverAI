import { defaultSRPolicy, type SRPolicy } from "./SRPolicy";
import type { ReviewState } from "./SRTypes";

export interface SRScheduler {
  // Compute next state given previous and a 0..5 grade
  next(prev: ReviewState, grade: 0|1|2|3|4|5, policy?: SRPolicy, now?: Date): ReviewState
}


export class Sm2Scheduler implements SRScheduler {
  next(prev, grade, policy = defaultSRPolicy, now = new Date()) {
    const p: SRPolicy = policy;

    // Clamp grade defensively
    const g = Math.max(0, Math.min(5, grade));

    // Ease factor update (SM-2 style)
    const delta = 0.1 - (5 - g) * (0.08 + (5 - g) * 0.02);
    const easeFactor = Math.max(p.minEaseFactor, (prev.easeFactor ?? p.defaultEaseFactor) + delta);

    // Repetitions and interval
    const repetitions = g < 3 ? 0 : (prev.repetitions ?? 0) + 1;

    // Base interval selection
    let intervalDays: number;
    if (g < 3) {
      // Lapse → quick revisit
      intervalDays = p.firstIntervalDays;
    } else if (repetitions <= 1) {
      intervalDays = p.firstIntervalDays;
    } else if (repetitions === 2) {
      intervalDays = p.secondIntervalDays;
    } else {
      const prevInterval = prev.intervalDays > 0 ? prev.intervalDays : p.secondIntervalDays;
      intervalDays = Math.round(prevInterval * easeFactor);
    }

    // Clamp interval to [1, max]
    intervalDays = Math.max(1, Math.min(p.maxIntervalDays, intervalDays));

    // Compute next review date
    const nextReviewAt = new Date(now.getTime());
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    return {
      ...prev,
      repetitions,
      easeFactor,
      intervalDays,
      nextReviewAt,
      lastReviewedAt: now,
      lastGrade: g,
    };
  }
}
