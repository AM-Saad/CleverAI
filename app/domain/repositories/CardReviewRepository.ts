// app/domain/repositories/CardReviewRepository.ts

import type { ReviewState } from "../sr/SRTypes";

export interface CardReviewRepository {
  findByUserAndCard(userId: string, cardId: string): Promise<ReviewState | null>
  create(state: ReviewState): Promise<ReviewState>
  update(state: ReviewState): Promise<ReviewState>

  // query due items
  findDue(q: { userId: string; folderId?: string; now: Date; limit: number }): Promise<ReviewState[]>

  // optional helpers
  suspend(userId: string, cardId: string): Promise<void>
  resume(userId: string, cardId: string): Promise<void>

  // idempotency (optional)
  hasGradedRequest?(requestId: string): Promise<boolean>
  recordGradedRequest?(requestId: string): Promise<void>
}
