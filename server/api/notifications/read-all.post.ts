import { MarkAllNotificationsReadResponseSchema } from "@@/shared/utils/notification.contract";
import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireRole(event, ["USER"]);

  const updated = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return success(
    MarkAllNotificationsReadResponseSchema.parse({
      updatedCount: updated.count,
      unreadCount: 0,
    }),
  );
});
