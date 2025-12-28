import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const EnrollmentStatusRequestSchema = z.object({
  resourceIds: z.union([z.string(), z.array(z.string())]).optional(),
  resourceType: z.enum(["material", "flashcard", "question"]).optional(),
  folderId: z.string().optional(),
});

const EnrollmentStatusResponseSchema = z.object({
  enrollments: z.record(z.string(), z.boolean()), // resourceId -> isEnrolled
});

export default defineEventHandler(async (event) => {
  // Parse query
  const rawQuery = getQuery(event);

  // Normalize resourceIds to array if string
  let resourceIds: string[] = [];
  if (rawQuery.resourceIds) {
    resourceIds = typeof rawQuery.resourceIds === "string"
      ? rawQuery.resourceIds.split(",")
      : (Array.isArray(rawQuery.resourceIds) ? rawQuery.resourceIds as string[] : []);
  }

  let validatedQuery;
  try {
    validatedQuery = EnrollmentStatusRequestSchema.parse({
      resourceIds,
      resourceType: rawQuery.resourceType,
      folderId: rawQuery.folderId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid enrollment query",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid enrollment query");
  }

  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const enrollments: Record<string, boolean> = {};

  try {
    if (validatedQuery.folderId) {
      // OPTIMIZED: Fetch all for folder
      const cards = await prisma.cardReview.findMany({
        where: {
          userId: user.id,
          folderId: validatedQuery.folderId
        },
        select: { cardId: true }
      });

      cards.forEach(c => {
        enrollments[c.cardId] = true;
      });

    } else if (validatedQuery.resourceIds && validatedQuery.resourceIds.length > 0) {
      // OPTIMIZED: Fetch all by IDs (batch)
      const cards = await prisma.cardReview.findMany({
        where: {
          userId: user.id,
          cardId: { in: validatedQuery.resourceIds }
        },
        select: { cardId: true }
      });

      // Default all queried IDs to false first (unless we just want to return found ones?)
      // The contract usually suggests returning status for requested IDs.
      // But for simplicity, we can just return the ones found as true.
      // Frontend usually assumes missing = false.

      cards.forEach(c => {
        enrollments[c.cardId] = true;
      });
    }
  } catch (error) {
    console.error("Failed to fetch enrollment status:", error);
    throw Errors.server("Failed to check enrollment status");
  }

  return success({ enrollments });
});
