// server/api/notifications/send.post.ts
import webPush from 'web-push'
import { z } from 'zod'
import { prisma } from '~~/server/prisma/utils'

const NotificationSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  icon: z.string().optional(), // Allow any string (relative paths, URLs, etc.)
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  targetUsers: z.array(z.string()).optional(),
  url: z.string().optional(), // URL to navigate to when clicked
})

export default defineEventHandler(async (event) => {
  // Rate limiting check (simple in-memory implementation)
  const clientIP = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || 'unknown'

  // TODO: Implement proper rate limiting with Redis or similar
  // For now, just log the IP for monitoring
  console.log(`Notification send request from IP: ${clientIP}`)

  webPush.setVapidDetails(
    'mailto:abdelrhmanm525@gmail.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  try {
    // Validate request body
    const body = await readBody(event)
    const message = NotificationSchema.parse(body)

    // TODO: Add proper authentication check when auth is fully implemented
    // For now, add basic validation that prevents anonymous access in production
    if (process.env.NODE_ENV === 'production') {
      // In production, require some form of authorization
      const authHeader = getHeader(event, 'authorization')
      if (!authHeader) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Authorization required'
        })
      }
    }

    // TODO: Replace with actual session check when auth is implemented
    // const session = await getServerSession(event)
    // if (!session?.user || !session.user.role === 'ADMIN') {
    //   throw createError({
    //     statusCode: 401,
    //     statusMessage: 'Unauthorized - Admin access required'
    //   })
    // }

    // Get active subscriptions
    const subscriptions = await prisma.notificationSubscription.findMany({
      where: {
        // If targetUsers specified, filter by userId
        ...(message.targetUsers && {
          userId: { in: message.targetUsers }
        }),
        // Include anonymous subscriptions when no target users specified
        ...(!message.targetUsers && {
          // Get all subscriptions (including ones without userId)
        })
      }
    })

    console.log('🔍 Debug Info:')
    console.log('- Target Users:', message.targetUsers)
    console.log('- Found subscriptions:', subscriptions.length)
    console.log('- Subscription details:', subscriptions.map(s => ({
      id: s.id,
      userId: s.userId,
      endpoint: s.endpoint.substring(0, 50) + '...'
    })))

    let notificationsSent = 0
    let notificationsFailed = 0

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          JSON.stringify({
            title: message.title,
            message: message.message,
            icon: message.icon || '/icons/192x192.png',
            tag: message.tag,
            requireInteraction: message.requireInteraction || false,
            url: message.url || '/', // Include URL for navigation
          })
        )
        console.log('Notification sent to:', subscription.endpoint)
        notificationsSent++
      } catch (error: unknown) {
        console.error('Error sending notification:', error)
        notificationsFailed++

        // Handle expired/invalid subscriptions
        const webPushError = error as { statusCode?: number }
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          await prisma.notificationSubscription.delete({
            where: { id: subscription.id }
          })
          console.log('Deleted invalid subscription:', subscription.id)
        }
      }
    }

    return {
      success: true,
      message: `Notifications sent: ${notificationsSent}, failed: ${notificationsFailed}`,
      details: {
        sent: notificationsSent,
        failed: notificationsFailed,
        total: subscriptions.length
      }
    }
  } catch (error) {
    console.error('Failed to send notifications:', error)

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request data',
        data: error.issues
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
