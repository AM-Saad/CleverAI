import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CaptureWordDTO } from "@shared/utils/language.contract";
import { translationPrompt } from "@server/utils/llm/languagePrompts";
import { llmRequestPipeline } from "@server/utils/llm/llmRequestPipeline";

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
        err.issues.map((i) => ({ path: i.path, message: i.message }))
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

  const existing = await prisma.languageWord.findFirst({
    where: {
      userId: user.id,
      word: normalizedWord,
      translationLang: targetLang,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Return the cached record — no LLM call, no rate-limit consumed.
    return success({
      wordId: existing.id,
      word: existing.word,
      translation: existing.translation,
      partOfSpeech: existing.partOfSpeech ?? "unknown",
      detectedLang: existing.sourceLang,
      phonetic: existing.phonetic ?? undefined,
      cached: true,
    });
  }

  // ── New word — run the pipeline ──────────────────────────────────────────
  const langName =
    targetLang === "en"
      ? "English"
      : targetLang === "es"
        ? "Spanish"
        : targetLang === "fr"
          ? "French"
          : targetLang === "de"
            ? "German"
            : targetLang === "ar"
              ? "Arabic"
              : targetLang;

  const prompt = translationPrompt(normalizedWord, data.sourceContext, langName);

  // No quota gate or quota increment (D2) — rate-limited only to prevent abuse.
  const ctx = await llmRequestPipeline(event, {
    task: "language_translate",
    inputText: prompt,
    estimatedOutputTokens: 100,
    pinnedModelId: "gemini-2.0-flash-lite",
    checkQuota: false,
    incrementQuota: false,
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
  const jsonText = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let parsed: {
    translation: string;
    partOfSpeech: string;
    detectedLang: string;
    phonetic?: string;
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[translate] Failed to parse LLM response:", rawText);
    throw Errors.server("Failed to parse translation response");
  }

  if (!parsed.translation) {
    throw Errors.server("Translation response missing required fields");
  }

  // Save — store partOfSpeech and phonetic so future dedup hits return full data.
  const languageWord = await prisma.languageWord.create({
    data: {
      userId: user.id,
      word: normalizedWord,
      translation: parsed.translation,
      translationLang: targetLang,
      sourceLang: parsed.detectedLang ?? data.sourceLang ?? "auto",
      partOfSpeech: parsed.partOfSpeech ?? "unknown",
      phonetic: parsed.phonetic ?? null,
      sourceContext: data.sourceContext,
      sourceType: data.sourceType ?? "manual",
      sourceRefId: data.sourceRefId,
      status: "captured",
    },
  });

  return success({
    wordId: languageWord.id,
    word: languageWord.word,
    translation: parsed.translation,
    partOfSpeech: parsed.partOfSpeech ?? "unknown",
    detectedLang: parsed.detectedLang ?? "auto",
    phonetic: parsed.phonetic,
    cached: false,
  });
});

