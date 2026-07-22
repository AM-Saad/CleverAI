import type { LanguageWord } from "@shared/utils/language.contract";
import { accentVarFor } from "~/composables/useAccentColor";

export interface LanguageWordRowViewModel {
  word: LanguageWord;
  accent: string;
  badgeLabel: string;
  badgeColor: string;
  reviewLabel: string;
  reviewDisabled: boolean;
}

export function createLanguageWordRowViewModel(
  word: LanguageWord,
  enrollingId: string | null,
): LanguageWordRowViewModel {
  return {
    word,
    accent: accentVarFor(word.word),
    badgeLabel:
      word.status === "mastered" ? "mastered" : word.status.replace("_", " "),
    badgeColor:
      word.status === "mastered"
        ? "var(--color-success)"
        : word.status === "enrolled"
          ? "var(--color-primary)"
          : word.status === "story_ready"
            ? "var(--color-warning)"
            : "var(--color-content-secondary)",
    reviewLabel:
      enrollingId === word.id
        ? "Adding…"
        : word.status === "enrolled"
          ? "In review"
          : "Review",
    reviewDisabled:
      enrollingId === word.id ||
      word.status === "mastered" ||
      word.status === "enrolled",
  };
}
