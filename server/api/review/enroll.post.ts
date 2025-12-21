import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

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

  let resolvedFolderId: string | null = null;
  if (resourceType === "material") {
    const material = await prisma.material.findFirst({
      where: { id: resourceId, folder: { userId: user.id } },
      include: { folder: true },
    });
    if (material) resolvedFolderId = material.folderId;
  } else if (resourceType === "flashcard") {
    const flashcard = await prisma.flashcard.findFirst({
      where: { id: resourceId, folder: { userId: user.id } },
    });
    if (flashcard) resolvedFolderId = flashcard.folderId;
  } else if (resourceType === "question") {
    const question = await prisma.question.findFirst({
      where: { id: resourceId, folder: { userId: user.id } },
    });
    if (question) resolvedFolderId = question.folderId;
  }

  if (!resolvedFolderId) {
    throw Errors.notFound("Resource");
  }

  // Use upsert to handle concurrent enrollment requests safely
  // This prevents duplicate CardReview records for the same user+card combination
  const card = await prisma.cardReview.upsert({
    where: {
      userId_cardId: {
        userId: user.id,
        cardId: resourceId,
      },
    },
    update: {
      // No-op update if already exists (just return existing record)
    },
    create: {
      userId: user.id,
      cardId: resourceId,
      folderId: resolvedFolderId,
      resourceType: resourceType,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      nextReviewAt: new Date(),
      streak: 0,
    },
  });

  // Determine if this was a new enrollment or existing
  const isNewEnrollment = !card.lastReviewedAt;

  return success(
    EnrollCardResponseSchema.parse({
      success: true,
      cardId: card.id,
      message: isNewEnrollment
        ? "Card enrolled successfully"
        : "Card already enrolled",
    })
  );
});
