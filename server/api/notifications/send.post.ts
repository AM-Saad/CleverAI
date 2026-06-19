// server/api/notifications/send.post.ts
import { z } from "zod";
import webPush from "web-push";
import { SendNotificationDTO } from "@@/shared/utils/notification.contract";
import { Errors, success } from "@server/utils/error";
import { requireAuth } from "@server/utils/auth";

export default defineEventHandler(async (event) => {
  // TODO: Implement proper rate limiting with Redis or similar

  webPush.setVapidDetails(
    process.env.VAPID_CONTACT_EMAIL || "mailto:abdelrhmanm525@gmail.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  try {
    const body = await readBody(event);
    let message: any;
    try {
      message = SendNotificationDTO.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw Errors.badRequest("Invalid request data", err.issues);
      }
      throw Errors.badRequest("Invalid request data");
    }

    // ── Authorization ────────────────────────────────────────────────────
    // Two legitimate callers:
    //   1. Internal cron jobs (x-cron-secret) — may target any users.
    //   2. Authenticated users — may only target THEMSELVES. A logged-in user
    //      must not be able to push notifications to other users' devices, nor
    //      broadcast to everyone by omitting targetUsers. ADMINs may target
    //      anyone.
    const cronToken = getHeader(event, "x-cron-secret");
    const isInternalCronCall =
      !!process.env.CRON_SECRET_TOKEN &&
      cronToken === process.env.CRON_SECRET_TOKEN;

    if (!isInternalCronCall) {
      const requester = await requireAuth(event); // throws 401 if unauthenticated
      if (requester.role !== "ADMIN") {
        // Force self-scope regardless of the requested targetUsers.
        message.targetUsers = [requester.id];
      }
    }

    // Get active subscriptions only
    const subscriptions = await prisma.notificationSubscription.findMany({
      where: {
        isActive: true,
        failureCount: { lt: 5 },
        // If targetUsers specified, filter by userId
        ...(message.targetUsers && {
          userId: { in: message.targetUsers },
        }),
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify({
              title: message.title,
              message: message.message,
              icon: message.icon || "/icons/192x192.png",
              badge: message.badge || "/icons/72x72.png",
              tag: message.tag,
              requireInteraction: message.requireInteraction || false,
              url: message.url || "/workspaces",
            })
          );

          // Update lastSeen on successful delivery
          await prisma.notificationSubscription.update({
            where: { id: subscription.id },
            data: { lastSeen: new Date(), failureCount: 0 },
          });

          return { success: true };
        } catch (error: any) {
          console.error("Error sending notification:", error);

          // Handle expired/invalid subscriptions (delete immediately)
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.notificationSubscription.delete({
              where: { id: subscription.id },
            });
          } else {
            // For other errors, increment failure count
            await prisma.notificationSubscription.update({
              where: { id: subscription.id },
              data: { failureCount: { increment: 1 } },
            });
          }
          return { success: false, statusCode: error.statusCode };
        }
      })
    );

    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        notificationsSent++;
      } else {
        notificationsFailed++;
      }
    }

    return success(
      {
        sent: notificationsSent,
        failed: notificationsFailed,
        total: subscriptions.length,
      },
      {
        message: `Notifications sent: ${notificationsSent}, failed: ${notificationsFailed}`,
      }
    );
  } catch (error) {
    console.error("Error sending notifications:", error);
    throw error;
  }

});
