/**
 * Cleanup expired and failed notification subscriptions
 * This should be run periodically (e.g., daily cron job)
 */
export async function cleanupExpiredSubscriptions() {
  try {
    console.log("🧹 Starting notification subscription cleanup...");

    const now = new Date();

    // Delete expired subscriptions
    const expiredResult = await prisma.notificationSubscription.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              // `not: null` is load-bearing: MongoDB's BSON type ordering sorts
              // Null before Date, so a bare `lt` matches every row with no
              // expiry — i.e. every healthy subscription.
              not: null,
              lt: now,
            },
          },
          {
            failureCount: {
              gte: 5, // Delete subscriptions that have failed 5+ times
            },
          },
          {
            isActive: false,
            // Delete inactive subscriptions older than 30 days
            createdAt: {
              lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    });

    console.log(
      `🗑️ Deleted ${expiredResult.count} expired/failed subscriptions`
    );

    // Neither notification table had any retention policy, so both grew without
    // bound. Read inbox entries are history; the scheduled ledger only exists to
    // suppress duplicate sends, which no longer matters once the day has passed.
    const [inbox, ledger] = await Promise.all([
      prisma.notification.deleteMany({
        where: {
          isRead: true,
          sentAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.scheduledNotification.deleteMany({
        where: {
          scheduledFor: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    console.log(
      `🗑️ Deleted ${inbox.count} read notifications and ${ledger.count} scheduled records`
    );

    // Get statistics
    const stats = await prisma.notificationSubscription.groupBy({
      by: ["isActive"],
      _count: true,
    });

    console.log("📊 Subscription statistics:", stats);
    console.log("✅ Cleanup completed successfully");

    return {
      deleted: expiredResult.count,
      deletedNotifications: inbox.count,
      deletedScheduled: ledger.count,
      deactivated: 0,
      stats,
    };
  } catch (error) {
    console.error("❌ Error during subscription cleanup:", error);
    throw error;
  }
}

// If run directly
if (import.meta.main) {
  cleanupExpiredSubscriptions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
