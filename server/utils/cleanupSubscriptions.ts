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

    // Update old subscriptions that haven't been seen in 7 days to inactive
    const inactiveResult = await prisma.notificationSubscription.updateMany({
      where: {
        lastSeen: {
          lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`😴 Marked ${inactiveResult.count} subscriptions as inactive`);

    // Get statistics
    const stats = await prisma.notificationSubscription.groupBy({
      by: ["isActive"],
      _count: true,
    });

    console.log("📊 Subscription statistics:", stats);
    console.log("✅ Cleanup completed successfully");

    return {
      deleted: expiredResult.count,
      deactivated: inactiveResult.count,
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
