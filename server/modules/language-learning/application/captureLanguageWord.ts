import type { H3Event } from "h3";
import { Errors } from "@server/utils/error";
import {
  type CaptureWordDTO,
  type CaptureWordResponse,
  getLanguageLabel,
  type LanguageExample,
  type LanguageMeaning,
} from "@shared/utils/language.contract";
import { translationPrompt } from "@server/utils/llm/languagePrompts";
import { parseLexicalEntry } from "../domain/lexicalEntry";
import type { QuotaPort } from "@server/modules/subscription/ports/QuotaPort";
import { maybeAutoEnrollLanguageWord } from "./autoEnrollLanguageWord";
import { createHash } from "node:crypto";
import { saveLanguageWord } from "./saveLanguageWord";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const jsonArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const safeSourceRefId = (sourceRefId?: string) =>
  sourceRefId && OBJECT_ID_RE.test(sourceRefId) ? sourceRefId : undefined;

const normalizedContext = (sourceContext?: string) =>
  sourceContext?.trim().replace(/\s+/g, " ") || undefined;

const translationContextKey = (
  sourceContext?: string,
  includeTranslation = true,
) => {
  const context = normalizedContext(sourceContext);
  const base = context
    ? createHash("sha256").update(context.toLowerCase()).digest("hex")
    : "general";
  // A definition-only lexical entry must never overwrite or masquerade as a
  // translated entry for the same word and language pair.
  return includeTranslation ? base : `definition-only:${base}`;
};

const withSourceRefMetadata = (
  metadata: Record<string, unknown>,
  sourceRefId?: string,
) =>
  sourceRefId && !safeSourceRefId(sourceRefId)
    ? { ...metadata, sourceRefId }
    : metadata;

export const serializeCapturedWord = (
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

export async function captureLanguageWord(input: {
  event: H3Event;
  user: { id: string };
  data: CaptureWordDTO;
  quotaPort: QuotaPort;
  billSharedTranslationHit: (
    event: H3Event,
    userId: string,
  ) => Promise<unknown>;
}): Promise<CaptureWordResponse> {
  const prisma = input.event.context.prisma;
  const { data, user } = input;
  const targetLang = data.targetLang ?? "en";
  const normalizedWord = data.word.trim().toLowerCase();
  const explicitSourceLang =
    data.sourceLang && data.sourceLang !== "auto" ? data.sourceLang : undefined;
  const sourceContext = normalizedContext(data.sourceContext);
  const contextKey = translationContextKey(
    sourceContext,
    data.includeTranslation,
  );
  // Automatic source detection cannot safely select a cross-language cache
  // entry. Resolve the language with the model first, then persist/cache under
  // the detected source language.
  const canUseExistingTranslation =
    !data.forceRetranslate && Boolean(explicitSourceLang);
  const preferences = data.translateOnly
    ? null
    : await prisma.userLanguagePreferences.findUnique({
        where: { userId: user.id },
        select: { autoEnroll: true },
      });
  const autoEnroll = data.translateOnly
    ? false
    : (preferences?.autoEnroll ?? true);

  if (canUseExistingTranslation) {
    const existing = await prisma.languageWord.findFirst({
      where: {
        userId: user.id,
        word: normalizedWord,
        translationLang: targetLang,
        sourceLang: explicitSourceLang,
        sourceContext: sourceContext ?? null,
        ...(data.includeTranslation ? { translation: { not: "" } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const status = await maybeAutoEnrollLanguageWord({
        prisma,
        userId: user.id,
        wordId: existing.id,
        currentStatus: existing.status,
        autoEnroll,
      });
      return serializeCapturedWord({ ...existing, status }, true);
    }

    const sharedTranslation = await prisma.languageTranslation.findFirst({
      where: {
        normalizedSourceText: normalizedWord,
        translationLang: targetLang,
        sourceLang: explicitSourceLang,
        contextKey,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (sharedTranslation) {
      await input.billSharedTranslationHit(input.event, user.id);
      if (data.translateOnly) {
        return {
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
        };
      }
      return saveLanguageWord({
        prisma,
        userId: user.id,
        data: {
          translationId: sharedTranslation.id,
          sourceContext,
          sourceType: data.sourceType ?? "manual",
          sourceRefId: data.sourceRefId,
        },
      });
    }
  }

  const prompt = translationPrompt(
    normalizedWord,
    data.sourceContext,
    getLanguageLabel(targetLang),
    data.includeTranslation,
  );

  const { llmRequestPipeline } =
    await import("@server/utils/llm/llmRequestPipeline");
  const ctx = await llmRequestPipeline(input.event, {
    quotaPort: input.quotaPort,
    task: "language_translate",
    inputText: prompt,
    checkQuota: true,
    incrementQuota: true,
    rateLimitMax: 15,
    ipRateLimitMax: 40,
    user,
  });

  let rawText = "";
  let didFinalize = false;
  try {
    rawText = await ctx.strategy.generateText(prompt);
    const entry = parseLexicalEntry(rawText, normalizedWord);

    if (data.includeTranslation && !entry.translation) {
      throw Errors.server("Translation response missing required fields");
    }

    await ctx.finalize({ outputText: rawText });
    didFinalize = true;

    const metadata = withSourceRefMetadata(entry.metadata, data.sourceRefId);
    const translationEntry = await prisma.languageTranslation.upsert({
      where: {
        normalizedSourceText_sourceLang_translationLang_contextKey: {
          normalizedSourceText: normalizedWord,
          sourceLang: entry.detectedLang,
          translationLang: targetLang,
          contextKey,
        },
      },
      update: {
        sourceText: normalizedWord,
        contextKey,
        translation: entry.translation,
        partOfSpeech: entry.partOfSpeech,
        phonetic: entry.phonetic ?? null,
        meanings: entry.meanings as any,
        examples: entry.examples as any,
        category: entry.category ?? null,
        difficulty: entry.difficulty ?? null,
        isPhrase: entry.isPhrase,
        metadata: metadata as any,
        modelId: ctx.selectedModel.modelId,
      },
      create: {
        sourceText: normalizedWord,
        normalizedSourceText: normalizedWord,
        sourceLang: entry.detectedLang,
        translationLang: targetLang,
        contextKey,
        translation: entry.translation,
        partOfSpeech: entry.partOfSpeech,
        phonetic: entry.phonetic ?? null,
        meanings: entry.meanings as any,
        examples: entry.examples as any,
        category: entry.category ?? null,
        difficulty: entry.difficulty ?? null,
        isPhrase: entry.isPhrase,
        metadata: metadata as any,
        modelId: ctx.selectedModel.modelId,
      },
    });

    if (data.translateOnly) {
      const existingWord = await prisma.languageWord.findFirst({
        where: {
          userId: user.id,
          translationId: translationEntry.id,
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingWord) {
        return serializeCapturedWord(existingWord, false);
      }
      return {
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
        metadata,
        saved: false,
        cached: false,
      };
    }

    return saveLanguageWord({
      prisma,
      userId: user.id,
      data: {
        translationId: translationEntry.id,
        sourceContext,
        sourceType: data.sourceType ?? "manual",
        sourceRefId: data.sourceRefId,
      },
    });
  } catch (err) {
    if (!didFinalize) {
      await ctx.fail(err);
    }
    if (err && typeof err === "object" && "statusCode" in err) {
      throw err;
    }
    if (rawText) {
      console.error("[translate] Failed to process LLM response:", rawText);
    }
    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Translation quota exceeded. Please try again later."
        : "Translation failed. Please try again.";
    throw Errors.server(message);
  }
}
