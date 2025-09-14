import { GradeCardRequestSchema, GradeCardResponseSchema } from '~/shared/review.contract'
import { requireRole } from "~/../server/middleware/auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"
import { scheduleCardDueNotification } from "~~/server/services/NotificationScheduler"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedBody = GradeCardRequestSchema.parse(body)

    // Get authenticated user
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    // Find the card review entry
    const cardReview = await prisma.cardReview.findFirst({
      where: {
        id: validatedBody.cardId,
        userId: user.id
      }
    })

    if (!cardReview) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Card not found or access denied'
      })
    }

    // Parse grade to number for calculations
    const grade = parseInt(validatedBody.grade)

    // SM-2 Algorithm implementation
    const { easeFactor, intervalDays, repetitions } = calculateSM2({
      currentEF: cardReview.easeFactor,
      currentInterval: cardReview.intervalDays,
      currentRepetitions: cardReview.repetitions,
      grade
    })

    // Calculate next review date
    const nextReviewAt = new Date()
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays)

    // Update streak based on grade
    const newStreak = grade >= 3 ? cardReview.streak + 1 : 0

    // Update the card review
    const updatedCard = await prisma.cardReview.update({
      where: { id: validatedBody.cardId },
      data: {
        easeFactor,
        intervalDays,
        repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
        lastGrade: grade,
        streak: newStreak
      }
    })

    // Schedule notification for the new due date (async, don't wait)
    scheduleCardDueNotification({
      userId: user.id,
      cardId: validatedBody.cardId,
      scheduledFor: nextReviewAt,
      content: {
        title: '📚 Card Review Due',
        body: 'You have a card ready for review!',
        icon: '/icons/icon-192.png',
        tag: `card-due-${validatedBody.cardId}`,
        data: { cardId: validatedBody.cardId, type: 'card-due' }
      }
    })
      .catch((error: unknown) => {
        console.error('Failed to schedule card due notification:', error)
        // Don't fail the main request if notification scheduling fails
      })

    return GradeCardResponseSchema.parse({
      success: true,
      nextReviewAt: updatedCard.nextReviewAt.toISOString(),
      intervalDays: updatedCard.intervalDays,
      easeFactor: updatedCard.easeFactor,
      message: 'Card graded successfully'
    })

  } catch (error: unknown) {
    console.error('Error grading card:', error)

    // Handle validation errors
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request data',
        data: error.issues
      })
    }

    // Handle createError instances
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Handle unexpected errors
    throw ErrorFactory.create(
      ErrorType.Validation,
      "Review",
      "Failed to grade card"
    )
  }
})

// SM-2 Algorithm implementation
function calculateSM2(params: {
  currentEF: number
  currentInterval: number
  currentRepetitions: number
  grade: number
}): { easeFactor: number; intervalDays: number; repetitions: number } {
  const { currentEF, currentInterval, currentRepetitions, grade } = params

  let easeFactor = currentEF
  let intervalDays = currentInterval
  let repetitions = currentRepetitions

  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(currentInterval * easeFactor)
    }
    repetitions += 1
  } else {
    // Incorrect response - reset repetitions and interval
    repetitions = 0
    intervalDays = 1
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))

  // Ensure ease factor stays within bounds
  if (easeFactor < 1.3) {
    easeFactor = 1.3
  }

  // Cap interval at 180 days
  if (intervalDays > 180) {
    intervalDays = 180
  }

  return { easeFactor, intervalDays, repetitions }
}
