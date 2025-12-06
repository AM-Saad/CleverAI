import { defineEventHandler } from "h3";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (_event) => {
  try {
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
    const lastSent = count > 0 ? recentNotifications[0].scheduledFor : null;

    return success({
      count,
      lastSent,
      notifications: recentNotifications.map((n) => ({
        id: n.id,
        scheduledFor: n.scheduledFor,
        sent: n.sent,
        sentAt: n.sentAt,
      })),
    });
  } catch (error) {
    console.error("[API] Recent notifications check error:", error);
    throw Errors.server("Failed to check recent notifications");
  }
});
