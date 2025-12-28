import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface NotificationContent {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface ScheduleNotificationParams {
  userId: string;
  cardId: string;
  scheduledFor: Date;
  content: NotificationContent;
  metadata?: Record<string, unknown>;
}

/**
 * Schedule a card due notification for a user
 * Simplified: Just creates a record for future processing by the cron job
 */
export async function scheduleCardDueNotification(
  params: ScheduleNotificationParams
) {
  try {
    // Quick check: user has notifications enabled
    const preferences = await prisma.userNotificationPreferences.findUnique({
      where: { userId: params.userId },
      select: { cardDueEnabled: true },
    });

    if (!preferences?.cardDueEnabled) {
      return null;
    }

    // Create notification record - cron will process it later
    const notification = await prisma.scheduledNotification.create({
      data: {
        userId: params.userId,
        type: "CARD_DUE",
        cardId: params.cardId,
        scheduledFor: params.scheduledFor,
        sent: false,
        metadata: {
          ...params.metadata,
          content: params.content,
          cardId: params.cardId,
        } as object,
      },
    });

    console.log(`[PID:${process.pid}] [Scheduler] Notification created:`, notification.id);

    return notification;
  } catch (error) {
    console.error(
      "[NotificationScheduler] Error scheduling notification:",
      error
    );
    return null;
  }
}

/**
 * Process pending individual card notifications
 * Called by cron job every 15 minutes to send scheduled card reminders
 */
export async function processPendingNotifications() {
  try {
    const now = new Date();

    // Find pending individual card notifications (not bulk notifications)
    const pendingNotifications = await prisma.scheduledNotification.findMany({
      where: {
        sent: false,
        scheduledFor: { lte: now },
        type: "CARD_DUE",
        cardId: { not: null }, // Only individual card reminders
      },
      take: 50, // Process in batches
    });

    console.log(
      `[processPending] Found ${pendingNotifications.length} pending card reminders`
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const notification of pendingNotifications) {
      try {
        // Get fresh card data - card might have been reviewed already
        const card = await prisma.cardReview.findUnique({
          where: { id: notification.cardId! },
          select: { nextReviewAt: true, suspended: true },
        });

        // Skip if card was already reviewed or suspended
        if (!card || card.nextReviewAt > now || card.suspended) {
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { sent: true, lastError: "Card no longer due", sentAt: now },
          });
          skipped++;
          continue;
        }

        // Send via existing API (reuses all the subscription/preference logic)
        const content = notification.metadata as any;
        const response = await $fetch("/api/notifications/send", {
          method: "POST",
          headers: { "x-cron-secret": process.env.CRON_SECRET_TOKEN || "" },
          body: {
            title: content.content?.title || "📚 Card Ready for Review",
            message: content.content?.body || "Time to review this card!",
            targetUsers: [notification.userId],
            url: "/user/review",
            tag: `card-due-${notification.cardId}`,
            icon: "/icons/192x192.png",
          },
        });

        if (response.success) {
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { sent: true, sentAt: now },
          });
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(
          `[processPending] Error processing ${notification.id}:`,
          error
        );
        failed++;
      }
    }

    console.log(
      `[processPending] Complete: ${sent} sent, ${skipped} skipped, ${failed} failed`
    );
    return { sent, skipped, failed };
  } catch (error) {
    console.error("[processPending] Fatal error:", error);
    throw error;
  }
}
