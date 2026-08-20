import type { H3Event } from "h3";
import { Errors } from "@server/utils/error";
import {
  type GenerateStoryDTO,
  getLanguageLabel,
} from "@shared/utils/language.contract";
import { languageStoryPrompt } from "@server/utils/llm/languagePrompts";
import { parseLanguageStoryResponse } from "../domain/storyResponse";
import { enrollLanguageWord } from "./enrollLanguageWord";
import type { QuotaPort } from "@server/modules/subscription/ports/QuotaPort";
import {
  OpenRouterRequestError,
  type OpenRouterGeneration,
} from "@server/utils/llm/openRouter";

type RelatedWordCandidate = { id: string; word: string };

const firstDefinition = (meanings: unknown) => {
  if (!Array.isArray(meanings)) return undefined;
  const first = meanings.find(
    (meaning) =>
      meaning &&
      typeof meaning === "object" &&
      typeof (meaning as { definition?: unknown }).definition === "string",
  ) as { definition?: string } | undefined;
  return first?.definition;
};

const sanitizeRelatedWords = (words: string[]) =>
  words
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 5);

export async function generateLanguageStory(input: {
  event: H3Event;
  user: { id: string };
  data: GenerateStoryDTO;
  quotaPort: QuotaPort;
}) {
  const prisma = input.event.context.prisma;
  const { data, user } = input;

  const languageWord = await prisma.languageWord.findFirst({
    where: { id: data.wordId, userId: user.id },
  });
  if (!languageWord) {
    throw Errors.notFound("Word");
  }

  let prefs = await prisma.userLanguagePreferences.findUnique({
    where: { userId: user.id },
  });
  if (!prefs) {
    prefs = await prisma.userLanguagePreferences.create({
      data: { userId: user.id },
    });
  }

  const relatedCandidates: RelatedWordCandidate[] =
    data.relatedWords.length > 0 || !languageWord.category
      ? []
      : ((await prisma.languageWord.findMany({
          where: {
            userId: user.id,
            id: { not: languageWord.id },
            category: languageWord.category,
            sourceLang: languageWord.sourceLang,
            createdAt: { lt: languageWord.createdAt },
          },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { id: true, word: true },
        })) as RelatedWordCandidate[]);
  const relatedWords =
    data.relatedWords.length > 0
      ? sanitizeRelatedWords(data.relatedWords)
      : relatedCandidates.map((word) => word.word);
  const learnedLanguage =
    languageWord.sourceLang && languageWord.sourceLang !== "auto"
      ? languageWord.sourceLang
      : prefs.targetLanguage;
  const nativeLanguage =
    languageWord.translationLang && languageWord.translationLang !== "auto"
      ? languageWord.translationLang
      : prefs.nativeLanguage;

  const prompt = languageStoryPrompt(
    languageWord.word,
    languageWord.translation ||
      firstDefinition(languageWord.meanings) ||
      "captured vocabulary",
    languageWord.sourceContext ?? undefined,
    relatedWords,
    getLanguageLabel(learnedLanguage),
    getLanguageLabel(nativeLanguage),
  );

  const { llmRequestPipeline, throwMappedOpenRouterError } =
    await import("@server/utils/llm/llmRequestPipeline");
  const ctx = await llmRequestPipeline(input.event, {
    quotaPort: input.quotaPort,
    task: "language_story",
    inputText: prompt,
    checkQuota: true,
    incrementQuota: true,
    user,
  });

  let rawText = "";
  let generation: OpenRouterGeneration<string> | undefined;
  try {
    generation = await ctx.ai.generateText(prompt);
    rawText = generation.value;
    const parsed = parseLanguageStoryResponse(rawText, languageWord.word);

    const story = await prisma.languageStory.create({
      data: {
        wordId: languageWord.id,
        userId: user.id,
        storyText: parsed.storyText,
        sentences: parsed.sentences as any,
        modelId: generation.measurement.actualModel,
      },
    });

    const existingReview = await prisma.languageCardReview.findUnique({
      where: {
        userId_wordId: { userId: user.id, wordId: languageWord.id },
      },
      select: { id: true },
    });
    let status: "story_ready" | "enrolled" | "mastered";
    // autoEnroll governs creating a card. Once a card exists, regenerated
    // story content must replace its stale presentation regardless of that
    // preference.
    if (prefs.autoEnroll || existingReview) {
      const enrollment = await enrollLanguageWord({
        prisma,
        userId: user.id,
        wordId: languageWord.id,
      });
      status = enrollment.status;
    } else {
      await prisma.languageWord.update({
        where: { id: languageWord.id },
        data: { status: "story_ready" },
      });
      status = "story_ready";
    }

    const { updatedQuota } = await ctx.finalize({ generation });
    return {
      storyId: story.id,
      storyText: story.storyText,
      sentences: parsed.sentences,
      wordId: languageWord.id,
      language: learnedLanguage,
      status,
      subscription: updatedQuota
        ? {
            tier: updatedQuota.tier,
            generationsUsed: updatedQuota.generationsUsed,
            generationsQuota: updatedQuota.generationsQuota,
            remaining: updatedQuota.remaining,
          }
        : undefined,
    };
  } catch (err) {
    await ctx.fail(err, { generation });
    if (err instanceof OpenRouterRequestError) {
      throwMappedOpenRouterError(err);
    }

    if (err && typeof err === "object" && "statusCode" in err) {
      throw err;
    }
    if (rawText) {
      console.error(
        "[generate-story] Failed to process LLM response:",
        rawText,
      );
    }

    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan or try again later."
        : "Story generation failed. Please try again.";
    throw Errors.server(message);
  }
}
