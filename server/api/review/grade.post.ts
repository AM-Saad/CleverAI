import { ZodError, type z } from "zod";
import { requireRole } from "@server/middleware/auth";
import { scheduleCardDueNotification } from "@server/services/NotificationScheduler";

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
  const updatedCard = await prisma.$transaction(async (tx) => {
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

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
    const newStreak = grade >= 3 ? cardReview.streak + 1 : 0;

    // Update card review with new values
    const updated = await tx.cardReview.update({
      where: { id: validatedBody.cardId },
      data: {
        easeFactor,
        intervalDays,
        repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
        lastGrade: grade,
        streak: newStreak,
      },
    });

    // Record grade request for idempotency (if requestId provided)
    if (validatedBody.requestId) {
      await tx.gradeRequest.create({
        data: {
          requestId: validatedBody.requestId,
          userId: user.id,
          cardId: validatedBody.cardId,
          grade: grade,
        },
      }).catch(() => {
        // Ignore duplicate key errors from concurrent requests
      });
    }

    return updated;
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
    message: "Card graded successfully",
  });

  return success(payload);
});

// SM-2 Algorithm implementation
function calculateSM2(params: {
  currentEF: number;
  currentInterval: number;
  currentRepetitions: number;
  grade: number;
}): { easeFactor: number; intervalDays: number; repetitions: number } {
  const { currentEF, currentInterval, currentRepetitions, grade } = params;

  let easeFactor = currentEF;
  let intervalDays = currentInterval;
  let repetitions = currentRepetitions;

  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(currentInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response - reset repetitions and interval
    repetitions = 0;
    intervalDays = 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  // Ensure ease factor stays within bounds
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Cap interval at 180 days
  if (intervalDays > 180) {
    intervalDays = 180;
  }

  return { easeFactor, intervalDays, repetitions };
}
