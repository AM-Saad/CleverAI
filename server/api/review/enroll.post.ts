import { EnrollCardRequestSchema, EnrollCardResponseSchema } from '~/shared/review.contract'
import { requireRole } from "~/../server/middleware/auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedBody = EnrollCardRequestSchema.parse(body)
    
    // Get authenticated user
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    // Verify material exists and belongs to user's folders
    const material = await prisma.material.findFirst({
      where: {
        id: validatedBody.materialId,
        folder: {
          userId: user.id
        }
      },
      include: {
        folder: true
      }
    })

    if (!material) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Material not found or access denied'
      })
    }

    // Check if card is already enrolled
    const existingCard = await prisma.cardReview.findFirst({
      where: {
        userId: user.id,
        cardId: validatedBody.materialId // Using materialId as cardId
      }
    })

    if (existingCard) {
      return EnrollCardResponseSchema.parse({
        success: true,
        cardId: existingCard.id,
        message: 'Card already enrolled'
      })
    }

    // Create the card review entry
    const card = await prisma.cardReview.create({
      data: {
        userId: user.id,
        cardId: validatedBody.materialId, // Using materialId as cardId
        folderId: material.folderId,
        repetitions: 0,
        easeFactor: 2.5, // default from SRPolicy
        intervalDays: 0,
        nextReviewAt: new Date(), // available for review immediately
        streak: 0
      }
    })
    
    return EnrollCardResponseSchema.parse({
      success: true,
      cardId: card.id,
      message: 'Card enrolled successfully'
    })
    
  } catch (error: unknown) {
    console.error('Error enrolling card:', error)
    
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
      "Failed to enroll card"
    )
  }
})
