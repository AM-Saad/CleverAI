import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  EnrollCardRequestSchema,
  EnrollCardResponseSchema,
} from "@shared/utils/review.contract";
import { enrollReviewableResource } from "@server/modules/review/application/enrollReviewableResource";
import { PrismaReviewableResourceResolver } from "@server/modules/review/infrastructure/PrismaReviewableResourceResolver";
import { PrismaXpPort } from "@server/modules/review/infrastructure/PrismaXpPort";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  let validatedBody;
  try {
    validatedBody = EnrollCardRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest("Invalid request data", err.issues);
    }
    throw Errors.badRequest("Invalid request data");
  }

  let resourceType: "material" | "flashcard" | "question";
  let resourceId: string;
  if ("materialId" in validatedBody) {
    resourceType = "material";
    resourceId = validatedBody.materialId;
  } else {
    resourceType = validatedBody.resourceType;
    resourceId = validatedBody.resourceId;
  }

  const user = await requireRole(event, ["USER"]); // throws unauthorized if not
  const prisma = event.context.prisma;

  const { card, isNewEnrollment, xpEarned } = await enrollReviewableResource({
    prisma,
    resolver: new PrismaReviewableResourceResolver(prisma),
    xpPort: new PrismaXpPort(),
    userId: user.id,
    resourceType,
    resourceId,
  });

  return success(
    EnrollCardResponseSchema.parse({
      success: true,
      cardId: card.id,
      message: xpEarned > 0
        ? `Card enrolled successfully (+${xpEarned} XP)`
        : (isNewEnrollment ? "Card enrolled successfully" : "Card already enrolled"),
    })
  );
});
