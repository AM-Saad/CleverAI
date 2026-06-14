export async function maybeAutoEnrollLanguageWord(input: {
  prisma: any;
  userId: string;
  wordId: string;
  currentStatus?: string | null;
  autoEnroll: boolean;
}) {
  if (!input.autoEnroll || input.currentStatus === "mastered") {
    return input.currentStatus ?? "captured";
  }

  await input.prisma.$transaction(async (tx: any) => {
    await tx.languageCardReview.upsert({
      where: {
        userId_wordId: {
          userId: input.userId,
          wordId: input.wordId,
        },
      },
      update: {
        suspended: false,
      },
      create: {
        userId: input.userId,
        wordId: input.wordId,
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
  });

  return "enrolled";
}
