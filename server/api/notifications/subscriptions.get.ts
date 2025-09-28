import { prisma } from "~~/server/prisma/utils"
import { success } from "~~/server/utils/error"

export default defineEventHandler(async (_event) => {
  const subscriptions = await prisma.notificationSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      userId: true,
      createdAt: true,
      expiresAt: true,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  const maskedSubscriptions = subscriptions.map(sub => ({
    ...sub,
    endpoint: sub.endpoint.substring(0, 50) + '...'
  }))

  return success(maskedSubscriptions, { total: subscriptions.length })
})
