import { ZodError, type z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  GradeCardRequestSchema,
  GradeCardResponseSchema,
} from "@shared/utils/review.contract";
import { gradeReviewCard } from "@server/modules/review/application/gradeReviewCard";
import { PrismaCardReviewRepository } from "@server/modules/review/infrastructure/PrismaCardReviewRepository";
import { PrismaXpPort } from "@server/modules/review/infrastructure/PrismaXpPort";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  // Parse & validate body
  let validatedBody: z.infer<typeof GradeCardRequestSchema>;
  try {
    validatedBody = GradeCardRequestSchema.parse(await readBody(event));
  } catch (e) {
    if (e instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request data",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid request data");
  }

  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const result = await gradeReviewCard({
    prisma,
    repository: new PrismaCardReviewRepository(),
    xpPort: new PrismaXpPort(),
    userId: user.id,
    cardId: validatedBody.cardId,
    grade: parseInt(validatedBody.grade),
    requestId: validatedBody.requestId,
    xpSource: "review",
    reviewedAt: validatedBody.reviewedAt ? new Date(validatedBody.reviewedAt) : undefined,
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "review", entityId: result.reviewId, changedFields: ["reviewState"] });

  const payload = GradeCardResponseSchema.parse({
    success: true,
    nextReviewAt: result.nextReviewAt.toISOString(),
    intervalDays: result.intervalDays,
    easeFactor: result.easeFactor,
    message: `Card graded successfully (+${result.xpEarned} XP)`,
  });

  return success(payload);
});
