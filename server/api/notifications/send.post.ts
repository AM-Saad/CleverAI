// server/api/notifications/send.post.ts
import { z } from "zod";
import webPush from "web-push";
import { Errors, success } from "@server/utils/error";

const NotificationSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  icon: z.string().optional(), // Allow any string (relative paths, URLs, etc.)
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  targetUsers: z.array(z.string()).optional(),
  url: z.string().optional(), // URL to navigate to when clicked
});

export default defineEventHandler(async (event) => {
  // Rate limiting check (simple in-memory implementation)
  const clientIP =
    getHeader(event, "x-forwarded-for") ||
    getHeader(event, "x-real-ip") ||
    "unknown";

  // TODO: Implement proper rate limiting with Redis or similar
  // For now, just log the IP for monitoring
  console.log(`Notification send request from IP: ${clientIP}`);

  webPush.setVapidDetails(
    "mailto:abdelrhmanm525@gmail.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const body = await readBody(event);
  let message;
  try {
    message = NotificationSchema.parse(body);
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

  // In development, allow all requests
  if (process.env.NODE_ENV !== "production") {
    console.log("🔧 Development mode: allowing all notification requests");
  }

  // TODO: Replace with actual session check when auth is implemented
  // const session = await getServerSession(event)
  // if (!session?.user || !session.user.role === 'ADMIN') {
  //   throw createError({
  //     statusCode: 401,
  //     statusMessage: 'Unauthorized - Admin access required'
  //   })
  // }

  // Get active subscriptions
  const subscriptions = await prisma.notificationSubscription.findMany({
    where: {
      // If targetUsers specified, filter by userId
      ...(message.targetUsers && {
        userId: { in: message.targetUsers },
      }),
      // Include anonymous subscriptions when no target users specified
      ...(!message.targetUsers &&
        {
          // Get all subscriptions (including ones without userId)
        }),
    },
  });

  console.log("🔍 Debug Info:");
  console.log("- Target Users:", message.targetUsers);
  console.log("- Found subscriptions:", subscriptions.length);
  console.log(
    "- Subscription details:",
    subscriptions.map((s) => ({
      id: s.id,
      userId: s.userId,
      endpoint: s.endpoint.substring(0, 50) + "...",
    }))
  );

  let notificationsSent = 0;
  let notificationsFailed = 0;

  for (const subscription of subscriptions) {
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
          url: message.url || "/folders", // Include URL for navigation
        })
      );
      console.log("Notification sent to:", subscription.endpoint);
      notificationsSent++;
    } catch (error: unknown) {
      console.error("Error sending notification:", error);
      notificationsFailed++;

      // Handle expired/invalid subscriptions
      const webPushError = error as { statusCode?: number };
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        await prisma.notificationSubscription.delete({
          where: { id: subscription.id },
        });
        console.log("Deleted invalid subscription:", subscription.id);
      }
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
});
