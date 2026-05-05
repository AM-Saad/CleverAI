import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "@server/modules/review/ports/ReviewRepository";
import { isMasteredByInterval } from "@server/modules/review/domain/sm2";

export class PrismaLanguageReviewRepository implements ReviewRepository {
  async findByIdForUser(
    tx: any,
    id: string,
    userId: string
  ): Promise<ReviewCardRecord | null> {
    const record = await tx.languageCardReview.findFirst({
      where: { id, userId },
    });
    if (!record) return null;
    return {
      id: record.id,
      userId: record.userId,
      resourceId: record.wordId,
      easeFactor: record.easeFactor,
      intervalDays: record.intervalDays,
      repetitions: record.repetitions,
      nextReviewAt: record.nextReviewAt,
      streak: record.streak,
    };
  }

  async updateAfterGrade(
    tx: any,
    input: UpdateReviewCardInput
  ): Promise<ReviewCardRecord> {
    const updated = await tx.languageCardReview.update({
      where: { id: input.id },
      data: {
        easeFactor: input.easeFactor,
        intervalDays: input.intervalDays,
        repetitions: input.repetitions,
        nextReviewAt: input.nextReviewAt,
        lastReviewedAt: input.lastReviewedAt,
        lastGrade: input.lastGrade,
        streak: input.streak,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      resourceId: updated.wordId,
      easeFactor: updated.easeFactor,
      intervalDays: updated.intervalDays,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      streak: updated.streak,
    };
  }

  async markMastered(tx: any, record: ReviewCardRecord): Promise<void> {
    if (!isMasteredByInterval(record.intervalDays)) return;
    await tx.languageWord.update({
      where: { id: record.resourceId },
      data: { status: "mastered" },
    });
  }
}
