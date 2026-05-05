import { scheduleCardDueNotification } from "@server/services/NotificationScheduler";
import type {
  NotificationPort,
  ScheduleReviewDueInput,
} from "../ports/NotificationPort";

export class PrismaNotificationPort implements NotificationPort {
  async scheduleReviewDue(input: ScheduleReviewDueInput): Promise<void> {
    await scheduleCardDueNotification({
      userId: input.userId,
      cardId: input.reviewId,
      scheduledFor: input.scheduledFor,
      content: {
        title: input.title ?? "Card Review Due",
        body: input.body ?? "You have a card ready for review!",
        icon: "/icons/icon-192.png",
        tag: input.tag ?? `card-due-${input.reviewId}`,
        data: {
          cardId: input.reviewId,
          resourceId: input.resourceId,
          type: "card-due",
          ...input.data,
        },
      },
    });
  }
}
