import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguageGradeRequestSchema } from "@shared/utils/language.contract";
import { gradeReviewCard } from "@server/modules/review/application/gradeReviewCard";
import { PrismaLanguageReviewRepository } from "@server/modules/language-learning/infrastructure/PrismaLanguageReviewRepository";
import { PrismaXpPort } from "@server/modules/review/infrastructure/PrismaXpPort";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  let validatedBody;
  try {
    validatedBody = LanguageGradeRequestSchema.parse(await readBody(event));
  } catch (e) {
    if (e instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request data",
        e.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request data");
  }

  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const result = await gradeReviewCard({
    prisma,
    repository: new PrismaLanguageReviewRepository(),
    xpPort: new PrismaXpPort(),
    userId: user.id,
    cardId: validatedBody.cardId,
    grade: parseInt(validatedBody.grade),
    requestId: validatedBody.requestId,
    xpSource: "language_review",
    reviewedAt: validatedBody.reviewedAt ? new Date(validatedBody.reviewedAt) : undefined,
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "languageReview", entityId: result.reviewId, changedFields: ["reviewState"] });

  return success({
    nextReviewAt: result.nextReviewAt.toISOString(),
    intervalDays: result.intervalDays,
    easeFactor: result.easeFactor,
    xpEarned: result.xpEarned,
  });
});
