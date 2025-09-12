import { EnrollCardRequestSchema, EnrollCardResponseSchema } from '~/shared/review.contract'
import { requireRole } from "~/../server/middleware/auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedBody = EnrollCardRequestSchema.parse(body)

    // Normalize incoming payload to resourceType/resourceId
    let resourceType: 'material' | 'flashcard'
    let resourceId: string
    if ('materialId' in validatedBody) {
      resourceType = 'material'
      resourceId = validatedBody.materialId
    } else {
      resourceType = validatedBody.resourceType
      resourceId = validatedBody.resourceId
    }

    // Get authenticated user
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    // Try to resolve the provided resource id and validate ownership
    console.log('Enroll request for id=', resourceId, 'type=', resourceType, 'user=', user.id)
    let resolvedFolderId: string | null = null

    if (resourceType === 'material') {
      const material = await prisma.material.findFirst({
        where: { id: resourceId, folder: { userId: user.id } },
        include: { folder: true }
      })
      if (material) resolvedFolderId = material.folderId
    } else {
      const flashcard = await prisma.flashcard.findFirst({
        where: { id: resourceId, folder: { userId: user.id } }
      })
      if (flashcard) resolvedFolderId = flashcard.folderId
    }

    if (!resolvedFolderId) {
      console.error('Enroll: resource not found or not owned by user', { id: resourceId, resourceType, userId: user.id })
      throw createError({ statusCode: 404, statusMessage: 'Material not found or access denied' })
    }

    // Check if card is already enrolled
    const existingCard = await prisma.cardReview.findFirst({
      where: { userId: user.id, cardId: resourceId }
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
        cardId: resourceId, // store the provided id (flashcard or material)
        folderId: resolvedFolderId,
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        nextReviewAt: new Date(),
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
