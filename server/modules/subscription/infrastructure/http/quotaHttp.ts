import type { H3Event } from "h3";
import { Errors } from "../../../../utils/error";
import type {
  ConsumedQuota,
  QuotaStatus,
} from "../../ports/QuotaPort";

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

export function quotaHeaders(subscription: SubscriptionSnapshot) {
  return {
    "x-subscription-tier": subscription.tier,
    "x-generations-used": String(subscription.generationsUsed),
    "x-generations-quota": String(subscription.generationsQuota),
    "x-generations-remaining": String(subscription.remaining),
  };
}

export function setQuotaHeaders(
  event: H3Event,
  subscription: SubscriptionSnapshot,
) {
  Object.entries(quotaHeaders(subscription)).forEach(([name, value]) => {
    event.node.res.setHeader(name, value);
  });
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
