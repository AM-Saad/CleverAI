import { ZodError } from "zod";
import type { H3Event } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  CaptureWordDTO,
  getLanguageLabel,
} from "@shared/utils/language.contract";
import {
  setQuotaHeaders,
  throwQuotaExceeded,
} from "@server/modules/subscription/infrastructure/http/quotaHttp";
import { translationPrompt } from "@server/utils/llm/languagePrompts";
import { llmRequestPipeline } from "@server/utils/llm/llmRequestPipeline";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import type {
  LanguageExample,
  LanguageMeaning,
} from "@shared/utils/language.contract";

type ParsedLexicalEntry = {
  translation?: string;
  partOfSpeech?: string;
  detectedLang?: string;
  phonetic?: string;
  meanings?: LanguageMeaning[];
  examples?: LanguageExample[];
  category?: string;
  difficulty?: string;
  isPhrase?: boolean;
  metadata?: Record<string, unknown>;
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeMeanings = (value: unknown): LanguageMeaning[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const definition = asString(source.definition);
      if (!definition) return null;
      const meaning: LanguageMeaning = { definition };
      const translation = asString(source.translation);
      const example = asString(source.example);
      const partOfSpeech = asString(source.partOfSpeech);
      const category = asString(source.category);
      const register = asString(source.register);
      if (translation) meaning.translation = translation;
      if (example) meaning.example = example;
      if (partOfSpeech) meaning.partOfSpeech = partOfSpeech;
      if (category) meaning.category = category;
      if (register) meaning.register = register;
      return meaning;
    })
    .filter((item): item is LanguageMeaning => item !== null)
    .slice(0, 4);
};

const normalizeExamples = (value: unknown): LanguageExample[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const text = asString(source.text);
      if (!text) return null;
      const example: LanguageExample = { text };
      const translation = asString(source.translation);
      if (translation) example.translation = translation;
      return example;
    })
    .filter((item): item is LanguageExample => item !== null)
    .slice(0, 3);
};

const normalizeParsedEntry = (
  parsed: ParsedLexicalEntry,
  fallbackWord: string,
) => {
  const meanings = normalizeMeanings(parsed.meanings);
  const examples = normalizeExamples(parsed.examples);
  const translation =
    asString(parsed.translation) ||
    meanings.find((meaning) => meaning.translation)?.translation ||
    "";

  return {
    translation,
    partOfSpeech: asString(parsed.partOfSpeech) || "unknown",
    detectedLang: asString(parsed.detectedLang) || "auto",
    phonetic: asString(parsed.phonetic) || undefined,
    meanings:
      meanings.length > 0
        ? meanings
        : [
            {
              definition: translation || fallbackWord,
              partOfSpeech: asString(parsed.partOfSpeech) || "unknown",
            },
          ],
    examples,
    category: asString(parsed.category) || meanings[0]?.category || undefined,
    difficulty: asString(parsed.difficulty) || undefined,
    isPhrase:
      typeof parsed.isPhrase === "boolean"
        ? parsed.isPhrase
        : fallbackWord.trim().split(/\s+/).length > 1,
    metadata:
      parsed.metadata && typeof parsed.metadata === "object"
        ? (parsed.metadata as Record<string, unknown>)
        : {},
  };
};

const jsonArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const quotaPort = new PrismaQuotaPort();

const billSharedTranslationHit = async (event: H3Event, userId: string) => {
  const quota = await quotaPort.checkGenerationQuota(userId);
  setQuotaHeaders(event, quota.subscription);
  if (!quota.canGenerate) {
    throwQuotaExceeded(
      event,
      quota.subscription,
      "Quota exceeded. Please upgrade to continue translating.",
    );
  }

  const updatedQuota = await quotaPort.consumeGeneration(userId);
  setQuotaHeaders(event, updatedQuota);
  return updatedQuota;
};

