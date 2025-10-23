// server/utils/llm/LLMFactory.ts
// import { GPT4oStrategy } from './GPT4oStrategy'
// import { ClaudeStrategy } from './ClaudeStrategy'
// import { MixtralStrategy } from './MixtralStrategy'

import type { LLMModel } from "~/shared/llm";

export const getLLMStrategy = (
  model: LLMModel,
  ctx?: { userId?: string; folderId?: string; feature?: string }
): LLMStrategy => {
  switch (model) {
    case "gpt-3.5":
      return new GPT35Strategy((m: LlmMeasured) => {
        logLlmUsage(m, {
          userId: ctx?.userId,
          folderId: ctx?.folderId,
          feature: ctx?.feature,
        });
      });
    case "gemini": // ← new
      return new GeminiStrategy((m: LlmMeasured) => {
        logLlmUsage(m, {
          userId: ctx?.userId,
          folderId: ctx?.folderId,
          feature: ctx?.feature,
        });
      });
    // case 'gpt-4o':
    //   return new GPT4oStrategy()
    // case 'claude':
    //   return new ClaudeStrategy()
    // case 'mixtral':
    //   return new MixtralStrategy()
    default: {
      // Exhaustive check for future model additions
      const _exhaustive: never = model as never;
      throw new Error(`Unsupported model: ${_exhaustive}`);
    }
  }
};
