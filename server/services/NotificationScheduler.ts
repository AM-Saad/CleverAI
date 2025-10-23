import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface NotificationContent {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
}

export interface ScheduleNotificationParams {
  userId: string
  cardId: string
  scheduledFor: Date
  content: NotificationContent
  metadata?: Record<string, unknown>
}

/**
 * Schedule a card due notification for a user
 */
export async function scheduleCardDueNotification(params: ScheduleNotificationParams) {
  try {
    // Check if user has notification preferences and card due notifications enabled
    const preferences = await prisma.userNotificationPreferences.findUnique({
      where: { userId: params.userId }
    })

    if (!preferences?.cardDueEnabled) {
      console.log(`Card due notifications disabled for user ${params.userId}`)
      return null
    }

    const metadataValue = JSON.parse(JSON.stringify({
      ...params.metadata,
      content: params.content,
      cardId: params.cardId
    }))

    // Find-or-create pattern with proper card filtering
    // First, try to find existing unsent notification for THIS specific card
    const existingNotification = await prisma.scheduledNotification.findFirst({
      where: {
        userId: params.userId,
        type: 'CARD_DUE',
        cardId: params.cardId,  // ✅ Filter by specific card
        sent: false
      }
    })

    if (existingNotification) {
      // Update existing notification
      const notification = await prisma.scheduledNotification.update({
        where: { id: existingNotification.id },
        data: {
          scheduledFor: params.scheduledFor,
          metadata: metadataValue,
          failureCount: 0,
          lastError: null
        }
      })

      console.log(`Updated notification ${notification.id} for card ${params.cardId}`)
      return notification
    } else {
      // Create new notification
      const notification = await prisma.scheduledNotification.create({
        data: {
          userId: params.userId,
          type: 'CARD_DUE',
          cardId: params.cardId,  // ✅ Store specific card ID
          scheduledFor: params.scheduledFor,
          metadata: metadataValue
        }
      })

      console.log(`Created notification ${notification.id} for card ${params.cardId}`)
      return notification
    }
  } catch (error) {
    console.error('Failed to schedule card due notification:', error)
    throw error
  }
}

/**
 * Process pending notifications that are due
 */
