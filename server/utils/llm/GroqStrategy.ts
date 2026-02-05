// server/utils/llm/GroqStrategy.ts
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

// --- Robust JSON extraction helpers (handle markdown code fences) ---
function stripCodeFences(s: string): string {
  if (!s) return "";
  // Unwrap ```json ... ``` or generic ``` ... ``` blocks
  return s.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (_m, p1) =>
    String(p1).trim()
  );
}

function findBalancedSlice(
  text: string,
  open: string,
  close: string
): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inStr: string | null = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : "";
    // track string literals to avoid counting brackets inside strings
    if ((ch === '"' || ch === "'") && prev !== "\\") {
      if (inStr === ch) inStr = null;
      else if (!inStr) inStr = ch;
    }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractJsonArrayOrObject(s: string): string {
  const cleaned = stripCodeFences(s);
  // Prefer array first
  const arr = findBalancedSlice(cleaned, "[", "]");
  if (arr) return arr;
  // Fallback to object, wrap in array
  const obj = findBalancedSlice(cleaned, "{", "}");
  if (obj) return `[${obj}]`;
  // Last resort: return the cleaned text (let safeParseJSON handle failure)
  return cleaned;
}

/**
 * Groq LLM Strategy
 * 
 * Uses OpenAI-compatible API with Groq's baseURL.
 * Groq provides fast inference for open-source models like LLaMA.
 * 
 * Default model: llama-3.1-8b-instant (fast, cost-effective)
 * 
 * Pricing (per 1M tokens):
 * - llama-3.1-8b-instant: Input $0.05, Output $0.08
 * - qwen-qwq-32b: Input $0.075, Output $0.30
 * - llama-4-scout-17b: Input $0.11, Output $0.34
 * - llama-4-maverick-17b: Input $0.20, Output $0.60
 * 
 * @see https://console.groq.com/docs/api-reference
 */
export class GroqStrategy implements LLMStrategy {
  private client: OpenAI;
  private modelId: string;
  private onMeasure?: (m: LlmMeasured) => void;

  constructor(modelId: string, onMeasure?: (m: LlmMeasured) => void) {
    const { groqKey } = useRuntimeConfig();
    if (!groqKey) {
      throw new Error("Missing GROQ_API_KEY in runtimeConfig");
    }
    // Groq uses OpenAI-compatible API with custom baseURL
    this.client = new OpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.modelId = modelId;
    this.onMeasure = onMeasure;
  }

  async generateFlashcards(input: string, options?: LLMGenerationOptions): Promise<FlashcardDTO[]> {
    const itemCount = options?.itemCount ?? 5;

    // Dev mock mode: skip API and return deterministic JSON (no credits used)
    if (process.env.GROQ_MOCK === "1") {
      console.log("Groq mock mode active");
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
      // Use cl100k_base encoding (closest to LLaMA tokenizer)
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
        provider: "groq",
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
      console.error("Groq error", error.status, error.message);
      throw createError({
        statusCode: 502,
        statusMessage: `Groq error: ${error.status} ${error.message}`,
      });
    }

    // Extract JSON from potential markdown/code fences
    const candidate = extractJsonArrayOrObject(content);
    const raw = safeParseJSON<any[]>(candidate, []);

    if (process.env.NODE_ENV === "development" && (!raw || raw.length === 0)) {
      console.info("[Groq debug] rawText(200)=", String(content).slice(0, 200));
      console.info("[Groq debug] candidate(200)=", String(candidate).slice(0, 200));
    }

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
    if (process.env.GROQ_MOCK === "1") {
      console.log("Groq mock mode active");
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
        provider: "groq",
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
      console.error("Groq error", error.status, error.message);
      throw createError({
        statusCode: 502,
        statusMessage: `Groq error: ${error.status} ${error.message}`,
      });
    }

    // Extract JSON from potential markdown/code fences
    const candidate = extractJsonArrayOrObject(content);
    const raw = safeParseJSON<any[]>(candidate, []);

    if (process.env.NODE_ENV === "development" && (!raw || raw.length === 0)) {
      console.info("[Groq debug] rawText(200)=", String(content).slice(0, 200));
      console.info("[Groq debug] candidate(200)=", String(candidate).slice(0, 200));
    }

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
