// server/utils/llm/LLMFactory.ts
// import { GPT4oStrategy } from './GPT4oStrategy'
// import { ClaudeStrategy } from './ClaudeStrategy'
// import { MixtralStrategy } from './MixtralStrategy'

import { Errors } from '../error'
import type { LLMModel } from "#shared/utils/llm";
import type { LlmModelRegistry } from '@prisma/client'
import { prisma } from '../prisma'

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
      throw Errors.badRequest(`Unsupported model: ${_exhaustive}`);
    }
  }
};

/**
 * Get LLM strategy from model registry
 * Used by gateway to dynamically select and instantiate the correct strategy
 * 
 * @param modelId - The model ID from LlmModelRegistry (e.g., 'gpt-4o-mini', 'gemini-flash-8b')
 * @param ctx - Context for usage logging (userId, folderId, feature)
 * @returns LLM strategy instance with measurement callback
 * @throws Error if model not found or provider unsupported
 */
export async function getLLMStrategyFromRegistry(
  modelId: string,
  ctx?: { userId?: string; folderId?: string; feature?: string }
): Promise<LLMStrategy> {
  // Fetch model from registry
  const model = await prisma.llmModelRegistry.findUnique({
    where: { modelId }
  })
  
  if (!model) {
    throw Errors.notFound(`Model ${modelId}`)
  }
  
  if (!model.enabled) {
    throw Errors.badRequest(`Model is disabled: ${modelId}`)
  }
  
  if (model.healthStatus === 'down') {
    throw Errors.server(`Model is currently down: ${modelId}`)
  }
  
  // Map provider to strategy class
  // Provider is normalized to lowercase in registry (e.g., 'openai', 'google')
  const provider = model.provider.toLowerCase()
  
  switch (provider) {
    case 'openai':
      // All OpenAI models use GPT35Strategy (gpt-3.5-turbo, gpt-4o-mini, gpt-4o)
      return new GPT35Strategy((m: LlmMeasured) => {
        logLlmUsage(m, {
          userId: ctx?.userId,
          folderId: ctx?.folderId,
          feature: ctx?.feature,
        });
      });
      
    case 'google':
      // All Google models use GeminiStrategy (gemini-1.5-flash-8b, gemini-2.0-flash-exp)
      return new GeminiStrategy((m: LlmMeasured) => {
        logLlmUsage(m, {
          userId: ctx?.userId,
          folderId: ctx?.folderId,
          feature: ctx?.feature,
        });
      });
      
    // case 'anthropic':
    //   return new ClaudeStrategy((m: LlmMeasured) => {
    //     logLlmUsage(m, {
    //       userId: ctx?.userId,
    //       folderId: ctx?.folderId,
    //       feature: ctx?.feature,
    //     });
    //   });
      
    // case 'mistral':
    //   return new MixtralStrategy((m: LlmMeasured) => {
    //     logLlmUsage(m, {
    //       userId: ctx?.userId,
    //       folderId: ctx?.folderId,
    //       feature: ctx?.feature,
    //     });
    //   });
      
    default:
      throw Errors.badRequest(`Unsupported provider: ${provider} for model ${modelId}`)
  }
}
