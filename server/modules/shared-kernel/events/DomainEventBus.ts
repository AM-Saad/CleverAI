export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  occurredAt: Date;
  payload: TPayload;
}

export type DomainEventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent
) => void | Promise<void>;

export interface DomainEventBus {
  publish<TEvent extends DomainEvent>(event: TEvent): Promise<void>;
  subscribe<TEvent extends DomainEvent>(
    type: TEvent["type"],
    handler: DomainEventHandler<TEvent>
  ): void;
}

export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers = new Map<string, DomainEventHandler[]>();

  subscribe<TEvent extends DomainEvent>(
    type: TEvent["type"],
    handler: DomainEventHandler<TEvent>
  ): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(type, existing);
  }

  async publish<TEvent extends DomainEvent>(event: TEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}

export const domainEventBus = new InMemoryDomainEventBus();
