import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"
import { safeGetServerSession } from "~~/server/utils/safeGetServerSession"

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

type SessionWithUser = {
  user?: {
    email?: string
    id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
} | null

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { endpoint } = UnsubscribeSchema.parse(body)

    // Get user ID from session
    const session = await safeGetServerSession(event) as SessionWithUser
    if (!session?.user?.email) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - must be logged in to unsubscribe'
      })
    }

    // Get user from database to get proper user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User not found'
      })
    }

    // Find and delete the subscription (only allow users to unsubscribe their own subscriptions)
    const deletedSubscription = await prisma.notificationSubscription.deleteMany({
      where: {
        endpoint,
        userId: user.id // Ensure users can only unsubscribe their own subscriptions
      }
    })

    if (deletedSubscription.count === 0) {
      return {
        success: true,
        message: "Subscription not found or already removed",
      }
    }

    return {
      success: true,
      message: "Subscription removed successfully",
      data: { removedCount: deletedSubscription.count },
    }
  } catch (error) {
    console.error("Failed to remove subscription:", error)

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid unsubscribe data',
        data: error.issues
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    })
  }
})