const serializeWord = (
  word: {
    id: string;
    translationId?: string | null;
    word: string;
    translation: string;
    partOfSpeech?: string | null;
    sourceLang: string;
    phonetic?: string | null;
    meanings?: unknown;
    examples?: unknown;
    category?: string | null;
    difficulty?: string | null;
    isPhrase: boolean;
    metadata?: unknown;
    status: string;
  },
  cached: boolean,
  sharedCacheHit = false,
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
  status: word.status,
  cached,
  sharedCacheHit,
});

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;

  // Validate body first
  let data: CaptureWordDTO;
  try {
    data = CaptureWordDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  // Auth early so we can query the DB for an existing translation.
  // Passed to the pipeline so it doesn't do a redundant requireRole call.
  const user = await requireRole(event, ["USER"]);

  const targetLang = data.targetLang ?? "en";

  // ── Dedup check ──────────────────────────────────────────────────────────
  // Normalise the word (trim + lowercase) so "Apple", "apple", " apple " all
  // match the same stored record.
  const normalizedWord = data.word.trim().toLowerCase();

  if (!data.forceRetranslate) {
    const existing = await prisma.languageWord.findFirst({
      where: {
        userId: user.id,
        word: normalizedWord,
        translationLang: targetLang,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return success(serializeWord(existing, true));
    }

    const sharedTranslation = await prisma.languageTranslation.findFirst({
      where: {
        normalizedSourceText: normalizedWord,
        translationLang: targetLang,
        ...(data.sourceLang && data.sourceLang !== "auto"
          ? { sourceLang: data.sourceLang }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (sharedTranslation) {
      if (data.translateOnly) {
        await billSharedTranslationHit(event, user.id);
        return success({
          translationId: sharedTranslation.id,
          word: sharedTranslation.sourceText,
          translation: sharedTranslation.translation,
          partOfSpeech: sharedTranslation.partOfSpeech ?? "unknown",
          detectedLang: sharedTranslation.sourceLang,
          phonetic: sharedTranslation.phonetic ?? undefined,
          meanings: jsonArray<LanguageMeaning>(sharedTranslation.meanings),
          examples: jsonArray<LanguageExample>(sharedTranslation.examples),
          category: sharedTranslation.category ?? undefined,
          difficulty: sharedTranslation.difficulty ?? undefined,
          isPhrase: sharedTranslation.isPhrase,
          metadata: jsonRecord(sharedTranslation.metadata),
          saved: false,
          cached: true,
          sharedCacheHit: true,
        });
      }

      await billSharedTranslationHit(event, user.id);
      const languageWord = await prisma.languageWord.create({
        data: {
          userId: user.id,
          translationId: sharedTranslation.id,
          word: sharedTranslation.sourceText,
          translation: sharedTranslation.translation,
          translationLang: sharedTranslation.translationLang,
          sourceLang: sharedTranslation.sourceLang,
          partOfSpeech: sharedTranslation.partOfSpeech ?? "unknown",
          phonetic: sharedTranslation.phonetic ?? null,
          meanings: sharedTranslation.meanings ?? undefined,
          examples: sharedTranslation.examples ?? undefined,
          category: sharedTranslation.category ?? null,
          difficulty: sharedTranslation.difficulty ?? null,
          isPhrase: sharedTranslation.isPhrase,
          metadata: {
            ...jsonRecord(sharedTranslation.metadata),
            sharedTranslationId: sharedTranslation.id,
          },
          sourceContext: data.sourceContext,
          sourceType: data.sourceType ?? "manual",
          sourceRefId: data.sourceRefId,
          status: "captured",
        },
      });

      return success(serializeWord(languageWord, true, true));
    }
  }

  // ── New word — run the pipeline ──────────────────────────────────────────
  const langName = getLanguageLabel(targetLang);

  const prompt = translationPrompt(
    normalizedWord,
    data.sourceContext,
    langName,
    data.includeTranslation,
  );

  const ctx = await llmRequestPipeline(event, {
    quotaPort,
    task: "language_translate",
    inputText: prompt,
    estimatedOutputTokens: 450,
    pinnedModelId: "gemini-2.0-flash-lite",
    checkQuota: true,
    incrementQuota: true,
    rateLimitMax: 15,
    ipRateLimitMax: 40,
    user,
  });

  let rawText: string;
  try {
    rawText = await ctx.strategy.generateText(prompt);
  } catch (err) {
    await ctx.fail(err);
    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Translation quota exceeded. Please try again later."
        : "Translation failed. Please try again.";
    throw Errors.server(message);
  }

  await ctx.finalize({ outputText: rawText });

  // Strip markdown code fences the model may wrap around JSON despite instructions.
  const jsonText = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: ParsedLexicalEntry;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[translate] Failed to parse LLM response:", rawText);
    throw Errors.server("Failed to parse translation response");
  }

  const entry = normalizeParsedEntry(parsed, normalizedWord);

  if (data.includeTranslation && !entry.translation) {
    throw Errors.server("Translation response missing required fields");
  }

  const translationEntry = await prisma.languageTranslation.upsert({
    where: {
      normalizedSourceText_sourceLang_translationLang: {
        normalizedSourceText: normalizedWord,
        sourceLang: entry.detectedLang,
        translationLang: targetLang,
      },
    },
    update: {
      sourceText: normalizedWord,
      translation: entry.translation,
      partOfSpeech: entry.partOfSpeech,
      phonetic: entry.phonetic ?? null,
      meanings: entry.meanings as any,
      examples: entry.examples as any,
      category: entry.category ?? null,
      difficulty: entry.difficulty ?? null,
      isPhrase: entry.isPhrase,
      metadata: entry.metadata as any,
      modelId: ctx.selectedModel.modelId,
    },
    create: {
      sourceText: normalizedWord,
      normalizedSourceText: normalizedWord,
      sourceLang: entry.detectedLang,
      translationLang: targetLang,
      translation: entry.translation,
      partOfSpeech: entry.partOfSpeech,
      phonetic: entry.phonetic ?? null,
      meanings: entry.meanings as any,
      examples: entry.examples as any,
      category: entry.category ?? null,
      difficulty: entry.difficulty ?? null,
      isPhrase: entry.isPhrase,
      metadata: entry.metadata as any,
      modelId: ctx.selectedModel.modelId,
    },
  });

  if (data.translateOnly) {
    return success({
      translationId: translationEntry.id,
      word: normalizedWord,
      translation: entry.translation,
      partOfSpeech: entry.partOfSpeech,
      detectedLang: entry.detectedLang,
      phonetic: entry.phonetic,
      meanings: entry.meanings,
      examples: entry.examples,
      category: entry.category,
      difficulty: entry.difficulty,
      isPhrase: entry.isPhrase,
      metadata: entry.metadata,
      saved: false,
      cached: false,
    });
  }

  // Save the lexical analysis so later screens can filter and reuse it.
  const languageWord = await prisma.languageWord.create({
    data: {
      userId: user.id,
      translationId: translationEntry.id,
      word: normalizedWord,
      translation: entry.translation,
      translationLang: targetLang,
      sourceLang: entry.detectedLang ?? data.sourceLang ?? "auto",
      partOfSpeech: entry.partOfSpeech,
      phonetic: entry.phonetic ?? null,
      meanings: entry.meanings as any,
      examples: entry.examples as any,
      category: entry.category ?? null,
      difficulty: entry.difficulty ?? null,
      isPhrase: entry.isPhrase,
      metadata: entry.metadata as any,
      sourceContext: data.sourceContext,
      sourceType: data.sourceType ?? "manual",
      sourceRefId: data.sourceRefId,
      status: "captured",
    },
  });

  return success({
    wordId: languageWord.id,
    translationId: translationEntry.id,
    word: languageWord.word,
    translation: entry.translation,
    partOfSpeech: entry.partOfSpeech,
    detectedLang: entry.detectedLang,
    phonetic: entry.phonetic,
    meanings: entry.meanings,
    examples: entry.examples,
    category: entry.category,
    difficulty: entry.difficulty,
    isPhrase: entry.isPhrase,
    metadata: entry.metadata,
    saved: true,
    status: languageWord.status,
    cached: false,
  });
});
