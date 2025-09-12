import { ReviewQueueResponseSchema } from '~/shared/review.contract'
import { requireRole } from "~/../server/middleware/auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"

export default defineEventHandler(async (event) => {
  try {
    // Get authenticated user
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    // Get query parameters
    const query = getQuery(event)
    const folderId = query.folderId as string | undefined
    const limit = parseInt(query.limit as string) || 20

    // Build where clause
    const whereClause = {
      userId: user.id,
      nextReviewAt: {
        lte: new Date() // Due for review
      },
      ...(folderId ? { folderId } : {})
    }

    // Get due cards with material details
    const cardReviews = await prisma.cardReview.findMany({
      where: whereClause,
      take: limit,
      orderBy: {
        nextReviewAt: 'asc' // Review oldest due cards first
      }
    })

    // Get materials for the cards
    const materialIds = cardReviews.map(card => card.cardId)
    const materials = await prisma.material.findMany({
      where: {
        id: { in: materialIds }
      },
      include: {
        folder: true
      }
    })

    // Create material lookup map
    const materialMap = new Map(materials.map(m => [m.id, m]))

    // Transform to response format
    const cards = cardReviews
      .map(cardReview => {
        const material = materialMap.get(cardReview.cardId)
        if (!material) return null

        return {
          cardId: cardReview.id,
          materialId: cardReview.cardId,
          material: {
            front: material.title,
            back: material.content,
            hint: undefined,
            tags: [],
            folderId: material.folderId
          },
          reviewState: {
            repetitions: cardReview.repetitions,
            easeFactor: cardReview.easeFactor,
            intervalDays: cardReview.intervalDays,
            nextReviewAt: cardReview.nextReviewAt.toISOString(),
            lastReviewedAt: cardReview.lastReviewedAt?.toISOString()
          }
        }
      })
      .filter(Boolean)

    // Calculate stats
    const totalCards = await prisma.cardReview.count({
      where: {
        userId: user.id,
        ...(folderId ? { folderId } : {})
      }
    })

    const newCards = await prisma.cardReview.count({
      where: {
        userId: user.id,
        repetitions: 0,
        ...(folderId ? { folderId } : {})
      }
    })

    const dueCards = cardReviews.length

    const learningCards = await prisma.cardReview.count({
      where: {
        userId: user.id,
        repetitions: { gt: 0, lt: 3 },
        ...(folderId ? { folderId } : {})
      }
    })

    return ReviewQueueResponseSchema.parse({
      cards,
      stats: {
        total: totalCards,
        new: newCards,
        due: dueCards,
        learning: learningCards
      }
    })

  } catch (error: unknown) {
    console.error('Error fetching review queue:', error)

    // Handle createError instances
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Handle unexpected errors
    throw ErrorFactory.create(
      ErrorType.Validation,
      "Review",
      "Failed to fetch review queue"
    )
  }
})
