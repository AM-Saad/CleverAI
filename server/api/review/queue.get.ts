import { z } from "zod";
import { requireRole } from "@server/middleware/auth";

// Query validation
const querySchema = z.object({
  folderId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export default defineEventHandler(async (event) => {
  // Auth
  const user = await requireRole(event, ["USER"]); // will throw standardized auth error on failure
  const prisma = event.context.prisma;

  // Parse & validate query
  let parsedQuery: z.infer<typeof querySchema>;
  try {
    parsedQuery = querySchema.parse(getQuery(event));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }
  const { folderId, limit } = parsedQuery;

  // Build where clause
  const whereClause = {
    userId: user.id,
    nextReviewAt: { lte: new Date() },
    ...(folderId ? { folderId } : {}),
  };

  // Fetch due cardReviews
  let cardReviews;
  try {
    cardReviews = await prisma.cardReview.findMany({
      where: whereClause,
      take: limit,
      orderBy: { nextReviewAt: "asc" },
    });
  } catch {
    throw Errors.server("Failed to load review queue");
  }

  const cardIds = cardReviews.map((c) => c.cardId);

  // Fetch materials & flashcards in parallel
  const [materials, flashcards] = await Promise.all([
    prisma.material.findMany({
      where: { id: { in: cardIds } },
      include: { folder: true },
    }),
    prisma.flashcard.findMany({
      where: { id: { in: cardIds } },
      include: { folder: true },
    }),
  ]);

  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const flashcardMap = new Map(flashcards.map((f) => [f.id, f]));

  const cards = cardReviews
    .map((cardReview) => {
      const resourceType = cardReview.resourceType.toLowerCase() as
        | "material"
        | "flashcard";
      if (resourceType === "material") {
        const material = materialMap.get(cardReview.cardId);
        if (!material) return null;
        return {
          cardId: cardReview.id,
          resourceType: "material" as const,
          resourceId: cardReview.cardId,
          resource: {
            title: material.title,
            content: material.content,
            tags: [],
            folderId: material.folderId,
          },
          reviewState: {
            repetitions: cardReview.repetitions,
            easeFactor: cardReview.easeFactor,
            intervalDays: cardReview.intervalDays,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            lastReviewedAt: cardReview.lastReviewedAt?.toISOString(),
          },
        };
      } else {
        const flashcard = flashcardMap.get(cardReview.cardId);
        if (!flashcard) return null;
        return {
          cardId: cardReview.id,
          resourceType: "flashcard" as const,
          resourceId: cardReview.cardId,
          resource: {
            front: flashcard.front,
            back: flashcard.back,
            hint: undefined,
            tags: [],
            folderId: flashcard.folderId,
          },
          reviewState: {
            repetitions: cardReview.repetitions,
            easeFactor: cardReview.easeFactor,
            intervalDays: cardReview.intervalDays,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            lastReviewedAt: cardReview.lastReviewedAt?.toISOString(),
          },
        };
      }
    })
    .filter(Boolean);

  // Stats (execute in parallel where possible)
  const [totalCards, newCards, learningCards] = await Promise.all([
    prisma.cardReview.count({
      where: { userId: user.id, ...(folderId ? { folderId } : {}) },
    }),
    prisma.cardReview.count({
      where: {
        userId: user.id,
        repetitions: 0,
        ...(folderId ? { folderId } : {}),
      },
    }),
    prisma.cardReview.count({
      where: {
        userId: user.id,
        repetitions: { gt: 0, lt: 3 },
        ...(folderId ? { folderId } : {}),
      },
    }),
  ]);
  const dueCards = cardReviews.length;

  const payload = ReviewQueueResponseSchema.parse({
    cards,
    stats: {
      total: totalCards,
      new: newCards,
      due: dueCards,
      learning: learningCards,
    },
  });

  return success(payload);
});
