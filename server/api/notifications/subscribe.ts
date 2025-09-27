import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"
import { safeGetServerSession } from "~~/server/utils/safeGetServerSession"

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
  userId: z.string().optional(), // For testing purposes - will be overridden by session
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
  let body: unknown
  try {
    body = await readBody(event)
    console.log('📥 Received subscription data:', body)

    const subscription = SubscriptionSchema.parse(body)

    // Get user ID from session
    const session = await safeGetServerSession(event) as SessionWithUser
    if (!session?.user?.email) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - must be logged in to subscribe to notifications'
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

    const userId = user.id

    // Check if subscription already exists
    const existingSubscription = await prisma.notificationSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    })

    if (existingSubscription) {
      return {
        success: true,
        message: "Subscription already exists",
        data: existingSubscription,
      }
    }

    // Store the subscription in MongoDB using Prisma
    const savedSubscription = await prisma.notificationSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: user.id, // Use authenticated user ID
      },
    })

    return {
      success: true,
      message: "Subscription saved",
      data: savedSubscription,
    }
  } catch (error) {
    console.error("Failed to save subscription:", error)

    if (error instanceof z.ZodError) {
      console.error('❌ Zod validation error:', error.issues)
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid subscription data',
        data: {
          issues: error.issues,
          received: body
        }
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    })
  }
})
