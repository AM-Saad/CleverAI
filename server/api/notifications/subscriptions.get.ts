import { prisma } from "~~/server/prisma/utils"

export default defineEventHandler(async (_event) => {
  try {
    // TODO: Add authentication check when auth is implemented
    // const session = await getServerSession(event)
    // if (!session?.user) {
    //   throw createError({
    //     statusCode: 401,
    //     statusMessage: 'Unauthorized'
    //   })
    // }
    // const userId = session.user.id

    // For now, get all subscriptions (in production, filter by user)
    const subscriptions = await prisma.notificationSubscription.findMany({
      select: {
        id: true,
        endpoint: true,
        userId: true,
        createdAt: true,
        expiresAt: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Mask sensitive endpoint data for security
    const maskedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      endpoint: sub.endpoint.substring(0, 50) + '...'
    }))

    return {
      success: true,
      data: maskedSubscriptions,
      total: subscriptions.length
    }
  } catch (error) {
    console.error("Failed to get subscriptions:", error)

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    })
  }
})
