import type { Prisma, PrismaClient } from "@prisma/client";
import webPush from "web-push";

export interface DeliverNotificationsInput {
  prisma: PrismaClient;
  userIds: string[];
  title: string;
  content: string;
  type: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  persistInApp?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DeliverNotificationsResult {
  total: number;
  sent: number;
  failed: number;
  noSubscription: number;
}

type DeliverySubscription = {
  id: string;
  userId: string | null;
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  failureCount: number;
};

function configureWebPush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return false;
  }

  webPush.setVapidDetails(
    process.env.VAPID_CONTACT_EMAIL || "mailto:notifications@cognilo.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  return true;
}

async function markNotificationStatus(
  prisma: PrismaClient,
  notificationId: string | undefined,
  pushStatus: string,
  deliveredAt?: Date,
) {
  if (!notificationId) return;

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      pushStatus,
      ...(deliveredAt ? { deliveredAt } : {}),
    },
  });
}

async function markSubscriptionSuccess(
  prisma: PrismaClient,
  subscriptionId: string,
  deliveredAt: Date,
) {
  await prisma.notificationSubscription.update({
    where: { id: subscriptionId },
    data: {
      failureCount: 0,
      isActive: true,
      lastSeen: deliveredAt,
    },
  });
}

async function markSubscriptionFailure(
  prisma: PrismaClient,
  subscription: DeliverySubscription,
  statusCode?: number,
) {
  if (statusCode === 404 || statusCode === 410) {
    await prisma.notificationSubscription.delete({
      where: { id: subscription.id },
    });
    return;
  }

  await prisma.notificationSubscription.update({
    where: { id: subscription.id },
    data: {
      failureCount: { increment: 1 },
      lastSeen: new Date(),
      ...(subscription.failureCount + 1 >= 5 ? { isActive: false } : {}),
    },
  });
}

export async function deliverNotifications(
  input: DeliverNotificationsInput,
): Promise<DeliverNotificationsResult> {
  const userIds = Array.from(
    new Set(input.userIds.filter((value) => value.trim().length > 0)),
  );

  if (!userIds.length) {
    return { total: 0, sent: 0, failed: 0, noSubscription: 0 };
  }

  const shouldPersistInApp = input.persistInApp !== false;
  const canSendPush = configureWebPush();
  const notificationsByUserId = new Map<string, string>();

  if (shouldPersistInApp) {
    const createdNotifications = await Promise.all(
      userIds.map((userId) =>
        input.prisma.notification.create({
          data: {
            userId,
            type: input.type,
            title: input.title,
            content: input.content,
            url: input.url || null,
            pushStatus: "PENDING",
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
          },
          select: { id: true, userId: true },
        }),
      ),
    );

    for (const notification of createdNotifications) {
      notificationsByUserId.set(notification.userId, notification.id);
    }
  }

  const subscriptions = await input.prisma.notificationSubscription.findMany({
    where: {
      userId: { in: userIds },
      isActive: true,
      failureCount: { lt: 5 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      keys: true,
      failureCount: true,
    },
  });

  const subscriptionsByUserId = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    if (!subscription.userId) continue;
    const current = subscriptionsByUserId.get(subscription.userId) || [];
    current.push(subscription);
    subscriptionsByUserId.set(subscription.userId, current);
  }

  let sent = 0;
  let failed = 0;
  let noSubscription = 0;

  for (const userId of userIds) {
    const userSubscriptions = subscriptionsByUserId.get(userId) || [];
    const notificationId = notificationsByUserId.get(userId);

    if (!userSubscriptions.length) {
      noSubscription += 1;
      await markNotificationStatus(
        input.prisma,
        notificationId,
        "NO_SUBSCRIPTION",
      );
      continue;
    }

    if (!canSendPush) {
      failed += 1;
      await markNotificationStatus(input.prisma, notificationId, "IN_APP_ONLY");
      continue;
    }

    const results = await Promise.allSettled(
      userSubscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify({
              title: input.title,
              message: input.content,
              icon: input.icon || "/icons/192x192.png",
              badge: input.badge || "/icons/72x72.png",
              tag: input.tag,
              requireInteraction: input.requireInteraction || false,
              url: input.url || "/user/review",
            }),
          );

          await markSubscriptionSuccess(
            input.prisma,
            subscription.id,
            new Date(),
          );
          return { ok: true as const };
        } catch (error: unknown) {
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof (error as { statusCode?: unknown }).statusCode === "number"
              ? (error as { statusCode: number }).statusCode
              : undefined;

          await markSubscriptionFailure(input.prisma, subscription, statusCode);
          return { ok: false as const };
        }
      }),
    );

    const delivered = results.some(
      (result) => result.status === "fulfilled" && result.value.ok,
    );

    if (delivered) {
      sent += 1;
      await markNotificationStatus(
        input.prisma,
        notificationId,
        "SENT",
        new Date(),
      );
      continue;
    }

    failed += 1;
    await markNotificationStatus(input.prisma, notificationId, "FAILED");
  }

  return {
    total: userIds.length,
    sent,
    failed,
    noSubscription,
  };
}
