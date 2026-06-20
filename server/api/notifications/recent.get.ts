import { RecentNotificationsResponseSchema } from "@@/shared/utils/notification.contract";
import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireRole(event, ["USER"]);
  const query = getQuery(event);
  const limit = Math.min(
    20,
    Math.max(1, Number.parseInt(String(query.limit || "8"), 10) || 8),
  );

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        url: true,
        isRead: true,
        readAt: true,
        pushStatus: true,
        sentAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    }),
  ]);

  return success(
    RecentNotificationsResponseSchema.parse({
      notifications,
      unreadCount,
    }),
  );
});
