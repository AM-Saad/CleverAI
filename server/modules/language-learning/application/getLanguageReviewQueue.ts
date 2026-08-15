import type { Prisma } from "@prisma/client";
import { buildLanguageReviewPresentation } from "../../../../shared/utils/language-review-card";

type GetLanguageReviewQueueInput = {
  prisma: any;
  userId: string;
  limit: number;
  targetLanguage?: string;
  nativeLanguage?: string;
};

type LanguageQueueRow = Prisma.LanguageCardReviewGetPayload<{
  include: {
    word: {
      select: {
        id: true;
        word: true;
        translation: true;
        sourceLang: true;
        translationLang: true;
        partOfSpeech: true;
        phonetic: true;
        meanings: true;
        examples: true;
        sourceContext: true;
      };
    };
    story: {
      select: {
        id: true;
        storyText: true;
        sentences: true;
      };
    };
  };
}>;

export async function getLanguageReviewQueue(
  input: GetLanguageReviewQueueInput,
) {
  const prefs = await input.prisma.userLanguagePreferences.findUnique({
    where: { userId: input.userId },
  });
  const limit = Math.min(input.limit, prefs?.sessionCardLimit ?? 12);
  const targetLanguage = input.targetLanguage ?? prefs?.targetLanguage;
  const nativeLanguage = input.nativeLanguage ?? prefs?.nativeLanguage;

  const baseWhere = {
    userId: input.userId,
    nextReviewAt: { lte: new Date() },
    suspended: false,
  };

  const wordLangFilter = {
    ...(targetLanguage ? { sourceLang: targetLanguage } : {}),
    ...(nativeLanguage ? { translationLang: nativeLanguage } : {}),
  };
  const hasLangFilter = Object.keys(wordLangFilter).length > 0;

  const queryArgs = (where: any) => ({
    where,
    take: Math.min(limit * 3, 100),
    orderBy: { nextReviewAt: "asc" as const },
    include: {
      word: {
        select: {
          id: true,
          word: true,
          translation: true,
          sourceLang: true,
          translationLang: true,
          partOfSpeech: true,
          phonetic: true,
          meanings: true,
          examples: true,
          sourceContext: true,
        },
      },
      story: {
        select: {
          id: true,
          storyText: true,
          sentences: true,
        },
      },
    },
  });

  // Active language pair is a hard session boundary. Mixing another pair when
  // no matching cards are due makes the session label and learner intent false.
  const cardReviews: LanguageQueueRow[] =
    await input.prisma.languageCardReview.findMany(
      queryArgs({
        ...baseWhere,
        ...(hasLangFilter ? { word: wordLangFilter } : {}),
      }),
    );

  return {
    cards: cardReviews
      .flatMap((cardReview) => {
        const reviewCard = buildLanguageReviewPresentation({
          word: cardReview.word,
          story: cardReview.story,
          preferredMode: cardReview.mode,
        });
        // Legacy/incomplete records without a translation or definition are not
        // reviewable. New enrollment rejects them before a review row is created.
        if (!reviewCard) return [];
        const validStory =
          reviewCard.mode === "story_cloze" ? cardReview.story : null;

        return [
          {
            cardId: cardReview.id,
            wordId: cardReview.wordId,
            word: cardReview.word.word,
            translation: cardReview.word.translation,
            sourceLang: cardReview.word.sourceLang,
            translationLang: cardReview.word.translationLang,
            storyId: validStory?.id ?? null,
            storyText: validStory?.storyText ?? null,
            sentences: validStory?.sentences ?? null,
            mode: reviewCard.mode,
            presentationVersion: cardReview.contentVersion ?? 1,
            presentation: reviewCard.presentation,
            reviewState: {
              intervalDays: cardReview.intervalDays,
              easeFactor: cardReview.easeFactor,
              repetitions: cardReview.repetitions,
              nextReviewAt: cardReview.nextReviewAt,
              lastGrade: cardReview.lastGrade,
              streak: cardReview.streak,
            },
          },
        ];
      })
      .slice(0, limit),
  };
}
