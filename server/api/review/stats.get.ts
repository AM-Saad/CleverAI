import { z } from "zod";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";
import {
  ReviewSummaryStatsSchema,
  ReviewStatsQuerySchema,
} from "@shared/utils/review.contract";

export default defineEventHandler(async (event) => {
  // Auth
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  // Parse & validate query
  let parsedQuery: z.infer<typeof ReviewStatsQuerySchema>;
  try {
    parsedQuery = ReviewStatsQuerySchema.parse(getQuery(event));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  const { folderId } = parsedQuery;

  // Validate folder ownership if folderId provided
  let folderTitle: string | undefined;
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
      select: { id: true, title: true },
    });

    if (!folder) {
      throw Errors.forbidden("Folder not found or access denied");
    }
    folderTitle = folder.title;
  }

  // Build base where clause
  const baseWhere = {
    userId: user.id,
    suspended: false,
    ...(folderId ? { folderId } : {}),
  };

  // Fetch all stats in parallel for performance
  const [total, newCards, learning, due, mature] = await Promise.all([
    // Total enrolled cards
    prisma.cardReview.count({
      where: baseWhere,
    }),
    // New cards (never reviewed)
    prisma.cardReview.count({
      where: {
        ...baseWhere,
        repetitions: 0,
      },
    }),
    // Learning cards (1-2 repetitions)
    prisma.cardReview.count({
      where: {
        ...baseWhere,
        repetitions: { gt: 0, lt: 3 },
      },
    }),
    // Due cards (review time has passed)
    prisma.cardReview.count({
      where: {
        ...baseWhere,
        nextReviewAt: { lte: new Date() },
      },
    }),
    // Mature cards (3+ repetitions)
    prisma.cardReview.count({
      where: {
        ...baseWhere,
        repetitions: { gte: 3 },
      },
    }),
  ]);

  const payload = ReviewSummaryStatsSchema.parse({
    total,
    new: newCards,
    learning,
    due,
    mature,
    context: folderId
      ? {
          folderId,
          folderTitle,
        }
      : undefined,
  });

  return success(payload);
});
