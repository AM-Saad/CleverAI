// server/api/notifications/test.post.ts
import webPush from 'web-push'
import { z } from 'zod'
import { prisma } from '~~/server/prisma/utils'
import type { NotificationSubscription } from '@prisma/client'
import { Errors, success } from '~~/server/utils/error'

type TestResult = {
  success: boolean
  subscription: string
  error?: string
}

const TestNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  icon: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  url: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    throw Errors.notFound('endpoint')
  }

  webPush.setVapidDetails(
    'mailto:abdelrhmanm525@gmail.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  try {
    const body = await readBody(event)
    let validatedNotification
    try {
      validatedNotification = TestNotificationSchema.parse(body)
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw Errors.badRequest('Invalid notification data', e.issues.map(issue => ({ path: issue.path, message: issue.message })))
      }
      throw Errors.badRequest('Invalid notification data')
    }

    console.log('🧪 Test notification request:', validatedNotification)

    // Get all active subscriptions from database
    const subscriptions = await prisma.notificationSubscription.findMany({
      // Get all subscriptions for testing
    })

    if (subscriptions.length === 0) {
      return success({
        message: 'No active subscriptions found',
        sent: 0,
        failed: 0,
        subscriptions: 0
      })
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title: validatedNotification.title,
      body: validatedNotification.message,
      icon: validatedNotification.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: validatedNotification.tag || `test-${Date.now()}`,
      requireInteraction: validatedNotification.requireInteraction || false,
      data: {
        url: validatedNotification.url || '/debug',
        timestamp: Date.now(),
        type: 'test'
      }
    })

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: NotificationSubscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys
            },
            payload
          )
          return { success: true, subscription: sub.id }
        } catch (error) {
          console.error(`Failed to send test notification to subscription ${sub.id}:`, error)

          // Note: In test mode, we don't automatically deactivate subscriptions

          return { success: false, subscription: sub.id, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })
    )

    const sent = results.filter((r: PromiseSettledResult<TestResult>) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - sent

    console.log(`🧪 Test notification results: ${sent} sent, ${failed} failed`)

    return success({
      message: `Test notification sent to ${sent} of ${subscriptions.length} subscriptions`,
      sent,
      failed,
      subscriptions: subscriptions.length,
      results: results.map((r: PromiseSettledResult<TestResult>) => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    })

  } catch (error: unknown) {
    console.error('Test notification error:', error)
    if (error instanceof z.ZodError) {
      throw Errors.badRequest('Invalid notification data', error.issues.map(issue => ({ path: issue.path, message: issue.message })))
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.server('Failed to send test notification')
  }
})
