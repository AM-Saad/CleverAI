import type { H3Event } from "h3";
import { Errors } from "@server/utils/error";
import type {
  ConsumedQuota,
  QuotaStatus,
} from "@server/modules/subscription/ports/QuotaPort";

export type SubscriptionSnapshot = QuotaStatus["subscription"] | ConsumedQuota;

export function toSubscriptionSnapshot(subscription: SubscriptionSnapshot) {
  return {
    tier: subscription.tier,
    generationsUsed: subscription.generationsUsed,
    generationsQuota: subscription.generationsQuota,
    remaining: subscription.remaining,
    creditBalance: subscription.creditBalance,
  };
}

export function setQuotaHeaders(
  event: H3Event,
  subscription: SubscriptionSnapshot,
) {
  event.node.res.setHeader("x-subscription-tier", subscription.tier);
  event.node.res.setHeader(
    "x-generations-used",
    String(subscription.generationsUsed),
  );
  event.node.res.setHeader(
    "x-generations-quota",
    String(subscription.generationsQuota),
  );
  event.node.res.setHeader(
    "x-generations-remaining",
    String(subscription.remaining),
  );
}

export function throwQuotaExceeded(
  event: H3Event,
  subscription: SubscriptionSnapshot,
  message: string,
): never {
  event.node.res.setHeader("x-quota-exceeded", "true");
  setQuotaHeaders(event, subscription);
  throw Errors.badRequest(message, {
    subscription: toSubscriptionSnapshot(subscription),
    type: "QUOTA_EXCEEDED",
  });
}
