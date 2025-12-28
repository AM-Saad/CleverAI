import { ZodError, type z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { scheduleCardDueNotification } from "@server/services/NotificationScheduler";
import { calculateSM2, calculateNextReviewDate } from "@server/utils/sm2";
import { calculateReviewXP } from "@server/utils/xp";
import { startOfDay, endOfDay } from "date-fns";

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

  // Check idempotency if requestId provided
  if (validatedBody.requestId) {
    const existing = await prisma.gradeRequest.findUnique({
      where: { requestId: validatedBody.requestId },
    });
    if (existing) {
      // Return cached result
      const cardReview = await prisma.cardReview.findFirst({
        where: { id: validatedBody.cardId, userId: user.id },
      });
      if (cardReview) {
        return success(
          GradeCardResponseSchema.parse({
            success: true,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            intervalDays: cardReview.intervalDays,
            easeFactor: cardReview.easeFactor,
            message: "Card graded successfully (cached)",
          })
        );
      }
    }
  }

  // Wrap in transaction to prevent race conditions and ensure atomicity
  const { updatedCard, xpEarned } = await prisma.$transaction(async (tx) => {
    // Fetch card review ensuring ownership (locks row for update)
    const cardReview = await tx.cardReview.findFirst({
      where: { id: validatedBody.cardId, userId: user.id },
    });

    if (!cardReview) {
      throw Errors.notFound("card");
    }

    const grade = parseInt(validatedBody.grade);

    // Calculate new SM-2 values based on current state
    const { easeFactor, intervalDays, repetitions } = calculateSM2({
      currentEF: cardReview.easeFactor,
      currentInterval: cardReview.intervalDays,
      currentRepetitions: cardReview.repetitions,
      grade,
    });

    const nextReviewAt = calculateNextReviewDate(intervalDays);
    const newStreak = grade >= 3 ? cardReview.streak + 1 : 0;

    // --- XP Calculation Start ---
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    // Query today's accumulated XP
    const DailyXpAggregate = await tx.xpEvent.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { xp: true },
    });
    const currentDailyXP = DailyXpAggregate._sum.xp || 0;

    // Check for existing XP event for this card today (Idempotency Guard)
    // This prevents duplicate XP if the request is retried or races
    const existingXp = await tx.xpEvent.findFirst({
      where: {
        userId: user.id,
        cardId: cardReview.cardId, // Use the actual resource ID
        source: "review",
        createdAt: { gte: dayStart, lte: dayEnd }
      }
    });

    let effectiveXP = 0;

    if (!existingXp) {
      // Calculate XP
      const calcResult = calculateReviewXP({
        easeFactor: cardReview.easeFactor,
        intervalDays: cardReview.intervalDays,
        grade: grade,
        now: now,
        nextReviewAt: cardReview.nextReviewAt,
        dailyXP: currentDailyXP,
      });
      effectiveXP = calcResult.effectiveXP;

      // Insert XP Event
      await tx.xpEvent.create({
        data: {
          userId: user.id,
          cardId: cardReview.cardId, // CORRECT: Use polymorphic resource ID
          source: "review",
          xp: effectiveXP,
          createdAt: now,
        },
      });
    }
    // --- XP Calculation End ---

    // Update card review with new values
    const updated = await tx.cardReview.update({
      where: { id: validatedBody.cardId },
      data: {
        easeFactor,
        intervalDays,
        repetitions,
        nextReviewAt,
        lastReviewedAt: now,
        lastGrade: grade,
        streak: newStreak,
      },
    });

    // Record grade request for idempotency (if requestId provided)
    if (validatedBody.requestId) {
      await tx.gradeRequest
        .create({
          data: {
            requestId: validatedBody.requestId,
            userId: user.id,
            cardId: validatedBody.cardId,
            grade: grade,
          },
        })
        .catch(() => {
          // Ignore duplicate key errors from concurrent requests
        });
    }

    return { updatedCard: updated, xpEarned: effectiveXP };
  });

  // Fire-and-forget notification scheduling (outside transaction)
  scheduleCardDueNotification({
    userId: user.id,
    cardId: validatedBody.cardId,
    scheduledFor: updatedCard.nextReviewAt,
    content: {
      title: "📚 Card Review Due",
      body: "You have a card ready for review!",
      icon: "/icons/icon-192.png",
      tag: `card-due-${validatedBody.cardId}`,
      data: { cardId: validatedBody.cardId, type: "card-due" },
    },
  }).catch((err) =>
    console.error("Failed to schedule card due notification:", err)
  );

  const payload = GradeCardResponseSchema.parse({
    success: true,
    nextReviewAt: updatedCard.nextReviewAt.toISOString(),
    intervalDays: updatedCard.intervalDays,
    easeFactor: updatedCard.easeFactor,
    message: `Card graded successfully (+${xpEarned} XP)`,
  });

  return success(payload);
});
