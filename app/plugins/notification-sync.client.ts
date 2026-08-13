/**
 * Keeps push delivery and the in-app inbox in sync with auth state.
 *
 * Six call sites invoke signOut() and sessions also expire on their own, so the
 * status transition is the one chokepoint they all pass through — patching the
 * call sites would still miss expiry.
 */
import { useNotifications } from "~/features/notifications/composables/useNotifications";
import {
  canUseServiceWorker,
  getServiceWorkerReadyRegistration,
} from "~/utils/serviceWorkerRuntime";

export default defineNuxtPlugin({
  name: "notification-sync",
  setup() {
    if (!canUseServiceWorker()) return;

    const auth = useAuth();
    const inApp = useInAppNotifications();
    let lastStatus: string | null = null;

    watch(
      auth.status,
      async (next) => {
        if (next === "loading" || next === lastStatus) return;
        const previous = lastStatus;
        lastStatus = next;

        if (next === "authenticated") {
          // Populates the unread badge — nothing else calls refresh() outside
          // the inbox sheet, which only mounts on the notifications page.
          await inApp.refresh();

          // Re-registering repairs a rotated or server-dropped subscription, and
          // rotates the endpoint via the 409 ownership-conflict path when this
          // browser was last subscribed by a different account. Gated on an
          // existing grant so it can never trigger a permission prompt.
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            await useNotifications().registerNotification();
          }
          return;
        }

        if (next === "unauthenticated" && previous === "authenticated") {
          inApp.reset();

          // Browser-side only: the session cookie is already gone, so the
          // unsubscribe endpoint would 401. Killing the endpoint here makes the
          // next push return 404/410, which deliverNotifications already treats
          // as "delete the row". Without this, notifications for the account
          // that just logged out keep landing on this device.
          const registration = await getServiceWorkerReadyRegistration();
          const subscription =
            await registration?.pushManager.getSubscription();
          await subscription?.unsubscribe().catch(() => undefined);
        }
      },
      { immediate: true },
    );
  },
});
