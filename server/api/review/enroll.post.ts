import { EnrollCardRequestSchema, EnrollCardResponseSchema } from '~/shared/review.contract'
import { requireRole } from "~/../server/middleware/auth"
import { ZodError } from 'zod'
import { Errors, success } from '~~/server/utils/error'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  let validatedBody
  try {
    validatedBody = EnrollCardRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest('Invalid request data', err.issues)
    }
    throw Errors.badRequest('Invalid request data')
  }

  let resourceType: 'material' | 'flashcard'
  let resourceId: string
  if ('materialId' in validatedBody) {
    resourceType = 'material'
    resourceId = validatedBody.materialId
  } else {
    resourceType = validatedBody.resourceType
    resourceId = validatedBody.resourceId
  }

  const user = await requireRole(event, ["USER"]) // throws unauthorized if not
  const prisma = event.context.prisma

  let resolvedFolderId: string | null = null
  if (resourceType === 'material') {
    const material = await prisma.material.findFirst({
      where: { id: resourceId, folder: { userId: user.id } },
      include: { folder: true }
    })
    if (material) resolvedFolderId = material.folderId
  } else {
    const flashcard = await prisma.flashcard.findFirst({ where: { id: resourceId, folder: { userId: user.id } } })
    if (flashcard) resolvedFolderId = flashcard.folderId
  }

  if (!resolvedFolderId) {
    throw Errors.notFound('Material')
  }

  const existingCard = await prisma.cardReview.findFirst({ where: { userId: user.id, cardId: resourceId } })
  if (existingCard) {
    return success(EnrollCardResponseSchema.parse({
      success: true,
      cardId: existingCard.id,
      message: 'Card already enrolled'
    }))
  }

  const card = await prisma.cardReview.create({
    data: {
      userId: user.id,
      cardId: resourceId,
      folderId: resolvedFolderId,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      nextReviewAt: new Date(),
      streak: 0
    }
  })

  return success(EnrollCardResponseSchema.parse({
    success: true,
    cardId: card.id,
    message: 'Card enrolled successfully'
  }))
})
