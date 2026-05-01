// server/utils/llm/OpenRouterStrategy.ts
import { OpenRouter } from "@openrouter/sdk";
import { Errors } from "../error";
import { LlmMeasured } from "../llmCost";

// Small helper to avoid hard crashes on imperfect LLM JSON
function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    // Strip markdown code blocks if the LLM wrapped the JSON in them
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      // Remove opening ```json (or just ```)
      cleanText = cleanText.replace(/^```[a-z]*\n?/i, "");
      // Remove closing ```
      cleanText = cleanText.replace(/\n?```$/i, "");
      cleanText = cleanText.trim();
    }
    return JSON.parse(cleanText) as T;
  } catch {
    console.warn("Failed to parse LLM Output:", text);
    return fallback;
  }
}

export interface OpenRouterConfig {
  /** Send include_reasoning to enable chain-of-thought (only for reasoning models) */
  includeReasoning?: boolean;
  /** OpenRouter model fallback chain — additional models to try on failure */
  fallbackModels?: string[];
  /** Provider sort preference: 'price' | 'throughput' | 'latency' */
  providerSort?: "price" | "throughput" | "latency";
}

export class OpenRouterStrategy implements LLMStrategy {
  private client: OpenRouter;
  private modelName: string;
  private onMeasure?: (m: LlmMeasured) => void;
  private config: OpenRouterConfig;

  constructor(
    modelName: string,
    onMeasure?: (m: LlmMeasured) => void,
    config?: OpenRouterConfig
  ) {
    // Use **private** server runtime config
    const {
      openrouterKey,
      public: { APP_BASE_URL },
    } = useRuntimeConfig();
    if (!openrouterKey) {
      throw new Error("Missing OPENROUTER_API_KEY in runtimeConfig");
    }

    // Initialize Official OpenRouter SDK with proper headers for rankings
    this.client = new OpenRouter({
      apiKey: openrouterKey,
      httpReferer: APP_BASE_URL || "https://cognilo.com",
      xTitle: "Cognilo AI",
    });

    this.modelName = modelName;
    this.onMeasure = onMeasure;
    this.config = config ?? {};
  }

  // ---------------------------------------------------------------
  // Core API call + measurement (DRY — shared by flashcards & quiz)
  // ---------------------------------------------------------------
  private async callOpenRouter(prompt: string): Promise<string> {
    const inputChars = prompt.length;

    // Dev mock mode: skip API and return deterministic JSON (no credits used)
    if (process.env.OPENROUTER_MOCK === "1") {
      console.log("OpenRouter mock mode active");
      return "MOCK";
    }

    // Build request params using SDK types
    const chatParams: Record<string, any> = {
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
    };

    // Only include reasoning for models that support it
    if (this.config.includeReasoning) {
      chatParams.reasoning = { effort: "medium" };
    }

    // Use OpenRouter model fallback chain if configured
    if (this.config.fallbackModels?.length) {
      chatParams.models = [
        this.modelName,
        ...this.config.fallbackModels,
      ];
    }

    // Provider routing preferences (price/throughput/latency)
    if (this.config.providerSort) {
      chatParams.provider = { sort: this.config.providerSort };
    }

    try {
      // SDK requires params nested under `chatGenerationParams`
      const res = await this.client.chat.send({
        chatGenerationParams: chatParams,
      } as any);

      // Actual token counts from OpenRouter response
      const promptTokens = Number(res.usage?.promptTokens ?? 0);
      const completionTokens = Number(res.usage?.completionTokens ?? 0);
      const totalTokens = promptTokens + completionTokens;
      const content = res.choices?.[0]?.message?.content?.trim() ?? "[]";
      const outputChars = typeof content === "string" ? content.length : 0;

      console.log(res)
      // Reasoning tokens (SDK uses camelCase)
      const reasoningTokens =
        (res.usage as any)?.completionTokensDetails?.reasoningTokens ?? 0;

      // Native cost from OpenRouter — can be a string OR number
      const rawCostRaw =
        res.usage && "cost" in res.usage ? (res.usage as any).cost : undefined;
      const rawCost =
        rawCostRaw != null && rawCostRaw !== ""
          ? parseFloat(String(rawCostRaw))
          : undefined;
      const validRawCost =
        rawCost != null && !isNaN(rawCost) && rawCost >= 0
          ? rawCost
          : undefined;

      this.onMeasure?.({
        provider: "openrouter",
        model: this.modelName,
        promptTokens,
        completionTokens,
        totalTokens,
        requestId: res.id,
        rawUsage: res.usage,
        rawCost: validRawCost,
        reasoningTokens,
        meta: {
          inputChars,
          outputChars,
          // The actual model used (may differ if fallback triggered)
          actualModel: (res as any).model,
        },
      });

      return content;
    } catch (error: any) {
      console.error("OpenRouter error", error.status, error.message);

      const isRateLimit = error.status === 429;
      const statusCode = isRateLimit ? 429 : 502;

      throw createError({
        statusCode,
        statusMessage: `OpenRouter error: ${error.status} ${error.message}`,
      });
    }
  }

  // ---------------------------------------------------------------
  // Public API — Raw text (used by language module)
  // ---------------------------------------------------------------
  async generateText(prompt: string): Promise<string> {
    return this.callOpenRouter(prompt);
  }

  // ---------------------------------------------------------------
  // Public API — Flashcards
  // ---------------------------------------------------------------
  async generateFlashcards(
    input: string,
    options?: LLMGenerationOptions
  ): Promise<FlashcardDTO[]> {
    const itemCount = options?.itemCount ?? 5;

    // Dev mock
    if (process.env.OPENROUTER_MOCK === "1") {
      console.log("OpenRouter mock mode active");
      return [
        {
          front: "What is OpenRouter?",
          back: "A unified API gateway for multiple LLMs.",
        },
        { front: "Does OpenRouter support OpenAI models?", back: "Yes." },
      ];
    }

    const prompt = flashcardPrompt(input, itemCount);
    const content = await this.callOpenRouter(prompt);

    const raw = safeParseJSON<any[]>(content, []);

    // Minimal validation/sanitization to keep structure predictable
    const cards: FlashcardDTO[] = [];
    for (const item of raw) {
      const front = typeof item?.front === "string" ? item.front.trim() : "";
      const back = typeof item?.back === "string" ? item.back.trim() : "";
      if (front && back) {
        cards.push({
          front,
          back,
          sourceMetadata: item?.sourceMetadata || item?.source_metadata,
        });
      }
    }
    return cards;
  }

  // ---------------------------------------------------------------
  // Public API — Quiz
  // ---------------------------------------------------------------
  async generateQuiz(
    input: string,
    options?: LLMGenerationOptions
  ): Promise<QuizQuestionDTO[]> {
    const itemCount = options?.itemCount ?? 3;

    // Dev mock
    if (process.env.OPENROUTER_MOCK === "1") {
      console.log("OpenRouter mock mode active");
      return [
        {
          question: "What does OpenRouter do?",
          choices: [
            "Routes models",
            "Drives cars",
            "Computes taxes",
            "Serves web pages",
          ],
          answerIndex: 0,
        },
        {
          question:
            "Can multiple providers be accessed at once via OpenRouter?",
          choices: ["No", "Yes", "Depends", "Never"],
          answerIndex: 1,
        },
      ];
    }

    const prompt = quizPrompt(input, itemCount);
    const content = await this.callOpenRouter(prompt);

    const raw = safeParseJSON<any[]>(content, []);

    // Minimal validation/sanitization
    const questions: QuizQuestionDTO[] = [];
    for (const item of raw) {
      const question =
        typeof item?.question === "string" ? item.question.trim() : "";
      const allChoices = Array.isArray(item?.choices)
        ? item.choices.filter((c: any) => typeof c === "string")
        : [];
      const choices = allChoices.slice(0, 4);
      const answerIndex =
        typeof item?.answerIndex === "number" ? item.answerIndex : -1;
      const withinBounds = answerIndex >= 0 && answerIndex < choices.length;
      if (question && choices.length === 4 && withinBounds) {
        questions.push({
          question,
          choices,
          answerIndex,
          sourceMetadata: item?.sourceMetadata || item?.source_metadata,
        });
      }
    }
    return questions;
  }
}
