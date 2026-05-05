import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "../ports/ReviewRepository";

export class PrismaCardReviewRepository implements ReviewRepository {
  async findByIdForUser(
    tx: any,
    id: string,
    userId: string
  ): Promise<ReviewCardRecord | null> {
    const record = await tx.cardReview.findFirst({
      where: { id, userId },
    });
    if (!record) return null;
    return {
      id: record.id,
      userId: record.userId,
      resourceId: record.cardId,
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
    const updated = await tx.cardReview.update({
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
      resourceId: updated.cardId,
      easeFactor: updated.easeFactor,
      intervalDays: updated.intervalDays,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      streak: updated.streak,
    };
  }
}
