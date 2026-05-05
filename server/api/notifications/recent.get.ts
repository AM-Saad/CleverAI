import type { ScheduledNotification } from "@prisma/client";
import { defineEventHandler } from "h3";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  try {
    const prisma = event.context.prisma;
    // Check for recent CARD_DUE notifications within 6 hours
    const recentNotifications = await prisma.scheduledNotification.findMany({
      where: {
        type: "CARD_DUE",
        scheduledFor: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
        },
        sent: true,
      },
      orderBy: {
        scheduledFor: "desc",
      },
      take: 10,
    });

    const count = recentNotifications.length;
    const lastSent = recentNotifications[0]?.scheduledFor ?? null;

    return success({
      count,
      lastSent,
      notifications: recentNotifications.map((notification: ScheduledNotification) => ({
        id: notification.id,
        scheduledFor: notification.scheduledFor,
        sent: notification.sent,
        sentAt: notification.sentAt,
      })),
    });
  } catch (error) {
    console.error("[API] Recent notifications check error:", error);
    throw Errors.server("Failed to check recent notifications");
  }
});
