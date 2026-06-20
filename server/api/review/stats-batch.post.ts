import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  ReviewStatsBatchRequestSchema,
  ReviewStatsBatchResponseSchema,
  type ReviewWorkspaceStats,
} from "@shared/utils/review.contract";

/**
 * Batch per-workspace review stats for the workspaces list.
 *
 * Replaces N calls to GET /api/review/stats (one per workspace) with a single
 * round trip. Scoped to the authenticated user's CardReview rows, so workspace
 * ids the user doesn't own simply come back as zeros (no leak). Buckets mirror
 * stats.get.ts exactly: new (reps=0), learning (1-2), due (nextReviewAt<=now),
 * mature (3+).
 */
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let body: z.infer<typeof ReviewStatsBatchRequestSchema>;
  try {
    body = ReviewStatsBatchRequestSchema.parse(await readBody(event));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const workspaceIds = Array.from(new Set(body.workspaceIds));

  // Pre-seed every requested id so the client never has to null-check.
  const stats: Record<string, ReviewWorkspaceStats> = {};
  for (const id of workspaceIds) {
    stats[id] = { total: 0, new: 0, learning: 0, due: 0, mature: 0, lastReviewedAt: null };
  }

  // One query: pull the user's enrolled cards for these workspaces and bucket
  // in memory. Card counts per user are bounded, so this is a single round trip
  // (the [workspaceId, nextReviewAt] index covers the filter).
  const rows = await prisma.cardReview.findMany({
    where: { userId: user.id, suspended: false, workspaceId: { in: workspaceIds } },
    select: { workspaceId: true, repetitions: true, nextReviewAt: true, lastReviewedAt: true },
  });

  const now = Date.now();
  for (const row of rows) {
    const entry = stats[row.workspaceId];
    if (!entry) continue; // defensive: shouldn't happen given the `in` filter

    entry.total += 1;
    if (row.repetitions === 0) entry.new += 1;
    else if (row.repetitions < 3) entry.learning += 1;
    if (row.repetitions >= 3) entry.mature += 1;
    if (row.nextReviewAt && new Date(row.nextReviewAt).getTime() <= now) entry.due += 1;

    if (row.lastReviewedAt) {
      const iso = new Date(row.lastReviewedAt).toISOString();
      if (!entry.lastReviewedAt || iso > entry.lastReviewedAt) entry.lastReviewedAt = iso;
    }
  }

  return success(ReviewStatsBatchResponseSchema.parse({ stats }));
});
