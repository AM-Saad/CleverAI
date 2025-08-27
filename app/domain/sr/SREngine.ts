import type { GradeInput, QueueQuery, ReviewState } from "./SRTypes";

import type { SRScheduler } from "./SRScheduler";
import { defaultSRPolicy, type SRPolicy } from "./SRPolicy";
import type { CardReviewRepository } from "../repositories/CardReviewRepository";
import type { CardRepository } from "../repositories/CardRepository";

export interface SREngine {
  enroll(params: { userId: string; cardId: string; folderId: string; startNow?: boolean }): Promise<ReviewState>

  getDailyQueue(q: QueueQuery): Promise<ReviewState[]>  // only where nextReviewAt <= now and not suspended

  grade(input: GradeInput): Promise<ReviewState>        // loads, schedules with SRScheduler, persists

  snooze(params: { userId: string; cardId: string; minutes: number; now?: Date }): Promise<ReviewState> // optional

  suspend(params: { userId: string; cardId: string }): Promise<void>   // optional
  resume(params: { userId: string; cardId: string }): Promise<void>    // optional
}

type EngineDeps = {
  reviews: CardReviewRepository;
  cards: CardRepository;
  scheduler: SRScheduler;
  policy?: SRPolicy;
  clock?: () => Date; // injectable time source for tests
};

export class DefaultSREngine implements SREngine {
  private reviews: CardReviewRepository;
  private cards: CardRepository;
  private scheduler: SRScheduler;
  private policy: SRPolicy;
  private clock: () => Date;

  constructor(deps: EngineDeps) {
    this.reviews = deps.reviews;
    this.cards = deps.cards;
    this.scheduler = deps.scheduler;
    this.policy = deps.policy ?? defaultSRPolicy;
    this.clock = deps.clock ?? (() => new Date());
  }

  private now() { return this.clock(); }

  async enroll(params: { userId: string; cardId: string; folderId: string; startNow?: boolean }): Promise<ReviewState> {
    const { userId, cardId, folderId, startNow = true } = params;

    const existing = await this.reviews.findByUserAndCard(userId, cardId);
    if (existing) return existing;

    const now = this.now();

    const state: ReviewState = {
      userId,
      cardId,
      folderId,
      repetitions: 0,
      easeFactor: this.policy.defaultEaseFactor,
      intervalDays: 0,
      nextReviewAt: startNow ? now : new Date(now.getTime() + 5 * 60 * 1000), // if not now, nudge by 5 mins
      lastReviewedAt: undefined,
      lastGrade: undefined,
      suspended: false,
    };

    return this.reviews.create(state);
  }

  async getDailyQueue(q: QueueQuery): Promise<ReviewState[]> {
    const { userId, folderId, limit = 20 } = q;
    const now = q.now ?? this.now();

    // Delegate to repository which must filter suspended=false and nextReviewAt <= now
    const due = await this.reviews.findDue({ userId, folderId, now, limit });
    return due;
  }

  async grade(input: GradeInput): Promise<ReviewState> {
    const { userId, cardId, grade, requestId, now } = input;

    // Optional idempotency guard if repo supports it
    if (requestId && this.reviews.hasGradedRequest && this.reviews.recordGradedRequest) {
      const already = await this.reviews.hasGradedRequest(requestId);
      if (already) {
        const current = await this.reviews.findByUserAndCard(userId, cardId);
        if (current) return current;
      }
    }

    const current = await this.reviews.findByUserAndCard(userId, cardId);
    if (!current) {
      // If not enrolled, auto-enroll and treat as first review
      const card = await this.cards.getCard(cardId);
      const enrolled = await this.enroll({ userId, cardId, folderId: card.folderId, startNow: true });
      const nextState = this.scheduler.next(enrolled, grade, this.policy, now ?? this.now());
      return await this.reviews.update(nextState);
    }

    const nextState = this.scheduler.next(current, grade, this.policy, now ?? this.now());
    if (requestId && this.reviews.recordGradedRequest) {
      await this.reviews.recordGradedRequest(requestId);
    }
    return await this.reviews.update(nextState);
  }

  async snooze(params: { userId: string; cardId: string; minutes: number; now?: Date }): Promise<ReviewState> {
    const { userId, cardId, minutes, now } = params;
    const state = await this.reviews.findByUserAndCard(userId, cardId);
    if (!state) throw new Error("Cannot snooze: card not enrolled");

    const base = now ?? this.now();
    const next = new Date(base.getTime() + Math.max(1, minutes) * 60 * 1000);

    const updated: ReviewState = {
      ...state,
      nextReviewAt: next,
      // DO NOT change EF/repetitions/intervalDays on snooze
    };

    return await this.reviews.update(updated);
  }

  async suspend(params: { userId: string; cardId: string }): Promise<void> {
    await this.reviews.suspend(params.userId, params.cardId);
  }

  async resume(params: { userId: string; cardId: string }): Promise<void> {
    await this.reviews.resume(params.userId, params.cardId);
  }
}
