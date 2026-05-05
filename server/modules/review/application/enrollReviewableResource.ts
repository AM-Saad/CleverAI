import { Errors } from "@server/utils/error";
import { domainEventBus } from "@server/modules/shared-kernel/events/DomainEventBus";
import type {
  ReviewableResourceResolver,
  ReviewableResourceType,
} from "../ports/ReviewableResourceResolver";
import type { XpPort } from "../ports/XpPort";

export interface EnrollReviewableResourceInput {
  prisma: any;
  resolver: ReviewableResourceResolver;
  xpPort: XpPort;
  userId: string;
  resourceType: ReviewableResourceType;
  resourceId: string;
}

export async function enrollReviewableResource(
  input: EnrollReviewableResourceInput
) {
  const resolved = await input.resolver.resolve({
    userId: input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  });

  if (!resolved) {
    throw Errors.notFound("Resource");
  }

  const card = await input.prisma.cardReview.upsert({
    where: {
      userId_cardId: {
        userId: input.userId,
        cardId: resolved.resourceId,
      },
    },
    update: {},
    create: {
      userId: input.userId,
      cardId: resolved.resourceId,
      workspaceId: resolved.workspaceId,
      resourceType: resolved.resourceType,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      nextReviewAt: new Date(),
      streak: 0,
    },
  });

  const isNewEnrollment = !card.lastReviewedAt;
  const xpEarned = isNewEnrollment
    ? await input.xpPort.awardEnrollXp({
        userId: input.userId,
        resourceId: card.cardId,
        source: "enroll",
      })
    : 0;

  await domainEventBus.publish({
    type: "ReviewCardEnrolled",
    occurredAt: new Date(),
    payload: {
      userId: input.userId,
      reviewId: card.id,
      resourceId: card.cardId,
      resourceType: card.resourceType,
      xpEarned,
    },
  });

  return { card, isNewEnrollment, xpEarned };
}