export async function processPendingNotifications() {
  try {
    console.log('Processing pending notifications...')

    const now = new Date()

    // Get all pending notifications that are due
    const pendingNotifications = await prisma.scheduledNotification.findMany({
      where: {
        sent: false,
        scheduledFor: {
          lte: now
        }
      },
      include: {
        user: {
          include: {
            notificationSubscriptions: true,
            notificationPreferences: true
          }
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    })

    console.log(`Found ${pendingNotifications.length} pending notifications`)

    for (const notification of pendingNotifications) {
      try {
        await processNotification(notification)
      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error)
        await handleNotificationFailure(notification, error as Error)
      }
    }

    console.log('Finished processing pending notifications')
  } catch (error) {
    console.error('Failed to process pending notifications:', error)
    throw error
  }
}

/**
 * Process a single notification
 */
async function processNotification(notification: any) {
  const { user } = notification

  // Check if user has notification preferences
  const preferences = user.notificationPreferences
  if (!preferences) {
    console.log(`No preferences found for user ${user.id}, skipping notification`)
    await markNotificationAsSkipped(notification.id, 'No notification preferences')
    return
  }

  // For card due notifications, check threshold and update content
  if (notification.type === 'CARD_DUE') {
    const dueCardsCount = await getDueCardsCount(user.id)
    if (dueCardsCount < preferences.cardDueThreshold) {
      console.log(`Only ${dueCardsCount} cards due, below threshold of ${preferences.cardDueThreshold}`)
      await markNotificationAsSkipped(notification.id, `Below threshold: ${dueCardsCount} < ${preferences.cardDueThreshold}`)
      return
    }

    // Update notification content with actual due cards count
    const content = {
      title: `${dueCardsCount} cards ready for review!`,
      body: `You have ${dueCardsCount} spaced repetition cards due for review.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'card-due',
      data: {
        dueCardsCount,
        type: 'card_due',
        url: '/review'
      }
    }

    // Update the metadata with the current content
    const updatedMetadata = JSON.parse(JSON.stringify({
      ...notification.metadata,
      content
    }))

    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        metadata: updatedMetadata
      }
    })

    notification.metadata = updatedMetadata
  }

  // Send notification to all user's subscriptions
  const subscriptions = user.notificationSubscriptions?.filter((sub: any) => sub.enabled) || []

  if (subscriptions.length === 0) {
    console.log(`No active subscriptions for user ${user.id}`)
    await markNotificationAsSkipped(notification.id, 'No active subscriptions')
    return
  }

  let sentCount = 0
  let failureCount = 0
  const errors: string[] = []

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(subscription, notification.metadata.content)
    
    if (result.success) {
      sentCount++
    } else {
      failureCount++
      if (result.error) {
        errors.push(`${subscription.id}: ${result.error}`)
      }
    }
  }

  if (sentCount > 0) {
    const finalMetadata = JSON.parse(JSON.stringify({
      ...notification.metadata,
      sentToSubscriptions: sentCount,
      failedSubscriptions: failureCount,
      errors: errors.length > 0 ? errors : undefined
    }))

    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        sent: true,
        sentAt: new Date(),
        metadata: finalMetadata
      }
    })
    console.log(`✅ Notification ${notification.id} sent to ${sentCount}/${sentCount + failureCount} subscriptions`)
  } else {
    throw new Error(`Failed to send to all ${failureCount} subscriptions: ${errors.join('; ')}`)
  }
}

/**
 * Send push notification to a subscription
 */
async function sendPushNotification(
  subscription: any,
  content: NotificationContent
): Promise<{ success: boolean; error?: string }> {
  try {
    const webPush = await import('web-push').then(m => m.default)
    
    // Configure VAPID if not already done
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured')
    }
    
    webPush.setVapidDetails(
      'mailto:abdelrhmanm525@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const payload = JSON.stringify({
      title: content.title,
      message: content.body, // Map 'body' to 'message' for SW compatibility
      body: content.body,
      icon: content.icon || '/icons/icon-192x192.png',
      badge: content.badge || '/icons/badge-72x72.png',
      tag: content.tag,
      data: content.data
    })

    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      payload
    )

    console.log(`✅ Push notification sent successfully to ${subscription.endpoint.substring(0, 50)}...`)
    return { success: true }
  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    console.error('❌ Push send failed:', {
      endpoint: subscription.endpoint?.substring(0, 50),
      statusCode: err.statusCode,
      message: err.message
    })
    
    // Handle expired/invalid subscriptions
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`🗑️  Marking subscription as inactive due to ${err.statusCode} error`)
      await markSubscriptionInactive(subscription.id, `Endpoint returned ${err.statusCode}`)
    }
    
    return { success: false, error: err.message || 'Unknown error' }
  }
}

/**
 * Get count of cards due for a user
 */
async function getDueCardsCount(userId: string): Promise<number> {
  const now = new Date()

  // Find all folders for the user, then count due cards
  const folders = await prisma.folder.findMany({
    where: { userId },
    select: { id: true }
  })

  const folderIds = folders.map(f => f.id)

  if (folderIds.length === 0) {
    return 0
  }

  const count = await prisma.cardReview.count({
    where: {
      folderId: {
        in: folderIds
      },
      nextReviewAt: {
        lte: now
      }
    }
  })

  return count
}

/**
 * Mark notification as skipped
 */
async function markNotificationAsSkipped(notificationId: string, reason: string) {
  await prisma.scheduledNotification.update({
    where: { id: notificationId },
    data: {
      sent: true,
      lastError: reason,
      sentAt: new Date()
    }
  })
}

/**
 * Mark subscription as inactive
 */
async function markSubscriptionInactive(subscriptionId: string, reason: string) {
  try {
    await prisma.notificationSubscription.update({
      where: { id: subscriptionId },
      data: {
        isActive: false,
        failureCount: { increment: 1 }
      }
    })
    console.log(`Marked subscription ${subscriptionId} as inactive: ${reason}`)
  } catch (error) {
    console.error(`Failed to mark subscription ${subscriptionId} as inactive:`, error)
  }
}

/**
 * Handle notification failure
 */
async function handleNotificationFailure(notification: any, error: Error) {
  const maxRetries = 3
  const failureCount = notification.failureCount + 1

  if (failureCount <= maxRetries) {
    // Schedule retry with exponential backoff
    const retryDelay = Math.pow(2, failureCount) * 60 * 1000 // 2^n minutes in milliseconds
    const retryAt = new Date(Date.now() + retryDelay)

    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        failureCount,
        scheduledFor: retryAt,
        lastError: error.message
      }
    })

    console.log(`📅 Scheduled retry ${failureCount}/${maxRetries} for notification ${notification.id} at ${retryAt}`)
  } else {
    // Mark as failed after max retries
    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        sent: true,
        failureCount,
        lastError: `Max retries exceeded: ${error.message}`,
        sentAt: new Date()
      }
    })

    console.log(`❌ Notification ${notification.id} failed after ${maxRetries} retries: ${error.message}`)
  }
}
