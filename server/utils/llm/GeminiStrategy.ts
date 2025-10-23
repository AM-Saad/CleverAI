// server/utils/llm/GeminiStrategy.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Small helper to avoid crashes on imperfect JSON
function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// Extract plain text from Gemini response
function firstText(resp: any): string {
  // SDK format: resp.candidates[0].content.parts = [{ text }]
  const t = resp?.candidates?.[0]?.content?.parts?.[0]?.text;
  return (typeof t === "string" ? t : "").trim();
}

// --- Robust JSON extraction helpers ---
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

export class GeminiStrategy implements LLMStrategy {
  private client: GoogleGenerativeAI;
  private static readonly MODEL = "gemini-2.0-flash-lite"; // adjust if you prefer 1.5-flash for speed/cost
  private onMeasure?: (m: LlmMeasured) => void;

  constructor(onMeasure?: (m: LlmMeasured) => void) {
    const { geminiKey } = useRuntimeConfig();
    if (!geminiKey) throw new Error("Missing GEMINI_API_KEY in runtimeConfig");
    this.client = new GoogleGenerativeAI(geminiKey);
    this.onMeasure = onMeasure;
  }

  private async chatOnce(prompt: string): Promise<string> {
    // Dev mock mode: skip API and return deterministic JSON (no credits used)
    if (process.env.GEMINI_MOCK === "1") {
      console.log("Gemini mock mode active");
      const p = (prompt || "").toLowerCase();
      if (
        p.includes("question") ||
        p.includes("choices") ||
        p.includes('"answerindex"')
      ) {
        // Quiz sample
        return JSON.stringify([
          {
            question: "What is gravity?",
            choices: ["A force", "A color"],
            answerIndex: 0,
          },
          {
            question: "Who formulated gravity laws?",
            choices: ["Einstein", "Newton"],
            answerIndex: 1,
          },
        ]);
      } else {
        // Flashcards sample
        return JSON.stringify([
          {
            front: "What is gravity?",
            back: "A force that pulls objects together.",
          },
          { front: "Who discovered gravity?", back: "Sir Isaac Newton." },
        ]);
      }
    }
    try {
      const inputChars = prompt.length;
      const model = this.client.getGenerativeModel({
        model: GeminiStrategy.MODEL,
      });
      let inputTokensEstimate = 0;
      try {
        const preCount = await (model as any).countTokens({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        inputTokensEstimate = Number((preCount as any)?.totalTokens ?? 0);
      } catch {}
      const resp = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const usage = (resp as any)?.response?.usageMetadata;
      const promptTokens = Number(usage?.promptTokenCount ?? 0);
      const completionTokens = Number(usage?.candidatesTokenCount ?? 0);
      const totalTokens = Number(
        usage?.totalTokenCount ?? promptTokens + completionTokens
      );
      const txt = resp?.response?.text?.();
      const outputChars = typeof txt === "string" ? txt.length : 0;
      let outputTokensEstimate = 0;
      try {
        const postCount = await (model as any).countTokens({
          contents: [
            {
              role: "model",
              parts: [{ text: typeof txt === "string" ? txt : "" }],
            },
          ],
        });
        outputTokensEstimate = Number((postCount as any)?.totalTokens ?? 0);
      } catch {}
      this.onMeasure?.({
        provider: "google",
        model: GeminiStrategy.MODEL,
        promptTokens,
        completionTokens,
        totalTokens,
        requestId: undefined,
        rawUsage: usage,
        meta: {
          inputChars,
          outputChars,
          inputTokensEstimate,
          outputTokensEstimate,
        },
      });
      return typeof txt === "string" ? txt.trim() : firstText(resp.response);
    } catch (e: any) {
      console.error("Gemini error", e.status, e.message);
      throw createError({
        statusCode: 502,
        statusMessage: `Gemini error: ${e.status} ${e.message}`,
      });
    }
  }

  async generateFlashcards(input: string): Promise<FlashcardDTO[]> {
    if (process.env.GEMINI_MOCK === "1") {
      return [
        {
          front: "What is gravity?",
          back: "A force that pulls objects together.",
        },
        { front: "Who discovered gravity?", back: "Sir Isaac Newton." },
      ];
    }
    const prompt = flashcardPrompt(input); // expects JSON array [{ front, back }]
    const text = await this.chatOnce(prompt);
    const candidate = extractJsonArrayOrObject(text);
    const raw = safeParseJSON<any[]>(candidate, []);
    if (process.env.NODE_ENV === "development" && (!raw || raw.length === 0)) {
      console.info("[Gemini debug] rawText(200)=", String(text).slice(0, 200));
      console.info(
        "[Gemini debug] candidate(200)=",
        String(candidate).slice(0, 200)
      );
    }
    const cards: FlashcardDTO[] = [];
    for (const item of raw) {
      const front = typeof item?.front === "string" ? item.front.trim() : "";
      const back = typeof item?.back === "string" ? item.back.trim() : "";
      if (front && back) cards.push({ front, back });
    }
    return cards;
  }

  async generateQuiz(input: string): Promise<QuizQuestionDTO[]> {
    if (process.env.GEMINI_MOCK === "1") {
      return [
        {
          question: "What is gravity?",
          choices: ["A force", "A color"],
          answerIndex: 0,
        },
        {
          question: "Who formulated gravity laws?",
          choices: ["Einstein", "Newton"],
          answerIndex: 1,
        },
      ];
    }
    const prompt = quizPrompt(input); // expects JSON array [{ question, choices[], answerIndex }]
    const text = await this.chatOnce(prompt);
    const candidate = extractJsonArrayOrObject(text);
    const raw = safeParseJSON<any[]>(candidate, []);
    if (process.env.NODE_ENV === "development" && (!raw || raw.length === 0)) {
      console.info("[Gemini debug] rawText(200)=", String(text).slice(0, 200));
      console.info(
        "[Gemini debug] candidate(200)=",
        String(candidate).slice(0, 200)
      );
    }
    const questions: QuizQuestionDTO[] = [];
    for (const item of raw) {
      const question =
        typeof item?.question === "string" ? item.question.trim() : "";
      const choices = Array.isArray(item?.choices)
        ? item.choices.filter((c: any) => typeof c === "string")
        : [];
      const answerIndex =
        typeof item?.answerIndex === "number" ? item.answerIndex : -1;
      const withinBounds = answerIndex >= 0 && answerIndex < choices.length;
      if (question && choices.length >= 2 && withinBounds) {
        questions.push({ question, choices, answerIndex });
      }
    }
    return questions;
  }
}
