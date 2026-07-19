import type { Prisma } from "@prisma/client";
import type {
  LanguageExample,
  LanguageMeaning,
  LanguageSentence,
  LanguageWordStatus,
} from "@shared/utils/language.contract";

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

const LANGUAGE_WORD_STATUSES = new Set<LanguageWordStatus>([
  "captured",
  "story_ready",
  "enrolled",
  "mastered",
]);

const optionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const normalizeMeaning = (value: unknown): LanguageMeaning | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const definition = optionalString(source.definition);
  if (!definition) return null;
  const translation = optionalString(source.translation);
  const example = optionalString(source.example);
  const partOfSpeech = optionalString(source.partOfSpeech);
  const category = optionalString(source.category);
  const register = optionalString(source.register);
  return {
    definition,
    ...(translation ? { translation } : {}),
    ...(example ? { example } : {}),
    ...(partOfSpeech ? { partOfSpeech } : {}),
    ...(category ? { category } : {}),
    ...(register ? { register } : {}),
  };
};

const normalizeExample = (value: unknown): LanguageExample | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const text = optionalString(source.text);
  if (!text) return null;
  const translation = optionalString(source.translation);
  return {
    text,
    ...(translation ? { translation } : {}),
  };
};

const normalizeSentence = (value: unknown): LanguageSentence | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const text = optionalString(source.text);
  const clozeWord = optionalString(source.clozeWord);
  const clozeBlank = optionalString(source.clozeBlank);
  if (
    !text ||
    !clozeWord ||
    !clozeBlank ||
    typeof source.clozeIndex !== "number"
  ) {
    return null;
  }
  return {
    text,
    clozeWord,
    clozeBlank,
    clozeIndex: source.clozeIndex,
  };
};

const normalizeStatus = (status: unknown): LanguageWordStatus =>
  typeof status === "string" &&
  LANGUAGE_WORD_STATUSES.has(status as LanguageWordStatus)
    ? (status as LanguageWordStatus)
    : "captured";

/**
 * Prisma represents optional Mongo fields as `null`, while the public
 * LanguageWord contract models source context as optional and lexical
 * collections as arrays. Normalize at the server boundary so an ordinary
 * context-free word cannot invalidate the entire bank response.
 */
export const serializeLanguageWordForResponse = (
  word: LanguageWordWithStories,
) => ({
  ...word,
  sourceContext: word.sourceContext ?? undefined,
  partOfSpeech: word.partOfSpeech ?? "unknown",
  meanings: Array.isArray(word.meanings)
    ? word.meanings
        .map(normalizeMeaning)
        .filter((meaning): meaning is LanguageMeaning => meaning !== null)
    : [],
  examples: Array.isArray(word.examples)
    ? word.examples
        .map(normalizeExample)
        .filter((example): example is LanguageExample => example !== null)
    : [],
  stories: word.stories.map((story) => ({
    ...story,
    sentences: Array.isArray(story.sentences)
      ? story.sentences
          .map(normalizeSentence)
          .filter((sentence): sentence is LanguageSentence => sentence !== null)
      : [],
  })),
  status: normalizeStatus(word.status),
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
      const status = normalizeStatus(row.status);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return {
    words: words.map(serializeLanguageWordForResponse),
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
