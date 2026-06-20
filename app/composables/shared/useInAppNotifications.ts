import type { NotificationItem } from "@@/shared/utils/notification.contract";

export function useInAppNotifications() {
  const { $api } = useNuxtApp();
  const notifications = useState<NotificationItem[]>(
    "in-app-notifications:list",
    () => [],
  );
  const unreadCount = useState<number>("in-app-notifications:unread", () => 0);
  const loading = useState<boolean>(
    "in-app-notifications:loading",
    () => false,
  );
  const loaded = useState<boolean>("in-app-notifications:loaded", () => false);

  async function refresh(limit = 8) {
    loading.value = true;
    try {
      const result = await $api.notifications.getRecent(limit);
      if (result.success) {
        notifications.value = result.data.notifications;
        unreadCount.value = result.data.unreadCount;
        loaded.value = true;
      }
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(limit = 8) {
    if (loaded.value) return;
    await refresh(limit);
  }

  async function markRead(notificationId: string) {
    const target = notifications.value.find(
      (notification) => notification.id === notificationId,
    );
    const wasRead = target?.isRead ?? true;
    const previousReadAt = target?.readAt;
    const previousUnreadCount = unreadCount.value;

    if (target && !target.isRead) {
      target.isRead = true;
      target.readAt = new Date().toISOString();
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }

    const result = await $api.notifications.markRead(notificationId);
    if (result.success) {
      unreadCount.value = result.data.unreadCount;
      return result;
    }

    if (target) {
      target.isRead = wasRead;
      target.readAt = previousReadAt;
    }
    unreadCount.value = previousUnreadCount;
    return result;
  }

  async function markAllRead() {
    const previousNotifications = notifications.value.map((notification) => ({
      ...notification,
    }));
    const previousUnreadCount = unreadCount.value;

    notifications.value = notifications.value.map((notification) => ({
      ...notification,
      isRead: true,
      readAt: notification.readAt || new Date().toISOString(),
    }));
    unreadCount.value = 0;

    const result = await $api.notifications.markAllRead();
    if (!result.success) {
      notifications.value = previousNotifications;
      unreadCount.value = previousUnreadCount;
    }
    return result;
  }

  function reset() {
    notifications.value = [];
    unreadCount.value = 0;
    loaded.value = false;
  }

  return {
    notifications,
    unreadCount,
    loading,
    loaded,
    refresh,
    ensureLoaded,
    markRead,
    markAllRead,
    reset,
  };
}
