import {
  MarkAllNotificationsReadResponseSchema,
  MarkNotificationReadResponseSchema,
  NotificationSubscriptionMutationResponseSchema,
  NotificationSubscriptionsResponseSchema,
  RecentNotificationsResponseSchema,
} from "@@/shared/utils/notification.contract";
import FetchFactory from "./FetchFactory";

export interface SubscribePayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  expirationTime?: number | null;
}

export interface UnsubscribePayload {
  endpoint?: string;
  subscriptionId?: string;
}

export class NotificationsService extends FetchFactory {
  private readonly resource = "/api/notifications";

  async subscribe(payload: SubscribePayload) {
    return this.call(
      "POST",
      `${this.resource}/subscribe`,
      payload,
      {},
      NotificationSubscriptionMutationResponseSchema,
    );
  }

  async unsubscribe(payload: UnsubscribePayload) {
    return this.call(
      "POST",
      `${this.resource}/unsubscribe`,
      payload,
      {},
      NotificationSubscriptionMutationResponseSchema,
    );
  }

  async getSubscriptions(currentEndpointHash?: string | null) {
    return this.call(
      "GET",
      `${this.resource}/subscriptions`,
      undefined,
      currentEndpointHash ? { query: { currentEndpointHash } } : {},
      NotificationSubscriptionsResponseSchema,
    );
  }

  async getRecent(limit = 8) {
    return this.call(
      "GET",
      `${this.resource}/recent`,
      undefined,
      { query: { limit } },
      RecentNotificationsResponseSchema,
    );
  }

  async markRead(notificationId: string) {
    return this.call(
      "POST",
      `${this.resource}/${notificationId}/read`,
      {},
      {},
      MarkNotificationReadResponseSchema,
    );
  }

  async markAllRead() {
    return this.call(
      "POST",
      `${this.resource}/read-all`,
      {},
      {},
      MarkAllNotificationsReadResponseSchema,
    );
  }
}
