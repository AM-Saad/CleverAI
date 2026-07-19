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

class ReviewGradeReplay extends Error {}

export function isRetryableReviewGradeError(err: unknown): boolean {
  if (
    err &&
    typeof err === "object" &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  ) {
    return false;
  }

  const message = String(
    err && typeof err === "object"
      ? ((err as { message?: unknown; statusMessage?: unknown }).message ??
          (err as { statusMessage?: unknown }).statusMessage ??
          "")
      : "",
  );
  const code =
    err && typeof err === "object"
      ? String((err as { code?: unknown }).code ?? "")
      : "";

  return (
    code === "P2028" ||
    /write conflict|deadlock|transaction already closed|transient transaction|timed out|timeout/i.test(
      message,
    )
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GradeReviewCardInput {
  prisma: any;
  repository: ReviewRepository;
  xpPort: XpPort;
  userId: string;
  cardId: string;
  grade: number;
  requestId?: string;
  xpSource: string;
  attempts?: number;
  /** Client answer time for an offline grade. The caller validates its bounds. */
  reviewedAt?: Date;
  /** Reuse a surrounding mutation transaction (offline reconciliation). */
  transaction?: any;
  /** The surrounding transaction owns idempotency through OfflineMutationReceipt. */
  skipRequestClaim?: boolean;
  /** Publish only after a caller-controlled transaction commits. */
  suppressEvent?: boolean;
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
  input: GradeReviewCardInput,
): Promise<GradeReviewCardResult> {
  const now = input.reviewedAt ?? new Date();
  const attempts = Math.max(1, input.attempts ?? 3);

  const readPersistedState = async (): Promise<GradeReviewCardResult> => {
    const record = await input.repository.findByIdForUser(
      input.prisma,
      input.cardId,
      input.userId,
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

  const mutate = async (tx: any): Promise<GradeReviewCardResult> => {
    if (!input.skipRequestClaim && input.requestId) {
      try {
        await tx.gradeRequest.create({
          data: {
            requestId: input.requestId,
            userId: input.userId,
            cardId: input.cardId,
            grade: input.grade,
          },
        });
      } catch (err) {
        if (isUniqueConstraintViolation(err)) throw new ReviewGradeReplay();
        throw err;
      }
    }

    const record = await input.repository.findByIdForUser(
      tx,
      input.cardId,
      input.userId,
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
  };

  const runMutation = async (): Promise<GradeReviewCardResult> =>
    input.transaction
      ? mutate(input.transaction)
      : input.prisma.$transaction(mutate, { maxWait: 5000, timeout: 10000 });

  let result: GradeReviewCardResult | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      result = await runMutation();
      break;
    } catch (err) {
      if (err instanceof ReviewGradeReplay) {
        return readPersistedState();
      }
      lastError = err;

      const retryable = isRetryableReviewGradeError(err);
      if (!retryable) {
        throw err;
      }
      if (attempt === attempts - 1) {
        throw Errors.serviceUnavailable(
          "Review grade could not be saved. Please retry.",
          { cause: String((err as { message?: unknown })?.message ?? err) },
        );
      }

      await sleep(50 * Math.pow(2, attempt) + Math.floor(Math.random() * 30));
    }
  }

  if (!result) {
    throw (
      lastError ??
      Errors.serviceUnavailable(
        "Review grade could not be saved. Please retry.",
      )
    );
  }

  if (!input.suppressEvent)
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
