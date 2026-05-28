import type { Prisma } from "@prisma/client";

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

export async function getLanguageReviewQueue(input: GetLanguageReviewQueueInput) {
  const prefs = await input.prisma.userLanguagePreferences.findUnique({
    where: { userId: input.userId },
  });
  const limit = Math.min(input.limit, prefs?.sessionCardLimit ?? 12);
  const targetLanguage = input.targetLanguage ?? prefs?.targetLanguage;
  const nativeLanguage = input.nativeLanguage ?? prefs?.nativeLanguage;

  const cardReviews: LanguageQueueRow[] =
    await input.prisma.languageCardReview.findMany({
      where: {
        userId: input.userId,
        nextReviewAt: { lte: new Date() },
        suspended: false,
        word: {
          ...(targetLanguage ? { sourceLang: targetLanguage } : {}),
          ...(nativeLanguage ? { translationLang: nativeLanguage } : {}),
        },
      },
      take: limit,
      orderBy: { nextReviewAt: "asc" },
      include: {
        word: {
          select: {
            id: true,
            word: true,
            translation: true,
            sourceLang: true,
            translationLang: true,
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

  return {
    cards: cardReviews.map((cardReview) => ({
      cardId: cardReview.id,
      wordId: cardReview.wordId,
      word: cardReview.word.word,
      translation: cardReview.word.translation,
      sourceLang: cardReview.word.sourceLang,
      translationLang: cardReview.word.translationLang,
      storyId: cardReview.story?.id ?? null,
      storyText: cardReview.story?.storyText ?? null,
      sentences: cardReview.story?.sentences ?? null,
      mode: cardReview.story ? "story_cloze" : "word_translation",
      reviewState: {
        intervalDays: cardReview.intervalDays,
        easeFactor: cardReview.easeFactor,
        repetitions: cardReview.repetitions,
        nextReviewAt: cardReview.nextReviewAt,
        lastGrade: cardReview.lastGrade,
        streak: cardReview.streak,
      },
    })),
  };
}
