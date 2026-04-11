import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguageGradeRequestSchema } from "@shared/utils/language.contract";
import { calculateSM2, calculateNextReviewDate } from "@server/utils/sm2";
import { calculateReviewXP } from "@server/utils/xp";
import { startOfDay, endOfDay } from "date-fns";

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

  // Idempotency check
  if (validatedBody.requestId) {
    const existing = await prisma.gradeRequest.findUnique({
      where: { requestId: validatedBody.requestId },
    });
    if (existing) {
      const cardReview = await prisma.languageCardReview.findFirst({
        where: { id: validatedBody.cardId, userId: user.id },
      });
      if (cardReview) {
        return success({
          nextReviewAt: cardReview.nextReviewAt.toISOString(),
          intervalDays: cardReview.intervalDays,
          easeFactor: cardReview.easeFactor,
          xpEarned: 0,
        });
      }
    }
  }

  const { updatedCard, xpEarned } = await prisma.$transaction(async (tx) => {
    const cardReview = await tx.languageCardReview.findFirst({
      where: { id: validatedBody.cardId, userId: user.id },
    });

    if (!cardReview) {
      throw Errors.notFound("card");
    }

    const grade = parseInt(validatedBody.grade);

    const { easeFactor, intervalDays, repetitions } = calculateSM2({
      currentEF: cardReview.easeFactor,
      currentInterval: cardReview.intervalDays,
      currentRepetitions: cardReview.repetitions,
      grade,
    });

    const nextReviewAt = calculateNextReviewDate(intervalDays);
    const newStreak = grade >= 3 ? cardReview.streak + 1 : 0;

    // XP calculation
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const DailyXpAggregate = await tx.xpEvent.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { xp: true },
    });
    const currentDailyXP = DailyXpAggregate._sum.xp || 0;

    const existingXp = await tx.xpEvent.findFirst({
      where: {
        userId: user.id,
        cardId: cardReview.wordId,
        source: "language_review",
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    let effectiveXP = 0;
    if (!existingXp) {
      const calcResult = calculateReviewXP({
        easeFactor: cardReview.easeFactor,
        intervalDays: cardReview.intervalDays,
        grade,
        now,
        nextReviewAt: cardReview.nextReviewAt,
        dailyXP: currentDailyXP,
      });
      effectiveXP = calcResult.effectiveXP;

      await tx.xpEvent.create({
        data: {
          userId: user.id,
          cardId: cardReview.wordId,
          source: "language_review",
          xp: effectiveXP,
          createdAt: now,
        },
      });
    }

    const updated = await tx.languageCardReview.update({
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

    // Update word status if mastered (interval >= 21 days)
    if (intervalDays >= 21) {
      await tx.languageWord.update({
        where: { id: cardReview.wordId },
        data: { status: "mastered" },
      });
    }

    if (validatedBody.requestId) {
      await tx.gradeRequest
        .create({
          data: {
            requestId: validatedBody.requestId,
            userId: user.id,
            cardId: validatedBody.cardId,
            grade,
          },
        })
        .catch(() => {
          // Ignore duplicate key errors from concurrent requests
        });
    }

    return { updatedCard: updated, xpEarned: effectiveXP };
  });

  return success({
    nextReviewAt: updatedCard.nextReviewAt.toISOString(),
    intervalDays: updatedCard.intervalDays,
    easeFactor: updatedCard.easeFactor,
    xpEarned,
  });
});
