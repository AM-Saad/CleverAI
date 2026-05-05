import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguageWordsQuerySchema } from "@shared/utils/language.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let query;
  try {
    query = LanguageWordsQuerySchema.parse(getQuery(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  const {
    status,
    category,
    hasStory,
    search,
    targetLanguage,
    nativeLanguage,
    limit,
    cursor,
  } = query;

  const where: Record<string, unknown> = {
    userId: user.id,
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(nativeLanguage ? { translationLang: nativeLanguage } : {}),
    ...(targetLanguage ? { sourceLang: targetLanguage } : {}),
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    ...(search
      ? {
          OR: [
            { word: { contains: search } },
            { translation: { contains: search } },
            { category: { contains: search } },
            { partOfSpeech: { contains: search } },
          ],
        }
      : {}),
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

  const words: LanguageWordWithStories[] = await prisma.languageWord.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      stories: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, storyText: true, sentences: true },
      },
    },
  });

  const filteredWords =
    hasStory === undefined
      ? words
      : words.filter((word: LanguageWordWithStories) =>
          hasStory ? word.stories.length > 0 : word.stories.length === 0,
        );

  const categoryRows = await prisma.languageWord.findMany({
    where: {
      userId: user.id,
      category: { not: null },
      ...(nativeLanguage ? { translationLang: nativeLanguage } : {}),
      ...(targetLanguage ? { sourceLang: targetLanguage } : {}),
    },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  const lastWord = words[words.length - 1];

  return success({
    words: filteredWords,
    nextCursor: words.length === limit && lastWord
      ? lastWord.createdAt.toISOString()
      : null,
    categories: categoryRows
      .map((row: { category: string | null }) => row.category)
      .filter((item: string | null): item is string => !!item),
  });
});
