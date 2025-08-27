import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { endpoint } = UnsubscribeSchema.parse(body)

    // TODO: Add authentication check when auth is implemented
    // const session = await getServerSession(event)
    // if (!session?.user) {
    //   throw createError({
    //     statusCode: 401,
    //     statusMessage: 'Unauthorized'
    //   })
    // }

    // Find and delete the subscription
    const deletedSubscription = await prisma.notificationSubscription.delete({
      where: { endpoint }
    }).catch(() => null) // Handle case where subscription doesn't exist

    if (!deletedSubscription) {
      return {
        success: true,
        message: "Subscription not found or already removed",
      }
    }

    return {
      success: true,
      message: "Subscription removed successfully",
      data: deletedSubscription,
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
