import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { LanguageSentenceSchema } from "@shared/utils/language.contract";

// Story sentences are LLM-generated and persisted without strict per-sentence
// validation, so stored data can drift from the contract shape. Validate here
// so one malformed story can't break the whole review queue's client-side
// response validation.
const StorySentencesSchema = z.array(LanguageSentenceSchema);

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
    ...(targetLanguage && targetLanguage !== nativeLanguage
      ? { sourceLang: targetLanguage }
      : {}),
    ...(nativeLanguage ? { translationLang: nativeLanguage } : {}),
  };
  const hasLangFilter = Object.keys(wordLangFilter).length > 0;

  const queryArgs = (where: any) => ({
    where,
    take: limit,
    orderBy: { nextReviewAt: "asc" as const },
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

  // Scope to the active language pair when set. But the pair comes from
  // preferences (default "en"/"en") while captured words store an auto-detected
  // sourceLang — so an exact-match filter can silently exclude everything.
  // Resilient fallback: if the scoped query finds nothing due, return all the
  // user's due cards so review is never mysteriously empty.
  let cardReviews: LanguageQueueRow[] =
    await input.prisma.languageCardReview.findMany(
      queryArgs({
        ...baseWhere,
        ...(hasLangFilter ? { word: wordLangFilter } : {}),
      }),
    );

  if (cardReviews.length === 0 && hasLangFilter) {
    cardReviews = await input.prisma.languageCardReview.findMany(
      queryArgs(baseWhere),
    );
  }

  return {
    cards: cardReviews.map((cardReview) => {
      // Only treat a card as a story-cloze card when its stored sentences match
      // the contract; otherwise drop the story and fall back to plain word
      // translation so a single malformed story doesn't fail validation for the
      // entire queue.
      const parsedSentences = cardReview.story
        ? StorySentencesSchema.safeParse(cardReview.story.sentences)
        : null;
      const validStory =
        cardReview.story && parsedSentences?.success ? cardReview.story : null;

      return {
        cardId: cardReview.id,
        wordId: cardReview.wordId,
        word: cardReview.word.word,
        translation: cardReview.word.translation,
        sourceLang: cardReview.word.sourceLang,
        translationLang: cardReview.word.translationLang,
        storyId: validStory?.id ?? null,
        storyText: validStory?.storyText ?? null,
        sentences:
          validStory && parsedSentences?.success ? parsedSentences.data : null,
        mode: validStory ? "story_cloze" : "word_translation",
        reviewState: {
          intervalDays: cardReview.intervalDays,
          easeFactor: cardReview.easeFactor,
          repetitions: cardReview.repetitions,
          nextReviewAt: cardReview.nextReviewAt,
          lastGrade: cardReview.lastGrade,
          streak: cardReview.streak,
        },
      };
    }),
  };
}
