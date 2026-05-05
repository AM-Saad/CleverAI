import type { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let parsedQuery: z.infer<typeof querySchema>;
  try {
    parsedQuery = querySchema.parse(getQuery(event));
  } catch (e) {
    if (e instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        e.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  // Get user preferences to respect session card limit
  const prefs = await prisma.userLanguagePreferences.findUnique({
    where: { userId: user.id },
  });
  const limit = Math.min(parsedQuery.limit, prefs?.sessionCardLimit ?? 12);

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

  const cardReviews: LanguageQueueRow[] = await prisma.languageCardReview.findMany({
    where: {
      userId: user.id,
      nextReviewAt: { lte: new Date() },
      suspended: false,
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

  const cards = cardReviews.map((cardReview: LanguageQueueRow) => ({
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
  }));

  return success({ cards });
});
