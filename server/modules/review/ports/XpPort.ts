export interface AwardReviewXpInput {
  tx: any;
  userId: string;
  resourceId: string;
  source: string;
  easeFactor: number;
  intervalDays: number;
  grade: number;
  now: Date;
  nextReviewAt: Date;
}

export interface AwardEnrollXpInput {
  tx?: any;
  userId: string;
  resourceId: string;
  source: string;
  now?: Date;
}

export interface XpPort {
  awardReviewXp(input: AwardReviewXpInput): Promise<number>;
  awardEnrollXp(input: AwardEnrollXpInput): Promise<number>;
}
