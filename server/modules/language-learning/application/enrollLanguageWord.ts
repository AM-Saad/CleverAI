import { Errors } from "@server/utils/error";
import { domainEventBus } from "@server/modules/shared-kernel/events/DomainEventBus";
import {
  buildLanguageReviewPresentation,
  reviewModeForLanguageWord,
} from "../../../../shared/utils/language-review-card";

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
        select: { id: true, storyText: true, sentences: true },
      },
    },
  });

  if (!word) {
    throw Errors.notFound("Word");
  }

  const story = word.stories[0] ?? null;
  const reviewCard = buildLanguageReviewPresentation({
    word,
    story,
    preferredMode: story ? "story_cloze" : undefined,
  });
  if (!reviewCard) {
    throw Errors.badRequest(
      "Word needs a translation or definition before review enrollment",
    );
  }
  const reviewStory = reviewCard.mode === "story_cloze" ? story : null;
  const existingReview =
    typeof input.prisma.languageCardReview?.findUnique === "function"
      ? await input.prisma.languageCardReview.findUnique({
          where: {
            userId_wordId: {
              userId: input.userId,
              wordId: input.wordId,
            },
          },
          select: { storyId: true, mode: true, contentVersion: true },
        })
      : null;
  const reviewContentChanged = Boolean(
    existingReview &&
    (existingReview.storyId !== (reviewStory?.id ?? null) ||
      (existingReview.mode ??
        (existingReview.storyId
          ? "story_cloze"
          : reviewModeForLanguageWord(word))) !== reviewCard.mode),
  );
  const status: "mastered" | "enrolled" =
    word.status === "mastered" && !reviewContentChanged
      ? "mastered"
      : "enrolled";

  const persist = async (tx: any) => {
    const review: { id: string } = await tx.languageCardReview.upsert({
      where: {
        userId_wordId: {
          userId: input.userId,
          wordId: input.wordId,
        },
      },
      update: {
        storyId: reviewStory?.id ?? null,
        mode: reviewCard.mode,
        suspended: false,
        ...(reviewContentChanged
          ? {
              contentVersion: (existingReview?.contentVersion ?? 1) + 1,
              intervalDays: 0,
              easeFactor: 2.5,
              repetitions: 0,
              nextReviewAt: new Date(),
              lastReviewedAt: null,
              lastGrade: null,
              streak: 0,
            }
          : {}),
      },
      create: {
        userId: input.userId,
        wordId: input.wordId,
        storyId: reviewStory?.id ?? null,
        mode: reviewCard.mode,
        contentVersion: 1,
        nextReviewAt: new Date(),
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        streak: 0,
      },
    });

    await tx.languageWord.update({
      where: { id: input.wordId },
      data: { status },
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
      storyId: reviewStory?.id ?? null,
    },
  });

  return {
    wordId: input.wordId,
    status,
    reviewId: review.id,
    storyId: reviewStory?.id ?? null,
  };
}
