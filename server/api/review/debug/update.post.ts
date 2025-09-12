import { z } from 'zod'
import { requireRole } from "~/../server/middleware/auth"

const DebugUpdateSchema = z.object({
  cardId: z.string().min(1),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  intervalDays: z.number().min(0).max(365).optional(),
  repetitions: z.number().min(0).max(50).optional(),
  streak: z.number().min(0).max(1000).optional(),
  nextReviewAt: z.string().optional(), // ISO date string
  lastReviewedAt: z.string().optional(), // ISO date string
  lastGrade: z.number().min(0).max(5).optional()
})

export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found'
    })
  }

  try {
    const body = await readBody(event)
    const validatedBody = DebugUpdateSchema.parse(body)

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

    // Prepare update data
    const updateData: {
      easeFactor?: number
      intervalDays?: number
      repetitions?: number
      streak?: number
      nextReviewAt?: Date
      lastReviewedAt?: Date
      lastGrade?: number
    } = {}

    if (validatedBody.easeFactor !== undefined) {
      updateData.easeFactor = validatedBody.easeFactor
    }

    if (validatedBody.intervalDays !== undefined) {
      updateData.intervalDays = validatedBody.intervalDays
    }

    if (validatedBody.repetitions !== undefined) {
      updateData.repetitions = validatedBody.repetitions
    }

    if (validatedBody.streak !== undefined) {
      updateData.streak = validatedBody.streak
    }

    if (validatedBody.nextReviewAt) {
      updateData.nextReviewAt = new Date(validatedBody.nextReviewAt)
    }

    if (validatedBody.lastReviewedAt) {
      updateData.lastReviewedAt = new Date(validatedBody.lastReviewedAt)
    }

    if (validatedBody.lastGrade !== undefined) {
      updateData.lastGrade = validatedBody.lastGrade
    }

    // Update the card
    const updatedCard = await prisma.cardReview.update({
      where: { id: validatedBody.cardId },
      data: updateData
    })

    return {
      success: true,
      message: 'Card debug values updated successfully',
      updatedValues: {
        easeFactor: updatedCard.easeFactor,
        intervalDays: updatedCard.intervalDays,
        repetitions: updatedCard.repetitions,
        streak: updatedCard.streak,
        nextReviewAt: updatedCard.nextReviewAt.toISOString(),
        lastReviewedAt: updatedCard.lastReviewedAt?.toISOString(),
        lastGrade: updatedCard.lastGrade
      }
    }

  } catch (error: unknown) {
    console.error('Debug update error:', error)

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid debug parameters',
        data: error.issues
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update card debug values'
    })
  }
})
