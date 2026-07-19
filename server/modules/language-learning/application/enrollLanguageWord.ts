import { Errors } from "@server/utils/error";
import { domainEventBus } from "@server/modules/shared-kernel/events/DomainEventBus";

export async function enrollLanguageWord(input: {
  prisma: any;
  userId: string;
  wordId: string;
}) {
  const word = await input.prisma.languageWord.findFirst({
    where: { id: input.wordId, userId: input.userId },
    include: {
      stories: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!word) {
    throw Errors.notFound("Word");
  }

  const story = word.stories[0] ?? null;

  const persist = async (tx: any) => {
    const review: { id: string } = await tx.languageCardReview.upsert({
      where: {
        userId_wordId: {
          userId: input.userId,
          wordId: input.wordId,
        },
      },
      update: { storyId: story?.id ?? undefined, suspended: false },
      create: {
        userId: input.userId,
        wordId: input.wordId,
        storyId: story?.id ?? null,
        nextReviewAt: new Date(),
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        streak: 0,
      },
    });

    await tx.languageWord.update({
      where: { id: input.wordId },
      data: { status: "enrolled" },
    });
    return review;
  };
  const review =
    typeof input.prisma.$transaction === "function"
      ? await input.prisma.$transaction(persist)
      : await persist(input.prisma);

  await domainEventBus.publish({
    type: "LanguageWordEnrolled",
    occurredAt: new Date(),
    payload: {
      userId: input.userId,
      wordId: input.wordId,
      storyId: story?.id ?? null,
    },
  });

  return {
    wordId: input.wordId,
    status: "enrolled",
    reviewId: review.id,
    storyId: story?.id ?? null,
  };
}
