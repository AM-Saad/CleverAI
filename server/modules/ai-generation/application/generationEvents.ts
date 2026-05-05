import { domainEventBus } from "@server/modules/shared-kernel/events/DomainEventBus";

export function publishGenerationRequested(payload: Record<string, unknown>) {
  return domainEventBus.publish({
    type: "GenerationRequested",
    occurredAt: new Date(),
    payload,
  });
}

export function publishGenerationSucceeded(payload: Record<string, unknown>) {
  return domainEventBus.publish({
    type: "GenerationSucceeded",
    occurredAt: new Date(),
    payload,
  });
}

export function publishGenerationSaved(payload: Record<string, unknown>) {
  return domainEventBus.publish({
    type: "GenerationSaved",
    occurredAt: new Date(),
    payload,
  });
}

export function publishGenerationQuotaConsumed(payload: Record<string, unknown>) {
  return domainEventBus.publish({
    type: "GenerationQuotaConsumed",
    occurredAt: new Date(),
    payload,
  });
}
