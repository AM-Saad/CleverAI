import { ref } from "vue";
import {
  canUseServiceWorker,
  getServiceWorkerReadyRegistration,
} from "~/utils/serviceWorkerRuntime";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function encodeSubscriptionKey(key: ArrayBuffer | null): string {
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

function serializeSubscription(subscription: PushSubscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: encodeSubscriptionKey(subscription.getKey("auth")),
      p256dh: encodeSubscriptionKey(subscription.getKey("p256dh")),
    },
    userAgent: navigator.userAgent,
    expirationTime: subscription.expirationTime,
  };
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function useNotifications() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isSubscribed = ref(false);
  const currentEndpointHash = ref<string | null>(null);
  const config = useRuntimeConfig();
  const { $api } = useNuxtApp();

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

  const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
    await checkServiceWorkerSupport();
    const registration = await getServiceWorkerReadyRegistration();
    if (!registration) {
      throw new Error("Service Worker is not ready yet");
    }
    return registration.pushManager.getSubscription();
  };

  const updateCurrentSubscriptionState = async (
    subscription?: PushSubscription | null,
  ) => {
    const activeSubscription =
      subscription === undefined ? await getCurrentSubscription() : subscription;
    isSubscribed.value = Boolean(activeSubscription);
    currentEndpointHash.value = activeSubscription
      ? await hashEndpoint(activeSubscription.endpoint)
      : null;
    return activeSubscription;
  };

  const syncSubscriptionToServer = async (
    subscription: PushSubscription,
  ): Promise<void> => {
    const result = await $api.notifications.subscribe(
      serializeSubscription(subscription),
    );

    if (!result.success) {
      throw result.error;
    }
  };

  const getVapidPublicKey = async () => {
    let vapidKey = config.public.VAPID_PUBLIC_KEY as string | undefined;
    if (vapidKey && vapidKey.length >= 50) return vapidKey;

    const response = await $fetch<{
      success: boolean;
      data?: { vapidPublicKey?: string | null };
    }>("/api/notifications/vapid-key");
    vapidKey = response.data?.vapidPublicKey || undefined;

    if (!vapidKey || vapidKey.length < 50) {
      throw new Error(
        "Notifications are not configured. VAPID_PUBLIC_KEY is missing.",
      );
    }

    return vapidKey;
  };

  const isSubscriptionOwnershipConflict = (err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    return (
      message.includes("another account") ||
      message.includes("already linked") ||
      message.includes("conflict")
    );
  };

  const registerNotification = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      await checkServiceWorkerSupport();

      let permission = await checkPermission();
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "denied") {
        throw new Error(
          "Notification permission denied. Enable it in your browser settings.",
        );
      }

      if (permission !== "granted") {
        throw new Error(`Notification permission is ${permission}`);
      }

      const registration = await getServiceWorkerReadyRegistration();
      if (!registration) {
        throw new Error("Service Worker is not ready yet");
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();
      if (existingSubscription) {
        try {
          await syncSubscriptionToServer(existingSubscription);
          await updateCurrentSubscriptionState(existingSubscription);
          return true;
        } catch (syncError) {
          if (!isSubscriptionOwnershipConflict(syncError)) {
            throw syncError;
          }
          await existingSubscription.unsubscribe().catch(() => undefined);
        }
      }

      const vapidKey = await getVapidPublicKey();
      const createdSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      try {
        await syncSubscriptionToServer(createdSubscription);
        await updateCurrentSubscriptionState(createdSubscription);
        return true;
      } catch (syncError) {
        await createdSubscription.unsubscribe().catch(() => undefined);
        await updateCurrentSubscriptionState(null);
        throw syncError;
      }
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to register notifications";
      isSubscribed.value = false;
      console.error("Notification registration error:", err);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const subscription = await getCurrentSubscription();
      if (!subscription) {
        await updateCurrentSubscriptionState(null);
        return true;
      }

      const result = await $api.notifications.unsubscribe({
        endpoint: subscription.endpoint,
      });
      if (!result.success) {
        throw result.error;
      }

      const browserRemoved = await subscription.unsubscribe();
      if (!browserRemoved) {
        throw new Error("Browser did not remove the push subscription");
      }

      await updateCurrentSubscriptionState(null);
      return true;
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to unsubscribe";
      console.error("Error unsubscribing:", err);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const checkSubscriptionStatus = async (): Promise<void> => {
    try {
      await updateCurrentSubscriptionState();
    } catch {
      isSubscribed.value = false;
      currentEndpointHash.value = null;
    }
  };

  const refreshSubscription = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const existingSubscription = await getCurrentSubscription();
      if (existingSubscription) {
        const result = await $api.notifications.unsubscribe({
          endpoint: existingSubscription.endpoint,
        });
        if (!result.success) throw result.error;
        await existingSubscription.unsubscribe();
      }

      await updateCurrentSubscriptionState(null);
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to refresh subscription";
      isLoading.value = false;
      return false;
    }

    isLoading.value = false;
    return registerNotification();
  };

  return {
    isLoading,
    error,
    isSubscribed,
    currentEndpointHash,
    registerNotification,
    unsubscribe,
    checkPermission,
    checkSubscriptionStatus,
    refreshSubscription,
  };
}
