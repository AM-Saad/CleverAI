// shared/llm.ts
import { z } from "zod";

export const LLM_MODELS = [
  "gpt-3.5",
  "gpt-4o",
  "claude",
  "mixtral",
  "gemini",
  "deepseek",
  "groq",
] as const;
export type LLMModel = (typeof LLM_MODELS)[number];
export const LLMEnum = z.enum(LLM_MODELS);
