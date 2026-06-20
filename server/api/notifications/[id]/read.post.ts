import { MarkNotificationReadResponseSchema } from "@@/shared/utils/notification.contract";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireRole(event, ["USER"]);
  const notificationId = getRouterParam(event, "id");

  if (!notificationId) {
    throw Errors.badRequest("Notification id is required");
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: user.id,
    },
    select: {
      id: true,
      isRead: true,
    },
  });

  if (!notification) {
    throw Errors.notFound("notification");
  }

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: {
      userId: user.id,
      isRead: false,
    },
  });

  return success(
    MarkNotificationReadResponseSchema.parse({
      notificationId,
      unreadCount,
    }),
  );
});
