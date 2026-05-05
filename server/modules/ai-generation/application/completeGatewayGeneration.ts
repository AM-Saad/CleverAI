import type {
  LlmFinalizeResult,
  LlmPipelineContext,
} from "../../../utils/llm/llmRequestPipeline";
import type {
  FlashcardDTO,
  GatewayGenerateResponse,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";
import { toSubscriptionSnapshot } from "../../subscription/infrastructure/http/quotaHttp";
import type { QuotaPort } from "../../subscription/ports/QuotaPort";
import type {
  CachedGenerationValue,
  GenerationCachePort,
} from "../ports/GenerationCachePort";
import {
  publishGenerationQuotaConsumed,
  publishGenerationSaved,
} from "./generationEvents";
import { saveGeneratedArtifacts } from "./saveGeneratedArtifacts";

type GatewayTask = "flashcards" | "quiz";
type GatewayResult = FlashcardDTO[] | QuizQuestionDTO[];

type CachedGatewayPayload = {
  task: GatewayTask;
  flashcards?: FlashcardDTO[];
  quiz?: QuizQuestionDTO[];
  modelId: string;
  provider: string;
};

export interface CompleteGatewayCacheHitInput {
  quotaPort: QuotaPort;
  userId: string;
  requestId: string;
  task: GatewayTask;
  cachedValue: CachedGatewayPayload;
  itemCount: number;
  tokenEstimate: number;
  requestStartTime: number;
}

export interface CompleteGatewayCacheHitResult {
  response: GatewayGenerateResponse & Record<string, unknown>;
  updatedQuota: Awaited<ReturnType<QuotaPort["consumeGeneration"]>>;
}

export async function completeGatewayCacheHit(
  input: CompleteGatewayCacheHitInput,
): Promise<CompleteGatewayCacheHitResult> {
  const {
    quotaPort,
    userId,
    requestId,
    task,
    cachedValue,
    itemCount,
    tokenEstimate,
    requestStartTime,
  } = input;

  const updatedQuota = await quotaPort.consumeGeneration(userId);
  await publishGenerationQuotaConsumed({
    userId,
    requestId,
    task,
    cached: true,
    creditSpent: updatedQuota.creditSpent,
    remaining: updatedQuota.remaining,
  });

  const commonResponse = {
    savedCount: undefined,
    subscription: toSubscriptionSnapshot(updatedQuota),
    requestId,
    selectedModelId: cachedValue.modelId,
    provider: cachedValue.provider,
    latencyMs: Date.now() - requestStartTime,
    cached: true,
    itemCount,
    tokenEstimate,
    modelId: cachedValue.modelId,
  };

  const response =
    task === "flashcards"
      ? ({
          ...commonResponse,
          task: "flashcards" as const,
          flashcards: cachedValue.flashcards ?? [],
        } satisfies GatewayGenerateResponse & Record<string, unknown>)
      : ({
          ...commonResponse,
          task: "quiz" as const,
          quiz: cachedValue.quiz ?? [],
        } satisfies GatewayGenerateResponse & Record<string, unknown>);

  return {
    response,
    updatedQuota,
  };
}

export interface CompleteGatewayGenerationInput {
  prisma: any;
  ctx: LlmPipelineContext;
  cachePort: GenerationCachePort;
  task: GatewayTask;
  text: string;
  result: GatewayResult;
  canSave: boolean;
  workspaceId?: string;
  materialId?: string;
  replace?: boolean;
  loadedMaterialType?: string | null;
  depth: "quick" | "balanced" | "deep";
  itemCount: number;
  tokenEstimate: number;
}

export interface CompleteGatewayGenerationResult {
  response: GatewayGenerateResponse;
  finalizeResult: LlmFinalizeResult;
  savedCount: number | undefined;
  deletedCount: number | undefined;
  deletedReviewsCount: number | undefined;
}

export async function completeGatewayGeneration(
  input: CompleteGatewayGenerationInput,
): Promise<CompleteGatewayGenerationResult> {
  const {
    prisma,
    ctx,
    cachePort,
    task,
    text,
    result,
    canSave,
    workspaceId,
    materialId,
    replace,
    loadedMaterialType,
    depth,
    itemCount,
    tokenEstimate,
  } = input;

  let savedCount: number | undefined;
  let deletedCount: number | undefined;
  let deletedReviewsCount: number | undefined;

  if (canSave && workspaceId) {
    try {
      const saveResult = await saveGeneratedArtifacts({
        prisma,
        task,
        workspaceId,
        materialId,
        replace,
        loadedMaterialType,
        result,
      });
      savedCount = saveResult.savedCount;
      deletedCount = saveResult.deletedCount;
      deletedReviewsCount = saveResult.deletedReviewsCount;
    } catch (error) {
      console.error("[llm.gateway] Failed to save to database:", {
        requestId: ctx.requestId,
        workspaceId,
        materialId,
        task,
        error,
      });
    }
  }

  if (savedCount !== undefined) {
    await publishGenerationSaved({
      userId: ctx.user.id,
      requestId: ctx.requestId,
      task,
      workspaceId,
      materialId,
      savedCount,
      deletedCount,
      deletedReviewsCount,
    });
  }

  const cachedValue: CachedGenerationValue =
    task === "flashcards"
      ? {
          task: "flashcards",
          flashcards: result as FlashcardDTO[],
          modelId: ctx.selectedModel.modelId,
          provider: ctx.selectedModel.provider,
        }
      : {
          task: "quiz",
          quiz: result as QuizQuestionDTO[],
          modelId: ctx.selectedModel.modelId,
          provider: ctx.selectedModel.provider,
        };

  await cachePort.setSemanticCache({
    text,
    task,
    value: cachedValue,
    ttlSeconds: 7 * 24 * 60 * 60,
    itemCount,
  });

  const finalizeResult = await ctx.finalize({
    outputText: JSON.stringify(result),
    workspaceId,
    depth,
    itemCount,
  });

  const commonResponse = {
    savedCount,
    deletedCount,
    deletedReviewsCount,
    subscription: finalizeResult.updatedQuota
      ? toSubscriptionSnapshot(finalizeResult.updatedQuota)
      : undefined,
    requestId: ctx.requestId,
    selectedModelId: ctx.selectedModel.modelId,
    provider: ctx.selectedModel.provider,
    latencyMs: finalizeResult.totalLatencyMs,
    cached: false,
    itemCount,
    tokenEstimate,
  };

  const response =
    task === "flashcards"
      ? ({
          ...commonResponse,
          task: "flashcards" as const,
          flashcards: result as FlashcardDTO[],
        } satisfies GatewayGenerateResponse)
      : ({
          ...commonResponse,
          task: "quiz" as const,
          quiz: result as QuizQuestionDTO[],
        } satisfies GatewayGenerateResponse);

  return {
    response,
    finalizeResult,
    savedCount,
    deletedCount,
    deletedReviewsCount,
  };
}
