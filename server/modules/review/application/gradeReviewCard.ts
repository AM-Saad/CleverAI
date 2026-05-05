import { domainEventBus } from "../../shared-kernel/events/DomainEventBus";
import { Errors } from "../../../utils/error";
import {
  calculateNextReviewDate,
  calculateNextStreak,
  calculateSM2,
} from "../domain/sm2";
import type { NotificationPort } from "../../notifications/ports/NotificationPort";
import type { ReviewRepository } from "../ports/ReviewRepository";
import type { XpPort } from "../ports/XpPort";

export interface GradeReviewCardInput {
  prisma: any;
  repository: ReviewRepository;
  xpPort: XpPort;
  notificationPort?: NotificationPort;
  userId: string;
  cardId: string;
  grade: number;
  requestId?: string;
  xpSource: string;
  scheduleNotification?: boolean;
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
  if (input.requestId) {
    const existing = await input.prisma.gradeRequest.findUnique({
      where: { requestId: input.requestId },
    });
    if (existing) {
      const record = await input.repository.findByIdForUser(
        input.prisma,
        input.cardId,
        input.userId
      );
      if (record) {
        return {
          reviewId: record.id,
          resourceId: record.resourceId,
          nextReviewAt: record.nextReviewAt,
          intervalDays: record.intervalDays,
          easeFactor: record.easeFactor,
          xpEarned: 0,
        };
      }
    }
  }

  const now = new Date();
  const result = await input.prisma.$transaction(async (tx: any) => {
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

    if (input.requestId) {
      await tx.gradeRequest
        .create({
          data: {
            requestId: input.requestId,
            userId: input.userId,
            cardId: input.cardId,
            grade: input.grade,
          },
        })
        .catch(() => undefined);
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

  if (input.scheduleNotification && input.notificationPort) {
    await input.notificationPort.scheduleReviewDue({
      userId: input.userId,
      reviewId: result.reviewId,
      resourceId: result.resourceId,
      scheduledFor: result.nextReviewAt,
      title: "Card Review Due",
      body: "You have a card ready for review!",
      tag: `card-due-${result.reviewId}`,
    });
  }

  return result;
}
