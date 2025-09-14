import { prisma } from "~~/server/prisma/utils"
import {
  getUserLocalTime,
  getUserLocalTimeString,
  isWithinTimeWindow,
  isInQuietHours as isInQuietHoursTimezone,
  isWithinHoursRange
} from "../utils/timezone"

interface NotificationData {
  cardCount: number
  folderCount: number
  folders: Array<{
    folderId: string
    cardCount: number
  }>
}

// (types inferred from `userPrefs` records)

export default defineNitroPlugin(async (_nitroApp) => {
  // This will be called via API endpoint instead of Nitro tasks
  // since Nitro tasks are more complex to set up with external cron
})

// Main function to check due cards - will be called from API endpoint
export async function checkDueCards() {
  console.log('🔔 Starting scheduled card notification check...')

  try {
    const now = new Date()
    const results = {
      processed: 0,
      notificationsSent: 0,
      errors: 0,
      skipped: 0
    }

    // Get all users with notification preferences enabled
    const usersWithPrefs = await prisma.userNotificationPreferences.findMany({
      where: {
        cardDueEnabled: true
      },
      include: {
        user: {
          include: {
            notificationSubscriptions: {
              where: {
                isActive: true,
                failureCount: { lt: 5 } // Skip users with too many failures
              }
            }
          }
        }
      }
    })

    console.log(`🔔 Found ${usersWithPrefs.length} users with card due notifications enabled`)

    for (const userPrefs of usersWithPrefs) {
      try {
        results.processed++

        // Skip if user has no active push subscriptions
        if (userPrefs.user.notificationSubscriptions.length === 0) {
          console.log(`⚠️ Skipping user ${userPrefs.userId} - no active push subscriptions`)
          results.skipped++
          continue
        }

        // Check if it's quiet hours for this user (using timezone)
        if (userPrefs.quietHoursEnabled && isInQuietHoursTimezone(
          userPrefs.timezone,
          userPrefs.quietHoursStart,
          userPrefs.quietHoursEnd
        )) {
          console.log(`🤫 Skipping user ${userPrefs.userId} - in quiet hours (${userPrefs.timezone})`)
          results.skipped++
          continue
        }

        // If not "send anytime", enforce card due time window
        if (!userPrefs.sendAnytimeOutsideQuietHours) {
          if (!isWithinTimeWindow(userPrefs.timezone, userPrefs.cardDueTime, 15)) {
            const currentUserTime = getUserLocalTimeString(userPrefs.timezone)
            console.log(`⏰ Skipping user ${userPrefs.userId} - outside notification window. Current: ${currentUserTime}, Preferred: ${userPrefs.cardDueTime} (${userPrefs.timezone})`)
            results.skipped++
            continue
          }
        }

        // If active hours are enabled, only send inside that range
        if (userPrefs.activeHoursEnabled) {
          if (!isWithinHoursRange(userPrefs.timezone, userPrefs.activeHoursStart, userPrefs.activeHoursEnd)) {
            const currentUserTime = getUserLocalTimeString(userPrefs.timezone)
            console.log(`🕘 Skipping user ${userPrefs.userId} - outside active hours. Current: ${currentUserTime}, Active: ${userPrefs.activeHoursStart}-${userPrefs.activeHoursEnd} (${userPrefs.timezone})`)
            results.skipped++
            continue
          }
        }

        // Find due cards for this user
        const dueCards = await prisma.cardReview.findMany({
          where: {
            userId: userPrefs.userId,
            nextReviewAt: {
              lte: now
            }
          },
          select: {
            id: true,
            folderId: true,
            cardId: true,
            resourceType: true,
            nextReviewAt: true
          }
        })

        console.log(`📚 User ${userPrefs.userId} has ${dueCards.length} due cards`)

        // Check if we should send a daily study reminder
        if (userPrefs.dailyReminderEnabled && isWithinTimeWindow(userPrefs.timezone, userPrefs.dailyReminderTime, 15)) {
          // Check if we already sent a daily reminder today
          const today = getUserLocalTime(userPrefs.timezone)
          const startOfDay = new Date(today)
          startOfDay.setHours(0, 0, 0, 0)

          const dailyReminderSent = await prisma.scheduledNotification.findFirst({
            where: {
              userId: userPrefs.userId,
              type: 'DAILY_REMINDER',
              scheduledFor: {
                gte: startOfDay
              },
              sent: true
            }
          })

          if (!dailyReminderSent) {
            // Send daily reminder
            await sendDailyReminder(userPrefs.userId, dueCards.length)
            console.log(`📅 Sent daily reminder to user ${userPrefs.userId}`)
          }
        }

        // Check if we should send notification based on threshold
        if (dueCards.length < userPrefs.cardDueThreshold) {
          console.log(`📈 Skipping user ${userPrefs.userId} - only ${dueCards.length} due cards (threshold: ${userPrefs.cardDueThreshold})`)
          results.skipped++
          continue
        }

        // Check if we already sent a notification recently (within the last 6 hours)
        // TODO: For testing, you can temporarily reduce this to 10 minutes: 10 * 60 * 1000
        // TEMP: Reduced to 1 minute for testing
        const recentNotification = await prisma.scheduledNotification.findFirst({
          where: {
            userId: userPrefs.userId,
            type: 'CARD_DUE',
            scheduledFor: {
              gte: new Date(now.getTime() - 1 * 60 * 1000) // 1 minute ago (was 6 hours)
            },
            sent: true
          },
          orderBy: {
            scheduledFor: 'desc'
          }
        })

        if (recentNotification) {
          console.log(`⏰ Skipping user ${userPrefs.userId} - already notified recently`)
          results.skipped++
          continue
        }

        // Group cards by folder for better notification content
        const cardsByFolder = dueCards.reduce((acc, card) => {
          if (!acc[card.folderId]) acc[card.folderId] = []
          acc[card.folderId].push(card)
          return acc
        }, {} as Record<string, typeof dueCards>)

        // Create and send notification
        const notificationData: NotificationData = {
          cardCount: dueCards.length,
          folderCount: Object.keys(cardsByFolder).length,
          folders: Object.entries(cardsByFolder).map(([folderId, cards]) => ({
            folderId,
            cardCount: cards.length
          }))
        }

        // Create scheduled notification record
        await prisma.scheduledNotification.create({
          data: {
            userId: userPrefs.userId,
            type: 'CARD_DUE',
            scheduledFor: now,
            sent: false,
            metadata: notificationData as object
          }
        })

        // Send the actual push notification
        const notificationSent = await sendCardDueNotification(userPrefs.userId, notificationData)

        if (notificationSent) {
          // Mark as sent
          await prisma.scheduledNotification.updateMany({
            where: {
              userId: userPrefs.userId,
              type: 'CARD_DUE',
              sent: false
            },
            data: {
              sent: true,
              sentAt: now
            }
          })

          results.notificationsSent++
          console.log(`✅ Sent notification to user ${userPrefs.userId}`)
        } else {
          results.errors++
          console.error(`❌ Failed to send notification to user ${userPrefs.userId}`)
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${userPrefs.userId}:`, userError)
        results.errors++
      }
    }

    console.log('🔔 Card notification check completed:', results)
    return {
      success: true,
      timestamp: now.toISOString(),
      results
    }

  } catch (error) {
    console.error('❌ Error in check-due-cards task:', error)
    throw error
  }
}

// Helper function to send card due notification
async function sendCardDueNotification(userId: string, data: NotificationData): Promise<boolean> {
  try {
    const { cardCount, folderCount } = data

    // Create notification content
    const title = `📚 ${cardCount} Cards Ready for Review`
    const body = folderCount === 1
      ? `You have cards waiting in 1 folder`
      : `You have cards waiting across ${folderCount} folders`

    // Use existing notification API with internal cron authorization
    const response = await $fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET_TOKEN || ''
      },
      body: {
        title,
        message: body, // API expects 'message' not 'body'
        targetUsers: [userId],
        url: '/review',
        tag: 'card-due',
        requireInteraction: true,
        icon: '/icons/192x192.png'
      }
    })

    return response.success === true
  } catch (error) {
    console.error('Error sending card due notification:', error)
    return false
  }
}

// Helper function to send daily study reminder
async function sendDailyReminder(userId: string, dueCardCount: number): Promise<boolean> {
  try {
    // Create notification content
    const title = `📅 Daily Study Reminder`
    const body = dueCardCount > 0
      ? `You have ${dueCardCount} cards waiting for review. Keep up the great work!`
      : `Time for your daily study session! Check for new content to review.`

    // Create scheduled notification record
    await prisma.scheduledNotification.create({
      data: {
        userId,
        type: 'DAILY_REMINDER',
        scheduledFor: new Date(),
        sent: false,
        metadata: { dueCardCount } as object
      }
    })

    // Use existing notification API with internal cron authorization
    const response = await $fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET_TOKEN || ''
      },
      body: {
        title,
        message: body,
        targetUsers: [userId],
        url: '/review',
        tag: 'daily-reminder',
        requireInteraction: false,
        icon: '/icons/192x192.png'
      }
    })

    if (response.success) {
      // Mark as sent
      await prisma.scheduledNotification.updateMany({
        where: {
          userId,
          type: 'DAILY_REMINDER',
          sent: false
        },
        data: {
          sent: true,
          sentAt: new Date()
        }
      })
    }

    return response.success === true
  } catch (error) {
    console.error('Error sending daily reminder:', error)
    return false
  }
}
