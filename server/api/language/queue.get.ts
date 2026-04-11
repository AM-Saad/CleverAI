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
        e.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  // Get user preferences to respect session card limit
  const prefs = await prisma.userLanguagePreferences.findUnique({
    where: { userId: user.id },
  });
  const limit = Math.min(
    parsedQuery.limit,
    prefs?.sessionCardLimit ?? 12
  );

  const cardReviews = await prisma.languageCardReview.findMany({
    where: {
      userId: user.id,
      nextReviewAt: { lte: new Date() },
      suspended: false,
      storyId: { not: null }, // only cards that have a story can be reviewed
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

  const cards = cardReviews.map((cr) => ({
    cardId: cr.id,
    wordId: cr.wordId,
    word: cr.word.word,
    translation: cr.word.translation,
    sourceLang: cr.word.sourceLang,
    translationLang: cr.word.translationLang,
    storyId: cr.story?.id ?? null,
    storyText: cr.story?.storyText ?? null,
    sentences: cr.story?.sentences ?? null,
    reviewState: {
      intervalDays: cr.intervalDays,
      easeFactor: cr.easeFactor,
      repetitions: cr.repetitions,
      nextReviewAt: cr.nextReviewAt,
      lastGrade: cr.lastGrade,
      streak: cr.streak,
    },
  }));

  return success({ cards });
});
