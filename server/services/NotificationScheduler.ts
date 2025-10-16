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

    // Check if there's already a notification scheduled for this card
    const existingNotification = await prisma.scheduledNotification.findFirst({
      where: {
        userId: params.userId,
        type: 'CARD_DUE',
        sent: false
      }
    })

    const metadataValue = JSON.parse(JSON.stringify({
      ...params.metadata,
      content: params.content,
      cardId: params.cardId
    }))

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

      console.log(`Updated existing notification ${notification.id} for card ${params.cardId}`)
      return notification
    } else {
      // Create new notification
      const notification = await prisma.scheduledNotification.create({
        data: {
          userId: params.userId,
          type: 'CARD_DUE',
          scheduledFor: params.scheduledFor,
          metadata: metadataValue
        }
      })

      console.log(`Scheduled new notification ${notification.id} for card ${params.cardId}`)
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

  for (const subscription of subscriptions) {
    try {
      await sendPushNotification(subscription, notification.metadata.content)
      sentCount++
    } catch (error) {
      console.error(`Failed to send to subscription ${subscription.id}:`, error)
      failureCount++
    }
  }

  if (sentCount > 0) {
    const finalMetadata = JSON.parse(JSON.stringify({
      ...notification.metadata,
      sentToSubscriptions: sentCount,
      failedSubscriptions: failureCount
    }))

    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        sent: true,
        sentAt: new Date(),
        metadata: finalMetadata
      }
    })
    console.log(`Notification ${notification.id} sent to ${sentCount} subscriptions`)
  } else {
    throw new Error(`Failed to send to all ${failureCount} subscriptions`)
  }
}

/**
 * Send push notification to a subscription
 */
async function sendPushNotification(subscription: any, content: NotificationContent) {
  // For now, just log the notification instead of actually sending
  console.log(`Would send notification to ${subscription.endpoint}:`, content)

  // TODO: Implement actual web push when ready
  // const webPush = await import('web-push').then(m => m.default)
  // Configure and send...
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

    console.log(`Scheduled retry ${failureCount}/${maxRetries} for notification ${notification.id} at ${retryAt}`)
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

    console.log(`Notification ${notification.id} failed after ${maxRetries} retries: ${error.message}`)
  }
}
