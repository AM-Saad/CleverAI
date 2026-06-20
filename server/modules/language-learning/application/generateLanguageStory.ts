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

type RelatedWordCandidate = { id: string; word: string };

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

  const prompt = languageStoryPrompt(
    languageWord.word,
    languageWord.translation,
    languageWord.sourceContext ?? undefined,
    relatedWords,
    getLanguageLabel(languageWord.sourceLang),
    getLanguageLabel(languageWord.translationLang),
  );

  const { llmRequestPipeline } = await import(
    "@server/utils/llm/llmRequestPipeline"
  );
  const ctx = await llmRequestPipeline(input.event, {
    quotaPort: input.quotaPort,
    task: "language_story",
    inputText: prompt,
    checkQuota: true,
    incrementQuota: true,
    user,
  });

  let rawText = "";
  let didFinalize = false;
  try {
    rawText = await ctx.strategy.generateText(prompt);
    const parsed = parseLanguageStoryResponse(rawText);
    const { updatedQuota } = await ctx.finalize({ outputText: rawText });
    didFinalize = true;

    const story = await prisma.languageStory.create({
      data: {
        wordId: languageWord.id,
        userId: user.id,
        storyText: parsed.storyText,
        sentences: parsed.sentences as any,
        modelId: ctx.selectedModel.modelId,
      },
    });

    if (prefs.autoEnroll) {
      await enrollLanguageWord({
        prisma,
        userId: user.id,
        wordId: languageWord.id,
      });
    } else {
      await prisma.languageWord.update({
        where: { id: languageWord.id },
        data: { status: "story_ready" },
      });
    }

    return {
      storyId: story.id,
      storyText: story.storyText,
      sentences: parsed.sentences,
      wordId: languageWord.id,
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
    if (!didFinalize) {
      await ctx.fail(err);
    }

    if (err && typeof err === "object" && "statusCode" in err) {
      throw err;
    }
    if (rawText) {
      console.error("[generate-story] Failed to process LLM response:", rawText);
    }

    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan or try again later."
        : "Story generation failed. Please try again.";
    throw Errors.server(message);
  }
}
