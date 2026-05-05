import type {
  FlashcardDTO,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";

export type CachedGenerationTask = "flashcards" | "quiz";

export interface CachedGenerationValue {
  task: CachedGenerationTask;
  flashcards?: FlashcardDTO[];
  quiz?: QuizQuestionDTO[];
  modelId: string;
  provider: string;
}

export interface SemanticCacheLookup {
  hit: boolean;
  value: CachedGenerationValue | null;
}

export interface GenerationCachePort {
  checkSemanticCache(input: {
    text: string;
    task: CachedGenerationTask;
    itemCount?: number;
  }): Promise<SemanticCacheLookup>;
  setSemanticCache(input: {
    text: string;
    task: CachedGenerationTask;
    value: CachedGenerationValue;
    ttlSeconds?: number;
    itemCount?: number;
  }): Promise<void>;
}
