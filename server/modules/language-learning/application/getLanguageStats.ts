type GetLanguageStatsInput = {
  prisma: any;
  userId: string;
  targetLanguage?: string;
  nativeLanguage?: string;
};

const wordLanguageWhere = (input: GetLanguageStatsInput) => ({
  ...(input.targetLanguage ? { sourceLang: input.targetLanguage } : {}),
  ...(input.nativeLanguage ? { translationLang: input.nativeLanguage } : {}),
});

export async function getLanguageStats(input: GetLanguageStatsInput) {
  const now = new Date();
  const languageWhere = wordLanguageWhere(input);
  const reviewWordFilter =
    input.targetLanguage || input.nativeLanguage ? { word: languageWhere } : {};

  const [total, due, mastered, enrolled] = await Promise.all([
    input.prisma.languageCardReview.count({
      where: { userId: input.userId, suspended: false, ...reviewWordFilter },
    }),
    input.prisma.languageCardReview.count({
      where: {
        userId: input.userId,
        suspended: false,
        nextReviewAt: { lte: now },
        ...reviewWordFilter,
      },
    }),
    input.prisma.languageWord.count({
      where: { userId: input.userId, status: "mastered", ...languageWhere },
    }),
    input.prisma.languageWord.count({
      where: {
        userId: input.userId,
        status: { in: ["enrolled", "mastered"] },
        ...languageWhere,
      },
    }),
  ]);

  return { total, due, enrolled, mastered };
}
