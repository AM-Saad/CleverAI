import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
  userId: z.string().optional(), // For testing purposes
})

export default defineEventHandler(async (event) => {
  let body: unknown
  try {
    body = await readBody(event)
    console.log('📥 Received subscription data:', body)

    const subscription = SubscriptionSchema.parse(body)

    // TODO: Get user ID from session when auth is implemented
    // const session = await getServerSession(event)
    // const userId = session?.user?.id

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
        userId: subscription.userId || null, // Use provided userId or null for anonymous
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
