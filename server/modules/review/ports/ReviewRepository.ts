export interface ReviewCardRecord {
  id: string;
  userId: string;
  resourceId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  streak: number;
}

export interface UpdateReviewCardInput {
  id: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date;
  lastGrade: number;
  streak: number;
}

export interface ReviewRepository {
  findByIdForUser(tx: any, id: string, userId: string): Promise<ReviewCardRecord | null>;
  updateAfterGrade(tx: any, input: UpdateReviewCardInput): Promise<ReviewCardRecord>;
  markMastered?(tx: any, record: ReviewCardRecord): Promise<void>;
}
