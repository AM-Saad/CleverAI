// server/utils/llm/DeepSeekStrategy.ts
import { OpenAI } from "openai";
import { encoding_for_model } from "tiktoken";
import { Errors } from "../error";

// Small helper to avoid hard crashes on imperfect LLM JSON
function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * DeepSeek LLM Strategy
 * 
 * Uses OpenAI-compatible API with custom baseURL.
 * DeepSeek Chat (deepseek-chat) is optimized for general conversation and code.
 * 
 * Pricing (cache-miss):
 * - Input: $0.28 per 1M tokens
 * - Output: $0.42 per 1M tokens
 * 
 * @see https://api-docs.deepseek.com/
 */
export class DeepSeekStrategy implements LLMStrategy {
  private client: OpenAI;
  private modelId: string;
  private onMeasure?: (m: LlmMeasured) => void;

  constructor(modelId: string, onMeasure?: (m: LlmMeasured) => void) {
    const { deepseekKey } = useRuntimeConfig();
    if (!deepseekKey) {
      throw new Error("Missing DEEPSEEK_API_KEY in runtimeConfig");
    }
    // DeepSeek uses OpenAI-compatible API with custom baseURL
    this.client = new OpenAI({
      apiKey: deepseekKey,
      baseURL: "https://api.deepseek.com",
    });
    this.modelId = modelId;
    this.onMeasure = onMeasure;
  }

  async generateFlashcards(input: string, options?: LLMGenerationOptions): Promise<FlashcardDTO[]> {
    const itemCount = options?.itemCount ?? 5;

    // Dev mock mode: skip API and return deterministic JSON (no credits used)
    if (process.env.DEEPSEEK_MOCK === "1") {
      console.log("DeepSeek mock mode active");
      return [
        {
          front: "What is gravity?",
          back: "A force that pulls objects together.",
        },
        { front: "Who discovered gravity?", back: "Sir Isaac Newton." },
      ];
    }

    const prompt = flashcardPrompt(input, itemCount);
    const inputChars = input.length;
    let inputTokensEstimate = 0;
    try {
      // Use cl100k_base encoding (closest to DeepSeek tokenizer)
      const enc = encoding_for_model("gpt-4");
      inputTokensEstimate = enc.encode(prompt).length;
      enc.free();
    } catch { }

    let content = "[]";
    try {
      const res = await this.client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: "user", content: prompt }],
      });
      const promptTokens = Number(res.usage?.prompt_tokens ?? 0);
      const completionTokens = Number(res.usage?.completion_tokens ?? 0);
      const totalTokens = promptTokens + completionTokens;
      content = res.choices?.[0]?.message?.content?.trim() ?? "[]";
      let outputTokensEstimate = 0;
      try {
        const enc = encoding_for_model("gpt-4");
        outputTokensEstimate = enc.encode(
          typeof content === "string" ? content : ""
        ).length;
        enc.free();
      } catch { }
      const outputChars = typeof content === "string" ? content.length : 0;
      this.onMeasure?.({
        provider: "deepseek",
        model: this.modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        requestId: res.id,
        rawUsage: res.usage,
        meta: {
          inputChars,
          outputChars,
          inputTokensEstimate,
          outputTokensEstimate,
        },
      });
    } catch (error: any) {
      console.error("DeepSeek error", error.status, error.message);
      throw createError({
        statusCode: 502,
        statusMessage: `DeepSeek error: ${error.status} ${error.message}`,
      });
    }

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
          sourceMetadata: item?.sourceMetadata || item?.source_metadata
        });
      }
    }
    return cards;
  }

  async generateQuiz(input: string, options?: LLMGenerationOptions): Promise<QuizQuestionDTO[]> {
    const itemCount = options?.itemCount ?? 3;

    // Dev mock mode: skip API and return deterministic JSON (no credits used)
    if (process.env.DEEPSEEK_MOCK === "1") {
      console.log("DeepSeek mock mode active");
      return [
        {
          question: "What is gravity?",
          choices: ["A force", "A color", "A sound", "A smell"],
          answerIndex: 0,
        },
        {
          question: "Who formulated gravity laws?",
          choices: ["Einstein", "Newton", "Galileo", "Darwin"],
          answerIndex: 1,
        },
      ];
    }

    const prompt = quizPrompt(input, itemCount);
    const inputChars = input.length;
    let inputTokensEstimate = 0;
    try {
      const enc = encoding_for_model("gpt-4");
      inputTokensEstimate = enc.encode(prompt).length;
      enc.free();
    } catch { }

    let content = "[]";
    try {
      const res = await this.client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: "user", content: prompt }],
      });
      const promptTokens = Number(res.usage?.prompt_tokens ?? 0);
      const completionTokens = Number(res.usage?.completion_tokens ?? 0);
      const totalTokens = promptTokens + completionTokens;
      content = res.choices?.[0]?.message?.content?.trim() ?? "[]";
      let outputTokensEstimate = 0;
      try {
        const enc = encoding_for_model("gpt-4");
        outputTokensEstimate = enc.encode(
          typeof content === "string" ? content : ""
        ).length;
        enc.free();
      } catch { }
      const outputChars = typeof content === "string" ? content.length : 0;
      this.onMeasure?.({
        provider: "deepseek",
        model: this.modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        requestId: res.id,
        rawUsage: res.usage,
        meta: {
          inputChars,
          outputChars,
          inputTokensEstimate,
          outputTokensEstimate,
        },
      });
    } catch (error: any) {
      console.error("DeepSeek error", error.status, error.message);
      throw createError({
        statusCode: 502,
        statusMessage: `DeepSeek error: ${error.status} ${error.message}`,
      });
    }

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
          sourceMetadata: item?.sourceMetadata || item?.source_metadata
        });
      }
    }
    return questions;
  }
}
