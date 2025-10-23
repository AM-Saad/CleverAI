import { z } from "zod";
import { requireRole } from "@server/middleware/auth";

const EnrollmentStatusRequestSchema = z.object({
  resourceIds: z.array(z.string()),
  resourceType: z.enum(["material", "flashcard"]).optional(),
});

const EnrollmentStatusResponseSchema = z.object({
  enrollments: z.record(z.string(), z.boolean()), // resourceId -> isEnrolled
});

export default defineEventHandler(async (event) => {
  // Parse query
  const rawQuery = getQuery(event);
  const resourceIds =
    typeof rawQuery.resourceIds === "string"
      ? rawQuery.resourceIds.split(",")
      : Array.isArray(rawQuery.resourceIds)
        ? rawQuery.resourceIds
        : [];
  let validatedQuery;
  try {
    validatedQuery = EnrollmentStatusRequestSchema.parse({
      resourceIds,
      resourceType: rawQuery.resourceType,
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

  for (const resourceId of validatedQuery.resourceIds) {
    try {
      const existingCard = await prisma.cardReview.findFirst({
        where: { userId: user.id, cardId: resourceId },
      });
      enrollments[resourceId] = !!existingCard;
    } catch {
      throw Errors.server("Failed to check enrollment status");
    }
  }

  const payload = EnrollmentStatusResponseSchema.parse({ enrollments });
  return success(payload);
});
