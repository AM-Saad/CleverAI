import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  const word = await prisma.languageWord.findFirst({
    where: { id, userId: user.id },
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
  if (!story) {
    throw Errors.badRequest(
      "Generate a story first before enrolling this word in your review deck."
    );
  }

  // Idempotent upsert — safe to call even if already enrolled
  await prisma.$transaction(async (tx) => {
    await tx.languageCardReview.upsert({
      where: {
        userId_wordId: {
          userId: user.id,
          wordId: id,
        },
      },
      update: { storyId: story.id, suspended: false },
      create: {
        userId: user.id,
        wordId: id,
        storyId: story.id,
        nextReviewAt: new Date(),
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        streak: 0,
      },
    });

    await tx.languageWord.update({
      where: { id },
      data: { status: "enrolled" },
    });
  });

  return success({ wordId: id, status: "enrolled" });
});
