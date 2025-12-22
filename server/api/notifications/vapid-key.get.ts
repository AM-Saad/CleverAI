import { success } from "@server/utils/error";

/**
 * Returns the public VAPID key for push notification subscription.
 * This endpoint solves the issue of env vars not being available at build time.
 */
export default defineEventHandler(async (_event) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  
  if (!vapidPublicKey) {
    console.error("[vapid-key] VAPID_PUBLIC_KEY environment variable is not set!");
  }

  return success({
    vapidPublicKey: vapidPublicKey || null,
  });
});
