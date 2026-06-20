import { domainEventBus } from "../../shared-kernel/events/DomainEventBus";
import { Errors } from "../../../utils/error";
import {
  calculateNextReviewDate,
  calculateNextStreak,
  calculateSM2,
} from "../domain/sm2";
import type { ReviewRepository } from "../ports/ReviewRepository";
import type { XpPort } from "../ports/XpPort";

function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { code?: string }).code === "P2002"
  );
}

export interface GradeReviewCardInput {
  prisma: any;
  repository: ReviewRepository;
  xpPort: XpPort;
  userId: string;
  cardId: string;
  grade: number;
  requestId?: string;
  xpSource: string;
}

export interface GradeReviewCardResult {
  reviewId: string;
  resourceId: string;
  nextReviewAt: Date;
  intervalDays: number;
  easeFactor: number;
  xpEarned: number;
}

export async function gradeReviewCard(
  input: GradeReviewCardInput
): Promise<GradeReviewCardResult> {
  const now = new Date();

  const readPersistedState = async (): Promise<GradeReviewCardResult> => {
    const record = await input.repository.findByIdForUser(
      input.prisma,
      input.cardId,
      input.userId
    );
    if (!record) {
      throw Errors.notFound("card");
    }
    return {
      reviewId: record.id,
      resourceId: record.resourceId,
      nextReviewAt: record.nextReviewAt,
      intervalDays: record.intervalDays,
      easeFactor: record.easeFactor,
      xpEarned: 0,
    };
  };

  // Idempotency: claim the requestId BEFORE mutating. The unique constraint on
  // GradeRequest.requestId makes a concurrent/duplicate retry fail at this
  // create, so the SM-2 + XP mutation below runs at most once per requestId.
  // (Claiming outside the transaction avoids MongoDB's in-transaction
  // duplicate-key abort, which would otherwise poison the whole grade.)
  if (input.requestId) {
    try {
      await input.prisma.gradeRequest.create({
        data: {
          requestId: input.requestId,
          userId: input.userId,
          cardId: input.cardId,
          grade: input.grade,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        // Already graded under this requestId — return persisted state, no XP.
        return readPersistedState();
      }
      throw err;
    }
  }

  let result: GradeReviewCardResult;
  try {
    result = await input.prisma.$transaction(async (tx: any) => {
    const record = await input.repository.findByIdForUser(
      tx,
      input.cardId,
      input.userId
    );

    if (!record) {
      throw Errors.notFound("card");
    }

    const next = calculateSM2({
      currentEF: record.easeFactor,
      currentInterval: record.intervalDays,
      currentRepetitions: record.repetitions,
      grade: input.grade,
    });

    const nextReviewAt = calculateNextReviewDate(next.intervalDays, now);
    const streak = calculateNextStreak(record.streak, input.grade);

    const xpEarned = await input.xpPort.awardReviewXp({
      tx,
      userId: input.userId,
      resourceId: record.resourceId,
      source: input.xpSource,
      easeFactor: record.easeFactor,
      intervalDays: record.intervalDays,
      grade: input.grade,
      now,
      nextReviewAt: record.nextReviewAt,
    });

    const updated = await input.repository.updateAfterGrade(tx, {
      id: record.id,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      nextReviewAt,
      lastReviewedAt: now,
      lastGrade: input.grade,
      streak,
    });

    if (input.repository.markMastered) {
      await input.repository.markMastered(tx, updated);
    }

    return {
      reviewId: updated.id,
      resourceId: updated.resourceId,
      nextReviewAt: updated.nextReviewAt,
      intervalDays: updated.intervalDays,
      easeFactor: updated.easeFactor,
      xpEarned,
    };
    });
  } catch (err) {
    // The mutation failed after we claimed the idempotency key. Release it so a
    // later retry with the same requestId can re-attempt instead of being
    // treated as an already-applied replay.
    if (input.requestId) {
      await input.prisma.gradeRequest
        .deleteMany({ where: { requestId: input.requestId } })
        .catch(() => undefined);
    }
    throw err;
  }

  await domainEventBus.publish({
    type: "ReviewCardGraded",
    occurredAt: now,
    payload: {
      userId: input.userId,
      reviewId: result.reviewId,
      resourceId: result.resourceId,
      grade: input.grade,
      nextReviewAt: result.nextReviewAt,
      xpEarned: result.xpEarned,
    },
  });

  return result;
}
