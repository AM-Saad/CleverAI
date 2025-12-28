import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { calculateEnrollXP } from "@server/utils/xp";
import { startOfDay, endOfDay } from "date-fns";

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

  let xpEarned = 0;

  if (isNewEnrollment) {
    // Check if we already awarded enroll XP for this card to be safe (idempotency)
    const existingXp = await prisma.xpEvent.findFirst({
      where: {
        userId: user.id,
        cardId: card.cardId, // CORRECT: Use polymorphic resource ID
        source: "enroll"
      }
    });

    if (!existingXp) {
      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);

      // Query today's accumulated XP
      const DailyXpAggregate = await prisma.xpEvent.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { xp: true },
      });
      const currentDailyXP = DailyXpAggregate._sum.xp || 0;

      const xp = calculateEnrollXP(currentDailyXP);

      await prisma.xpEvent.create({
        data: {
          userId: user.id,
          cardId: card.cardId, // CORRECT: Use polymorphic resource ID
          source: "enroll",
          xp: xp,
          createdAt: now
        }
      });
      xpEarned = xp;
    }
  }

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
