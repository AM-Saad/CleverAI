import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { GenerateStoryDTO } from "@shared/utils/language.contract";
import { languageStoryPrompt } from "@server/utils/llm/languagePrompts";
import { llmRequestPipeline } from "@server/utils/llm/llmRequestPipeline";
import type { LanguageSentence } from "@shared/utils/language.contract";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;

  let data: GenerateStoryDTO;
  try {
    data = GenerateStoryDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  // Auth is needed here before the pipeline so we can fetch the languageWord
  // and build the prompt. We pass the user to the pipeline to skip re-auth.
  const user = await requireRole(event, ["USER"]);

  // Fetch the language word and verify ownership
  const languageWord = await prisma.languageWord.findFirst({
    where: { id: data.wordId, userId: user.id },
  });
  if (!languageWord) {
    throw Errors.notFound("Word");
  }

  // Check / create user preferences
  let prefs = await prisma.userLanguagePreferences.findUnique({
    where: { userId: user.id },
  });
  if (!prefs) {
    prefs = await prisma.userLanguagePreferences.create({
      data: { userId: user.id },
    });
  }

  // Mark word as story pending
  await prisma.languageWord.update({
    where: { id: languageWord.id },
    data: { status: "story_pending" },
  });

  const prompt = languageStoryPrompt(
    languageWord.word,
    languageWord.translation,
    languageWord.sourceContext ?? undefined,
    data.relatedWords ?? []
  );

  // Pipeline: story generation counts toward quota (D3).
  // Pass pre-fetched user so pipeline skips a redundant requireRole call.
  const ctx = await llmRequestPipeline(event, {
    task: "language_story",
    inputText: prompt,
    estimatedOutputTokens: 300,
    checkQuota: true,
    incrementQuota: true,
    user,
  });

  let rawText: string;
  try {
    rawText = await ctx.strategy.generateText(prompt);
  } catch (err) {
    await ctx.fail(err);
    // Revert the word's status so the user can retry
    await prisma.languageWord
      .update({ where: { id: languageWord.id }, data: { status: "captured" } })
      .catch(() => { });
    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan or try again later."
        : "Story generation failed. Please try again.";
    throw Errors.server(message);
  }

  // Log cost + latency and increment quota
  const { updatedQuota } = await ctx.finalize({ outputText: rawText });

  // Strip markdown code fences the model may wrap around JSON despite instructions.
  const jsonText = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Parse the story JSON
  let parsed: { storyText: string; sentences: LanguageSentence[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[generate-story] Failed to parse LLM response:", rawText);
    throw Errors.server("Failed to parse story response");
  }

  if (!parsed.storyText || !Array.isArray(parsed.sentences)) {
    throw Errors.server("Story response missing required fields");
  }

  // Save story and update word in a transaction
  const { story } = await prisma.$transaction(async (tx) => {
    const story = await tx.languageStory.create({
      data: {
        wordId: languageWord.id,
        userId: user.id,
        storyText: parsed.storyText,
        sentences: parsed.sentences as any,
      },
    });

    await tx.languageWord.update({
      where: { id: languageWord.id },
      data: { status: "story_ready" },
    });

    // Auto-enroll if preferences say so
    if (prefs!.autoEnroll) {
      await tx.languageCardReview.upsert({
        where: {
          userId_wordId: {
            userId: user.id,
            wordId: languageWord.id,
          },
        },
        update: { storyId: story.id },
        create: {
          userId: user.id,
          wordId: languageWord.id,
          storyId: story.id,
          nextReviewAt: new Date(),
          repetitions: 0,
          easeFactor: 2.5,
          intervalDays: 0,
          streak: 0,
        },
      });

      await tx.languageWord.update({
        where: { id: languageWord.id },
        data: { status: "enrolled" },
      });
    }

    return { story };
  });

  return success({
    storyId: story.id,
    storyText: story.storyText,
    sentences: parsed.sentences,
    wordId: languageWord.id,
    // Subscription snapshot so the frontend can update its quota display
    subscription: updatedQuota
      ? {
        tier: updatedQuota.tier,
        generationsUsed: updatedQuota.generationsUsed,
        generationsQuota: updatedQuota.generationsQuota,
        remaining: updatedQuota.remaining,
      }
      : undefined,
  });
});
