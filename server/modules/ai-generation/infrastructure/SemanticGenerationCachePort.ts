import type {
  CachedGenerationTask,
  CachedGenerationValue,
  GenerationCachePort,
  SemanticCacheLookup,
} from "../ports/GenerationCachePort";

export class SemanticGenerationCachePort implements GenerationCachePort {
  async checkSemanticCache(input: {
    text: string;
    task: CachedGenerationTask;
    itemCount?: number;
  }): Promise<SemanticCacheLookup> {
    const { checkSemanticCache } = await import("../../../utils/llm/cache");
    const result = await checkSemanticCache(
      input.text,
      input.task,
      input.itemCount,
    );

    return {
      hit: result.hit,
      value: (result.value as CachedGenerationValue | null) ?? null,
    };
  }

  async setSemanticCache(input: {
    text: string;
    task: CachedGenerationTask;
    value: CachedGenerationValue;
    ttlSeconds?: number;
    itemCount?: number;
  }): Promise<void> {
    const { setSemanticCache } = await import("../../../utils/llm/cache");
    return setSemanticCache(
      input.text,
      input.task,
      input.value,
      input.ttlSeconds,
      input.itemCount,
    );
  }
}
