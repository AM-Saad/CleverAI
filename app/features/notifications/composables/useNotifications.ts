import { ref } from "vue";
import { useRuntimeConfig } from "#app";
import { useAuth } from "#imports";
import {
  canUseServiceWorker,
  getServiceWorkerReadyRegistration,
} from "~/utils/serviceWorkerRuntime";

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isSubscribed = ref(false);
  const config = useRuntimeConfig();
  const { data } = useAuth();
  // @ts-expect-error - auth user might have id property
  const userId = data.value?.user?.id;

  const checkPermission = async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      throw new Error("This browser does not support notifications");
    }
    return Notification.permission;
  };

  const checkServiceWorkerSupport = async (): Promise<void> => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker not supported");
    }

    if (!canUseServiceWorker()) {
      throw new Error("Service Worker is disabled in this environment");
    }

    if (!("PushManager" in window)) {
      throw new Error("Push notifications not supported");
    }
  };

  const encodeSubscriptionKey = (key: ArrayBuffer | null): string => {
    if (!key) return "";

    return btoa(String.fromCharCode(...new Uint8Array(key)));
  };

  const toSubscriptionPayload = (subscription: PushSubscription) => ({
    endpoint: subscription.endpoint,
    keys: {
      auth: encodeSubscriptionKey(subscription.getKey("auth")),
      p256dh: encodeSubscriptionKey(subscription.getKey("p256dh")),
    },
    userId,
    userAgent: navigator.userAgent,
    expirationTime: subscription.expirationTime,
  });

  const syncSubscriptionToServer = async (
    subscription: PushSubscription,
  ): Promise<void> => {
    const subscriptionData = toSubscriptionPayload(subscription);
    console.log("Sending subscription data:", subscriptionData);

    await $fetch("/api/notifications/subscribe", {
      method: "POST",
      body: subscriptionData,
    });
  };

  const registerNotification = async (): Promise<void> => {
    console.log("Registering notification...");
    try {
      error.value = null;
      await checkServiceWorkerSupport();

      let permission = await checkPermission();

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      console.log("Notification permission status:", permission);
      if (permission === "denied") {
        throw new Error(
          "Notification permission denied. Please enable notifications in your browser settings.",
        );
      }

      if (permission !== "granted") {
        throw new Error(`Notification permission ${permission}`);
      }

      console.log("Notification permission granted");

      const registration = await getServiceWorkerReadyRegistration();
      if (!registration) {
        throw new Error("Service Worker is not ready yet");
      }

      // Check if already subscribed
      const existingSubscription =
        await registration.pushManager.getSubscription();
      console.log("Existing subscription:", existingSubscription);
      if (existingSubscription) {
        isLoading.value = true;
        await syncSubscriptionToServer(existingSubscription);
        isSubscribed.value = true;
        console.log("Existing push notification subscription refreshed");
        return;
      }

      isLoading.value = true;
      console.log("Notification permission granted");

      // Try to get VAPID key from API (runtime) first, fallback to config (build-time)
      let vapidKey = config.public.VAPID_PUBLIC_KEY as string;

      if (!vapidKey || vapidKey.length < 50) {
        console.log("🔑 VAPID key not in config, fetching from API...");
        try {
          const response = await $fetch<{
            success: boolean;
            data: { vapidPublicKey: string | null };
          }>("/api/notifications/vapid-key");
          if (response.success && response.data.vapidPublicKey) {
            vapidKey = response.data.vapidPublicKey;
            console.log("🔑 VAPID key fetched from API successfully");
          }
        } catch (fetchError) {
          console.error("Failed to fetch VAPID key from API:", fetchError);
        }
      }

      console.log(
        "🔑 VAPID Key being used:",
        vapidKey ? `${vapidKey.substring(0, 20)}...` : "UNDEFINED/EMPTY",
      );
      console.log("🔑 VAPID Key length:", vapidKey?.length);

      if (!vapidKey || vapidKey.length < 50) {
        throw new Error(
          `Invalid VAPID key. Check your VAPID_PUBLIC_KEY environment variable on the server.`,
        );
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await syncSubscriptionToServer(subscription);
      // If request didn't throw, consider it successful under unified contract
      isSubscribed.value = true;
      console.log("Subscription successful");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to register notifications";
      error.value = errorMessage;
      console.error("Notification registration error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const unsubscribe = async (): Promise<void> => {
    try {
      const registration = await getServiceWorkerReadyRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // First unsubscribe from browser
        await subscription.unsubscribe();

        // Then notify server to remove from database
        try {
          await $fetch("/api/notifications/unsubscribe", {
            method: "POST",
            body: { endpoint: subscription.endpoint },
          });
        } catch (serverError) {
          console.warn(
            "Failed to remove subscription from server:",
            serverError,
          );
          // Continue anyway since browser unsubscription succeeded
        }

        isSubscribed.value = false;
        console.log("Unsubscribed from push notifications");
      }
    } catch (err) {
      console.error("Error unsubscribing:", err);
      error.value =
        err instanceof Error ? err.message : "Failed to unsubscribe";
    }
  };

  const checkSubscriptionStatus = async (): Promise<void> => {
    try {
      const registration = await getServiceWorkerReadyRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();
      isSubscribed.value = !!subscription;
    } catch (err) {
      console.error("Error checking subscription status:", err);
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    console.log("🔄 Refreshing push notification subscription...");
    try {
      error.value = null;
      isLoading.value = true;

      // First unsubscribe if there's an existing subscription
      const registration = await getServiceWorkerReadyRegistration();
      if (!registration) {
        throw new Error("Service Worker is not ready yet");
      }
      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        console.log("🗑️ Removing existing subscription...");
        await existingSubscription.unsubscribe();

        // Remove from server database
        try {
          await $fetch("/api/notifications/unsubscribe", {
            method: "POST",
            body: { endpoint: existingSubscription.endpoint },
          });
          console.log("✅ Existing subscription removed from server");
        } catch (serverError) {
          console.warn(
            "⚠️ Failed to remove old subscription from server:",
            serverError,
          );
        }
      }

      // Now create a fresh subscription
      await registerNotification();
      console.log("✅ Fresh subscription created!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh subscription";
      error.value = errorMessage;
      console.error("❌ Subscription refresh error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    isSubscribed,
    registerNotification,
    unsubscribe,
    checkPermission,
    checkSubscriptionStatus,
    refreshSubscription,
  };
}
