// app/repositories/PrismaCardReviewRepository.ts
import { PrismaClient } from '@prisma/client'
import type { CardReviewRepository } from '~/domain/repositories/CardReviewRepository'
import type { ReviewState } from '~/domain/sr/SRTypes'

// Reuse one Prisma client per worker
const prisma = new PrismaClient()

function toState(row: any): ReviewState {
  return {
    userId: row.userId,
    cardId: row.cardId,
    folderId: row.folderId,
    repetitions: row.repetitions,
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    nextReviewAt: new Date(row.nextReviewAt),
    lastReviewedAt: row.lastReviewedAt ? new Date(row.lastReviewedAt) : undefined,
    lastGrade: row.lastGrade ?? undefined,
    // schema has no `suspended` yet → treat as false
    suspended: false,
  }
}

function fromState(state: ReviewState) {
  return {
    userId: state.userId,
    cardId: state.cardId,
    folderId: state.folderId,
    repetitions: state.repetitions,
    easeFactor: state.easeFactor,
    intervalDays: state.intervalDays,
    nextReviewAt: state.nextReviewAt,
    lastReviewedAt: state.lastReviewedAt ?? null,
    lastGrade: state.lastGrade ?? null,
  }
}

export class PrismaCardReviewRepository implements CardReviewRepository {
  async findByUserAndCard(userId: string, cardId: string): Promise<ReviewState | null> {
    const row = await prisma.cardReview.findUnique({
      where: { userId_cardId: { userId, cardId } },
    })
    return row ? toState(row) : null
  }

  async create(state: ReviewState): Promise<ReviewState> {
    const row = await prisma.cardReview.create({
      data: { ...fromState(state), streak: 0 },
    })
    return toState(row)
  }

  async update(state: ReviewState): Promise<ReviewState> {
    const row = await prisma.cardReview.update({
      where: { userId_cardId: { userId: state.userId, cardId: state.cardId } },
      data: fromState(state),
    })
    return toState(row)
  }

  async findDue(q: { userId: string; folderId?: string; now: Date; limit: number }): Promise<ReviewState[]> {
    const rows = await prisma.cardReview.findMany({
      where: {
        userId: q.userId,
        ...(q.folderId ? { folderId: q.folderId } : {}),
        nextReviewAt: { lte: q.now },
        // no `suspended` column yet
      },
      orderBy: { nextReviewAt: 'asc' },
      take: q.limit,
    })
    return rows.map(toState)
  }

  // No-ops until we add `suspended` to schema
  async suspend(_userId: string, _cardId: string): Promise<void> { return }
  async resume(_userId: string, _cardId: string): Promise<void> { return }
}
