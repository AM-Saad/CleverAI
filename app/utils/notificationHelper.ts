/**
 * Utility functions for handling push notifications
 */

export interface NotificationTestResult {
  success: boolean;
  message: string;
  needsRefresh?: boolean;
  details?: unknown;
}

/**
 * Test if push notifications are working properly
 */
export async function testPushNotifications(): Promise<NotificationTestResult> {
  try {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      return {
        success: false,
        message: "Push notifications are not supported in this browser",
      };
    }

    // Check permission
    if (Notification.permission !== "granted") {
      return {
        success: false,
        message: "Notification permission not granted",
      };
    }

    // Check service worker
    if (!("serviceWorker" in navigator)) {
      return {
        success: false,
        message: "Service Worker not supported",
      };
    }

    // Check for active subscription
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: false,
        message: "No active push subscription found",
        needsRefresh: true,
      };
    }

    // Try to send a test notification
    try {
      const response = await $fetch("/api/notifications/send", {
        method: "POST",
        body: {
          title: "🔔 Connection Test",
          message: "Your push notifications are working correctly!",
          icon: "/icons/192x192.png",
          tag: "test-connection",
          url: "/test-notifications",
        },
      });

      return {
        success: true,
        message: "Push notifications are working correctly",
        details: response,
      };
    } catch (fetchError: unknown) {
      // Check if it's a 410 error (subscription expired)
      const error = fetchError as {
        status?: number;
        data?: { message?: string };
        message?: string;
      };
      if (error.status === 500 && error.data?.message?.includes("410")) {
        return {
          success: false,
          message: "Push subscription has expired and needs to be refreshed",
          needsRefresh: true,
        };
      }

      return {
        success: false,
        message: `Test notification failed: ${error.data?.message || error.message}`,
        details: fetchError,
      };
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      message: `Error testing push notifications: ${err.message}`,
      details: error,
    };
  }
}

/**
 * Auto-refresh subscription if it's expired
 */
export async function autoRefreshIfNeeded(): Promise<boolean> {
  const testResult = await testPushNotifications();

  if (testResult.needsRefresh) {
    console.log("🔄 Auto-refreshing expired push subscription...");
    try {
      const { refreshSubscription } = useNotifications();
      await refreshSubscription();
      console.log("✅ Push subscription refreshed successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to auto-refresh subscription:", error);
      return false;
    }
  }

  return false;
}
