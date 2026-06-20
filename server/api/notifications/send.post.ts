import { SendNotificationDTO } from "@@/shared/utils/notification.contract";
import { deliverNotifications } from "~~/server/services/notifications/NotificationDeliveryService";
import { requireAuth } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const cronToken = getHeader(event, "x-cron-secret");
  const isInternalCronCall =
    Boolean(process.env.CRON_SECRET_TOKEN) &&
    cronToken === process.env.CRON_SECRET_TOKEN;

  const parsed = SendNotificationDTO.safeParse(await readBody(event));
  if (!parsed.success) {
    throw Errors.badRequest("Invalid notification data", {
      issues: parsed.error.issues,
    });
  }

  const prisma = event.context.prisma;
  const payload = parsed.data;
  let targetUserIds: string[];

  if (isInternalCronCall) {
    targetUserIds = payload.targetUsers || [];
  } else {
    const requester = await requireAuth(event);

    if (requester.role === "ADMIN") {
      if (payload.targetUsers?.length) {
        targetUserIds = payload.targetUsers;
      } else {
        const users = await prisma.user.findMany({
          where: { deletedAt: null },
          select: { id: true },
        });
        targetUserIds = users.map((user: { id: string }) => user.id);
      }
    } else {
      targetUserIds = [requester.id];
    }
  }

  const delivery = await deliverNotifications({
    prisma,
    userIds: targetUserIds,
    title: payload.title,
    content: payload.message,
    type: payload.type,
    url: payload.url,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction,
    persistInApp: payload.persistInApp,
    metadata: payload.metadata,
  });

  return success(
    delivery,
    {
      message: `Notifications sent: ${delivery.sent}, failed: ${delivery.failed}, inbox-only: ${delivery.noSubscription}`,
    },
  );
});
