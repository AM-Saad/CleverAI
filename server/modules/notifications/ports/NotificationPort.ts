export interface ScheduleReviewDueInput {
  userId: string;
  reviewId: string;
  resourceId: string;
  scheduledFor: Date;
  title?: string;
  body?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface NotificationPort {
  scheduleReviewDue(input: ScheduleReviewDueInput): Promise<void>;
}
