/**
 * Client-side SM-2 projection — so the four grade buttons can show the *real*
 * next interval before the user commits (design intent: "the algorithm feels
 * legible"). The server remains authoritative on the committed schedule; this
 * mirrors its SM-2 math from the card's current reviewState for the preview.
 */
import type { ReviewGrade } from "@shared/utils/review.contract";

export type GradeKey = "again" | "hard" | "good" | "easy";

export interface Sm2State {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

/** Grade key → SM-2 quality, and → the server's grade enum. */
const QUALITY: Record<GradeKey, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const GRADE_ENUM: Record<GradeKey, ReviewGrade> = {
  again: "1",
  hard: "3",
  good: "4",
  easy: "5",
};

export function gradeEnumFor(key: GradeKey): ReviewGrade {
  return GRADE_ENUM[key];
}

const MIN_EF = 1.3;
const MINUTE = 1 / 1440; // a day fraction

/** Project the next interval (in days) for a grade against current state. */
export function projectInterval(state: Sm2State, key: GradeKey): number {
  const q = QUALITY[key];
  const reps = state.repetitions ?? 0;
  const ef = state.easeFactor ?? 2.5;
  const interval = state.intervalDays ?? 0;

  // Lapse: relearn now.
  if (q < 3) return 0;

  const nextEf = Math.max(
    MIN_EF,
    ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  // Learning steps for the first couple of reps (sub-day), then graduate.
  if (reps <= 0) {
    if (key === "hard") return 10 * MINUTE; // 10m
    if (key === "good") return 1; // 1d
    return 4; // easy → 4d
  }
  if (reps === 1) {
    if (key === "hard") return 1;
    if (key === "good") return 3;
    return 6;
  }
  const factor = key === "hard" ? 1.2 : key === "easy" ? nextEf * 1.3 : nextEf;
  return Math.max(1, Math.round(interval * factor));
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
