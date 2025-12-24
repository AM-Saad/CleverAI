// server/api/notifications/send.post.ts
import { z } from "zod";
import webPush from "web-push";
import { SendNotificationDTO } from "@@/shared/utils/notification.contract";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  // Rate limiting check (simple in-memory implementation)
  const clientIP =
    getHeader(event, "x-forwarded-for") ||
    getHeader(event, "x-real-ip") ||
    "unknown";
  console.log('clientIP', clientIP);
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

    // Check for authorization - allow internal cron calls with secret token
    const cronToken = getHeader(event, "x-cron-secret");

    // Allow internal cron calls with valid secret token
    const isInternalCronCall = cronToken === process.env.CRON_SECRET_TOKEN;

    // Allow authenticated users (check for session cookie)
    const sessionCookie =
      getCookie(event, "next-auth.session-token") ||
      getCookie(event, "__Secure-next-auth.session-token");
    const isAuthenticatedUser = !!sessionCookie;

    if (
      process.env.NODE_ENV === "production" &&
      !isInternalCronCall &&
      !isAuthenticatedUser
    ) {
      // In production, require some form of authorization for non-cron calls
      throw Errors.unauthorized("Authorization required");
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
              tag: message.tag,
              requireInteraction: message.requireInteraction || false,
              url: message.url || "/folders",
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
