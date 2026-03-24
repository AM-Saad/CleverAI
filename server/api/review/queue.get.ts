import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReviewQueueResponseSchema } from "@shared/utils/review.contract";

// Query validation
const querySchema = z.object({
  workspaceId: z.string().min(1).optional(),
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
  const { workspaceId, limit } = parsedQuery;

  // Validate workspace ownership if workspaceId provided
  if (workspaceId) {
    const workspaceExists = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: user.id },
      select: { id: true }, // Minimal selection for performance
    });

    if (!workspaceExists) {
      throw Errors.forbidden("Workspace not found or access denied");
    }
  }

  // Build where clause
  const whereClause = {
    userId: user.id,
    nextReviewAt: { lte: new Date() },
    suspended: false, // Exclude suspended cards
    ...(workspaceId ? { workspaceId } : {}),
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
  const workspaceIds = [...new Set(cardReviews.map((c) => c.workspaceId))];

  // Fetch all data in parallel - materials, flashcards, questions, AND workspaces separately
  // This avoids N+1 query by fetching workspaces in one query
  const [materials, flashcards, questions, workspaces] = await Promise.all([
    prisma.material.findMany({
      where: { id: { in: cardIds } },
      // Don't include workspace - we'll fetch separately
    }),
    prisma.flashcard.findMany({
      where: { id: { in: cardIds } },
      // Don't include workspace - we'll fetch separately
    }),
    prisma.question.findMany({
      where: { id: { in: cardIds } },
      // Don't include workspace - we'll fetch separately
    }),
    prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
      select: { id: true, title: true, userId: true },
    }),
  ]);

  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const flashcardMap = new Map(flashcards.map((f) => [f.id, f]));
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const workspaceMap = new Map(workspaces.map((f) => [f.id, f]));

  // Check for orphaned cards
  const orphanedCards = cardReviews.filter((cr) => {
    const type = cr.resourceType.toLowerCase();
    if (type === "material") return !materialMap.has(cr.cardId);
    if (type === "question") return !questionMap.has(cr.cardId);
    return !flashcardMap.has(cr.cardId);
  });
  if (orphanedCards.length > 0) {
    console.warn(
      `[review/queue] WARNING: ${orphanedCards.length} orphaned CardReview records found (resources deleted):`,
      orphanedCards.map((c) => ({
        id: c.id,
        cardId: c.cardId,
        resourceType: c.resourceType,
      }))
    );
  }

  const cards = cardReviews
    .map((cardReview) => {
      const resourceType = cardReview.resourceType.toLowerCase() as
        | "material"
        | "flashcard"
        | "question";
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
            workspaceId: material.workspaceId,
          },
          reviewState: {
            repetitions: cardReview.repetitions,
            easeFactor: cardReview.easeFactor,
            intervalDays: cardReview.intervalDays,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            lastReviewedAt: cardReview.lastReviewedAt?.toISOString(),
          },
        };
      } else if (resourceType === "flashcard") {
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
            workspaceId: flashcard.workspaceId,
          },
          reviewState: {
            repetitions: cardReview.repetitions,
            easeFactor: cardReview.easeFactor,
            intervalDays: cardReview.intervalDays,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            lastReviewedAt: cardReview.lastReviewedAt?.toISOString(),
          },
        };
      } else if (resourceType === "question") {
        const question = questionMap.get(cardReview.cardId);
        if (!question) return null;
        return {
          cardId: cardReview.id,
          resourceType: "question" as const,
          resourceId: cardReview.cardId,
          resource: {
            question: question.question,
            choices: question.choices,
            answerIndex: question.answerIndex,
            workspaceId: question.workspaceId,
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
        return null;
      }
    })
    .filter(Boolean);

  // Stats (execute in parallel where possible)
  const [totalCards, newCards, learningCards, dueCards] = await Promise.all([
    prisma.cardReview.count({
      where: {
        userId: user.id,
        suspended: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
    }),
    prisma.cardReview.count({
      where: {
        userId: user.id,
        suspended: false,
        repetitions: 0,
        ...(workspaceId ? { workspaceId } : {}),
      },
    }),
    prisma.cardReview.count({
      where: {
        userId: user.id,
        suspended: false,
        repetitions: { gt: 0, lt: 3 },
        ...(workspaceId ? { workspaceId } : {}),
      },
    }),
    prisma.cardReview.count({
      where: {
        userId: user.id,
        suspended: false,
        nextReviewAt: { lte: new Date() },
        ...(workspaceId ? { workspaceId } : {}),
      },
    }),
  ]);

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
