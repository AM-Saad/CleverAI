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

export async function listLanguageWords(input: ListLanguageWordsInput) {
  const where: Record<string, unknown> = {
    userId: input.userId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.nativeLanguage ? { translationLang: input.nativeLanguage } : {}),
    ...(input.targetLanguage ? { sourceLang: input.targetLanguage } : {}),
    ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
    ...(input.search
      ? {
          OR: [
            { word: { contains: input.search } },
            { translation: { contains: input.search } },
            { category: { contains: input.search } },
            { partOfSpeech: { contains: input.search } },
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

    hasMoreScannable = batch.length >= Math.min(Math.max(input.limit * 2, input.limit), 100);
  }

  const categoryRows = await input.prisma.languageWord.findMany({
    where: {
      userId: input.userId,
      category: { not: null },
      ...(input.nativeLanguage ? { translationLang: input.nativeLanguage } : {}),
      ...(input.targetLanguage ? { sourceLang: input.targetLanguage } : {}),
    },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });

  return {
    words,
    nextCursor:
      words.length === input.limit && hasMoreScannable && scanCursor
        ? scanCursor
        : null,
    categories: categoryRows
      .map((row: { category: string | null }) => row.category)
      .filter((item: string | null): item is string => !!item),
  };
}
