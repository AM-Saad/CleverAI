import { Errors } from "../../../utils/error";
import { createHash } from "node:crypto";
import type {
  LanguageExample,
  LanguageMeaning,
  SaveLanguageWordDTO,
} from "../../../../shared/utils/language.contract";
import { maybeAutoEnrollLanguageWord } from "./autoEnrollLanguageWord";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const jsonArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const safeSourceRefId = (sourceRefId?: string) =>
  sourceRefId && OBJECT_ID_RE.test(sourceRefId) ? sourceRefId : undefined;

const isDuplicate = (error: unknown) =>
  Boolean(
    error &&
    typeof error === "object" &&
    (error as { code?: string }).code === "P2002",
  );

const deterministicWordId = (userId: string, translationId: string) =>
  createHash("sha256")
    .update(`language-word:${userId}:${translationId}`)
    .digest("hex")
    .slice(0, 24);

const serialize = (
  word: Record<string, any>,
  status: string,
  cached: boolean,
) => ({
  wordId: word.id,
  translationId: word.translationId ?? undefined,
  word: word.word,
  translation: word.translation,
  partOfSpeech: word.partOfSpeech ?? "unknown",
  detectedLang: word.sourceLang,
  phonetic: word.phonetic ?? undefined,
  meanings: jsonArray<LanguageMeaning>(word.meanings),
  examples: jsonArray<LanguageExample>(word.examples),
  category: word.category ?? undefined,
  difficulty: word.difficulty ?? undefined,
  isPhrase: word.isPhrase,
  metadata: jsonRecord(word.metadata),
  saved: true,
  status,
  cached,
  sharedCacheHit: cached,
});

/**
 * Persists an already-generated lexical translation. This command performs no
 * LLM work and must never consume generation quota. The translation identity
 * is also the natural idempotency key for a user's saved deck.
 */
export async function saveLanguageWord(input: {
  prisma: any;
  userId: string;
  data: SaveLanguageWordDTO;
}) {
  const translation = await input.prisma.languageTranslation.findUnique({
    where: { id: input.data.translationId },
  });
  if (!translation) throw Errors.notFound("Translation");

  let word = await input.prisma.languageWord.findFirst({
    where: {
      userId: input.userId,
      translationId: translation.id,
    },
  });
  let cached = Boolean(word);

  // A word may first be captured with "Translate" disabled. When the user
  // later captures it with translation enabled, enrich that existing deck row
  // instead of creating a visually duplicated word.
  if (!word && translation.translation) {
    const sourceContext = input.data.sourceContext?.trim() || null;
    const definitionOnlyWord = await input.prisma.languageWord.findFirst({
      where: {
        userId: input.userId,
        word: translation.sourceText,
        sourceLang: translation.sourceLang,
        translationLang: translation.translationLang,
        sourceContext,
        translation: "",
      },
      orderBy: { createdAt: "desc" },
    });
    if (definitionOnlyWord) {
      word = await input.prisma.languageWord.update({
        where: { id: definitionOnlyWord.id },
        data: {
          translationId: translation.id,
          translation: translation.translation,
          partOfSpeech: translation.partOfSpeech ?? "unknown",
          phonetic: translation.phonetic ?? null,
          meanings: translation.meanings ?? undefined,
          examples: translation.examples ?? undefined,
          category: translation.category ?? null,
          difficulty: translation.difficulty ?? null,
          isPhrase: translation.isPhrase,
          metadata: {
            ...jsonRecord(definitionOnlyWord.metadata),
            ...jsonRecord(translation.metadata),
            sharedTranslationId: translation.id,
          },
        },
      });
      cached = true;
    }
  }

  if (!word) {
    const sourceRefId = safeSourceRefId(input.data.sourceRefId);
    const metadata = {
      ...jsonRecord(translation.metadata),
      sharedTranslationId: translation.id,
      ...(!sourceRefId && input.data.sourceRefId
        ? { sourceRefId: input.data.sourceRefId }
        : {}),
    };
    try {
      word = await input.prisma.languageWord.create({
        data: {
          // Concurrent/retried saves converge on one valid Mongo ObjectId.
          // This is safe for legacy accounts with many null translationIds,
          // unlike adding a nullable compound unique index.
          id: deterministicWordId(input.userId, translation.id),
          userId: input.userId,
          translationId: translation.id,
          word: translation.sourceText,
          translation: translation.translation,
          translationLang: translation.translationLang,
          sourceLang: translation.sourceLang,
          partOfSpeech: translation.partOfSpeech ?? "unknown",
          phonetic: translation.phonetic ?? null,
          meanings: translation.meanings ?? undefined,
          examples: translation.examples ?? undefined,
          category: translation.category ?? null,
          difficulty: translation.difficulty ?? null,
          isPhrase: translation.isPhrase,
          metadata,
          sourceContext: input.data.sourceContext?.trim() || null,
          sourceType: input.data.sourceType ?? "manual",
          sourceRefId,
          status: "captured",
        },
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      word = await input.prisma.languageWord.findFirst({
        where: {
          OR: [
            {
              userId: input.userId,
              translationId: translation.id,
            },
            {
              id: deterministicWordId(input.userId, translation.id),
              userId: input.userId,
            },
          ],
        },
      });
      cached = true;
    }
  }

  if (!word) throw Errors.server("Saved word could not be resolved");

  const preferences = await input.prisma.userLanguagePreferences.findUnique({
    where: { userId: input.userId },
    select: { autoEnroll: true },
  });
  const status = await maybeAutoEnrollLanguageWord({
    prisma: input.prisma,
    userId: input.userId,
    wordId: word.id,
    currentStatus: word.status,
    autoEnroll: preferences?.autoEnroll ?? true,
  });

  return serialize(word, status, cached);
}
