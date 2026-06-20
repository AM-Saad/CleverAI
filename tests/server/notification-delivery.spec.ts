import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { deliverNotifications } from "../../server/services/notifications/NotificationDeliveryService";

type StoredNotification = {
  id: string;
  userId: string;
  pushStatus: string;
  deliveredAt?: Date;
};

function createFakePrisma(subscriptionCount = 0) {
  const notifications: StoredNotification[] = [];
  const subscriptions = Array.from({ length: subscriptionCount }, (_, index) => ({
    id: `subscription-${index + 1}`,
    userId: "user-1",
    endpoint: `https://push.example.test/${index + 1}`,
    keys: { auth: "auth", p256dh: "p256dh" },
    failureCount: 0,
  }));

  const prisma = {
    notification: {
      create: async ({ data }: { data: { userId: string; pushStatus: string } }) => {
        const notification = {
          id: `notification-${notifications.length + 1}`,
          userId: data.userId,
          pushStatus: data.pushStatus,
        };
        notifications.push(notification);
        return { id: notification.id, userId: notification.userId };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { pushStatus: string; deliveredAt?: Date };
      }) => {
        const notification = notifications.find((item) => item.id === where.id);
        assert.ok(notification);
        notification.pushStatus = data.pushStatus;
        notification.deliveredAt = data.deliveredAt;
        return notification;
      },
    },
    notificationSubscription: {
      findMany: async () => subscriptions,
      update: async () => undefined,
      delete: async () => undefined,
    },
  } as unknown as PrismaClient;

  return { prisma, notifications };
}

async function withoutVapid<T>(run: () => Promise<T>) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;

  try {
    return await run();
  } finally {
    if (publicKey) process.env.VAPID_PUBLIC_KEY = publicKey;
    if (privateKey) process.env.VAPID_PRIVATE_KEY = privateKey;
  }
}

test("persists one inbox notification when the user has no push subscription", async () => {
  const { prisma, notifications } = createFakePrisma();

  const result = await withoutVapid(() =>
    deliverNotifications({
      prisma,
      userIds: ["user-1", "user-1"],
      title: "Review ready",
      content: "You have cards to review.",
      type: "CARD_DUE",
    }),
  );

  assert.deepEqual(result, {
    total: 1,
    sent: 0,
    failed: 0,
    noSubscription: 1,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.pushStatus, "NO_SUBSCRIPTION");
});

test("keeps the inbox notification when push credentials are unavailable", async () => {
  const { prisma, notifications } = createFakePrisma(1);

  const result = await withoutVapid(() =>
    deliverNotifications({
      prisma,
      userIds: ["user-1"],
      title: "Daily reminder",
      content: "Time for a study session.",
      type: "DAILY_REMINDER",
    }),
  );

  assert.deepEqual(result, {
    total: 1,
    sent: 0,
    failed: 1,
    noSubscription: 0,
  });
  assert.equal(notifications[0]?.pushStatus, "IN_APP_ONLY");
});
