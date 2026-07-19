/**
 * Client-side SM-2 projection — so the four grade buttons can show the *real*
 * next interval before the user commits (design intent: "the algorithm feels
 * legible"). The server remains authoritative on the committed schedule; this
 * mirrors its SM-2 math from the card's current reviewState for the preview.
 */
import type { ReviewGrade } from "@shared/utils/review.contract";
import {
  projectOfflineReviewInterval,
  reviewGradeForKey,
  type ReviewGradeKey,
} from "@shared/utils/sm2";

export type GradeKey = ReviewGradeKey;

export interface Sm2State {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

export function gradeEnumFor(key: GradeKey): ReviewGrade {
  return reviewGradeForKey(key);
}

/** Project the next interval (in days) for a grade against current state. */
export function projectInterval(state: Sm2State, key: GradeKey): number {
  return projectOfflineReviewInterval(
    {
      currentEF: state.easeFactor ?? 2.5,
      currentInterval: state.intervalDays ?? 0,
      currentRepetitions: state.repetitions ?? 0,
    },
    key,
  );
}

/** Human-readable interval label ("<1m", "10m", "4h", "1d", "2mo", "1y"). */
export function formatInterval(days: number): string {
  if (days <= 0) return "<1m";
  const minutes = days * 1440;
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function useSm2Preview() {
  return { projectInterval, formatInterval, gradeEnumFor };
}
