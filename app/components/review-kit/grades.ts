import type { ReviewGrade } from "~/shared/utils/review.contract";
import { REVIEW_GRADE_BY_KEY } from "~/shared/utils/sm2";

export type ReviewGradeTone = "error" | "warning" | "info" | "success";

export interface ReviewGradeOption {
  /** SM-2 grade value sent to the API. */
  value: ReviewGrade;
  /** Short, action-oriented label. */
  label: string;
  /** One-word recall hint shown beneath the label. */
  hint: string;
  /** Semantic tone (drives the UiButton color). */
  tone: ReviewGradeTone;
  /** Keyboard shortcut (1–4). */
  key: string;
}

/**
 * Canonical 4-point review grade scale (Anki-style), shared by BOTH the normal
 * spaced-repetition review and the language review so the grading vocabulary,
 * colors, and keys are identical across the app. The four choices map onto the
 * SM-2 0–5 scale the backend expects.
 */
export const REVIEW_GRADES: readonly ReviewGradeOption[] = [
  {
    value: REVIEW_GRADE_BY_KEY.again,
    label: "Again",
    hint: "Forgot",
    tone: "error",
    key: "1",
  },
  {
    value: REVIEW_GRADE_BY_KEY.hard,
    label: "Hard",
    hint: "Tough recall",
    tone: "warning",
    key: "2",
  },
  {
    value: REVIEW_GRADE_BY_KEY.good,
    label: "Good",
    hint: "Recalled",
    tone: "info",
    key: "3",
  },
  {
    value: REVIEW_GRADE_BY_KEY.easy,
    label: "Easy",
    hint: "Instant",
    tone: "success",
    key: "4",
  },
];

/** Look up a grade option by its keyboard shortcut. */
export function gradeForKey(key: string): ReviewGradeOption | undefined {
  return REVIEW_GRADES.find((g) => g.key === key);
}
