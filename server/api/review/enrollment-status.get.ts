import { requireRole } from "~/../server/middleware/auth"
import { z } from 'zod'

const EnrollmentStatusRequestSchema = z.object({
  resourceIds: z.array(z.string()),
  resourceType: z.enum(['material', 'flashcard']).optional()
})

const EnrollmentStatusResponseSchema = z.object({
  enrollments: z.record(z.string(), z.boolean()) // resourceId -> isEnrolled
})

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate query parameters
    const query = getQuery(event)
    const resourceIds = typeof query.resourceIds === 'string'
      ? query.resourceIds.split(',')
      : Array.isArray(query.resourceIds)
        ? query.resourceIds
        : []

    const validatedQuery = EnrollmentStatusRequestSchema.parse({
      resourceIds,
      resourceType: query.resourceType
    })

    // Get authenticated user
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    // Check enrollment status for each resource
    const enrollments: Record<string, boolean> = {}

    for (const resourceId of validatedQuery.resourceIds) {
      const existingCard = await prisma.cardReview.findFirst({
        where: {
          userId: user.id,
          cardId: resourceId
        }
      })
      enrollments[resourceId] = !!existingCard
    }

    return EnrollmentStatusResponseSchema.parse({
      enrollments
    })

  } catch (error: unknown) {
    console.error('Error checking enrollment status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check enrollment status'
    })
  }
})
