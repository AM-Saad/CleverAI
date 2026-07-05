import type { Prisma } from "@prisma/client";

type ListLanguageWordsInput = {
  prisma: any;
  userId: string;
  status?: string;
  category?: string;
  hasStory?: boolean;
  search?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  limit: number;
  cursor?: string;
};

type LanguageWordWithStories = Prisma.LanguageWordGetPayload<{
  include: {
    stories: {
      orderBy: { createdAt: "desc" };
      take: 1;
      select: { id: true; storyText: true; sentences: true };
    };
  };
}>;

const matchesStoryFilter = (
  word: LanguageWordWithStories,
  hasStory?: boolean,
) =>
  hasStory === undefined ||
  (hasStory ? word.stories.length > 0 : word.stories.length === 0);

const wordLanguageWhere = (input: ListLanguageWordsInput) => ({
  ...(input.targetLanguage && input.targetLanguage !== input.nativeLanguage
    ? { sourceLang: input.targetLanguage }
    : {}),
  ...(input.nativeLanguage ? { translationLang: input.nativeLanguage } : {}),
});

export async function listLanguageWords(input: ListLanguageWordsInput) {
  const search = input.search?.trim();
  const searchFilter = search
    ? { contains: search, mode: "insensitive" as const }
    : null;
  const languageWhere = wordLanguageWhere(input);
  const where: Record<string, unknown> = {
    userId: input.userId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...languageWhere,
    ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
    ...(searchFilter
      ? {
          OR: [
            { word: searchFilter },
            { translation: searchFilter },
            { category: searchFilter },
            { partOfSpeech: searchFilter },
          ],
        }
      : {}),
  };

  const words: LanguageWordWithStories[] = [];
  let scanCursor = input.cursor;
  let hasMoreScannable = true;

  while (words.length < input.limit && hasMoreScannable) {
    const batch: LanguageWordWithStories[] =
      await input.prisma.languageWord.findMany({
        where: {
          ...where,
          ...(scanCursor ? { createdAt: { lt: new Date(scanCursor) } } : {}),
        } as any,
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(input.limit * 2, input.limit), 100),
        include: {
          stories: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, storyText: true, sentences: true },
          },
        },
      });

    if (batch.length === 0) {
      hasMoreScannable = false;
      break;
    }

    scanCursor = batch[batch.length - 1]?.createdAt.toISOString();
    for (const word of batch) {
      if (matchesStoryFilter(word, input.hasStory)) {
        words.push(word);
        if (words.length === input.limit) break;
      }
    }

    hasMoreScannable =
      batch.length >= Math.min(Math.max(input.limit * 2, input.limit), 100);
  }

  const [categoryRows, statusRows] = await Promise.all([
    input.prisma.languageWord.findMany({
      where: {
        userId: input.userId,
        category: { not: null },
        ...languageWhere,
      },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
    input.prisma.languageWord.findMany({
      where: { userId: input.userId, ...languageWhere },
      select: { status: true },
    }),
  ]);

  const totalWords = statusRows.length;
  const statusCounts = statusRows.reduce(
    (acc: Record<string, number>, row: { status?: unknown }) => {
      if (typeof row.status !== "string") return acc;
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return {
    words,
    nextCursor:
      words.length === input.limit && hasMoreScannable && scanCursor
        ? scanCursor
        : null,
    categories: categoryRows
      .map((row: { category: string | null }) => row.category)
      .filter((item: string | null): item is string => !!item),
    totalWords,
    statusCounts,
  };
}
