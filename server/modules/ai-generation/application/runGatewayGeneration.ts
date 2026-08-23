import type { H3Event } from "h3";
import { Errors } from "../../../utils/error";
import { computeAdaptiveItemCount } from "../../../utils/llm/adaptiveCount";
import {
  llmRequestPipeline,
  throwMappedOpenRouterError,
} from "../../../utils/llm/llmRequestPipeline";
import type { OpenRouterGeneration } from "../../../utils/llm/openRouter";
import { OpenRouterRequestError } from "../../../utils/llm/openRouter";
import { estimateTokensFromText } from "../../../utils/llm/tokenEstimate";
import { PrismaQuotaPort } from "../../subscription/infrastructure/PrismaQuotaPort";
import {
  quotaHeaders,
  toSubscriptionSnapshot,
} from "../../subscription/infrastructure/http/quotaHttp";
import type { QuotaPort } from "../../subscription/ports/QuotaPort";
import { prepareGatewayGeneration } from "./prepareGatewayGeneration";
import { saveGeneratedArtifacts } from "./saveGeneratedArtifacts";
import type {
  FlashcardDTO,
  GatewayGenerateRequest,
  GatewayGenerateResponse,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";

type GatewayUser = { id: string; [key: string]: any };
type GenerationResult = FlashcardDTO[] | QuizQuestionDTO[];

const defaultQuotaPort = new PrismaQuotaPort();

export interface RunGatewayGenerationInput {
  event: H3Event;
  prisma: any;
  user: GatewayUser;
  request: GatewayGenerateRequest;
  requestStartTime?: number;
  quotaPort?: QuotaPort;
}

export interface RunGatewayGenerationResult {
  response: GatewayGenerateResponse & Record<string, unknown>;
  headers: Record<string, string>;
}

export async function runGatewayGeneration(
  input: RunGatewayGenerationInput,
): Promise<RunGatewayGenerationResult> {
  const {
    event,
    prisma,
    user,
    request,
    requestStartTime = Date.now(),
    quotaPort = defaultQuotaPort,
  } = input;
  const {
    task,
    workspaceId,
    materialId,
    save,
    replace,
    text: originalText,
    generationConfig,
  } = request;

  const prepared = await prepareGatewayGeneration({
    prisma,
    userId: user.id,
    request: {
      task,
      workspaceId,
      materialId,
      save,
      replace,
      text: originalText,
      generationConfig,
    },
  });
  const { text, canSave, saveWorkspaceId, loadedMaterialType } = prepared;
  const effectiveWorkspaceId = saveWorkspaceId || workspaceId;
  const tokenEstimate = estimateTokensFromText(text);
  const depth = generationConfig?.depth ?? "balanced";
  const itemCount = computeAdaptiveItemCount(
    tokenEstimate,
    depth,
    generationConfig?.maxItems,
  );

  const ctx = await llmRequestPipeline(event, {
    quotaPort,
    task,
    inputText: text,
    checkQuota: true,
    incrementQuota: true,
    user,
  });

  let generation: OpenRouterGeneration<GenerationResult> | undefined;
  let savedCount: number | undefined;
  let deletedCount: number | undefined;
  let deletedReviewsCount: number | undefined;

  try {
    generation =
      task === "flashcards"
        ? await ctx.ai.generateFlashcards(text, itemCount)
        : await ctx.ai.generateQuiz(text, itemCount);

    if (canSave && effectiveWorkspaceId) {
      const saved = await saveGeneratedArtifacts({
        prisma,
        userId: user.id,
        task,
        workspaceId: effectiveWorkspaceId,
        materialId,
        replace,
        loadedMaterialType,
        result: generation.value,
      });
      savedCount = saved.savedCount;
      deletedCount = saved.deletedCount;
      deletedReviewsCount = saved.deletedReviewsCount;
    }

    const finalized = await ctx.finalize({
      generation,
      workspaceId: effectiveWorkspaceId,
    });
    const common = {
      savedCount,
      deletedCount,
      deletedReviewsCount,
      subscription: finalized.updatedQuota
        ? toSubscriptionSnapshot(finalized.updatedQuota)
        : undefined,
      requestId: ctx.requestId,
      selectedModelId: finalized.actualModel,
      provider: "openrouter",
      latencyMs: Date.now() - requestStartTime,
      cached: false,
      itemCount,
      tokenEstimate,
    };
    const response: GatewayGenerateResponse =
      task === "flashcards"
        ? {
            ...common,
            task: "flashcards",
            flashcards: generation.value as FlashcardDTO[],
          }
        : {
            ...common,
            task: "quiz",
            quiz: generation.value as QuizQuestionDTO[],
          };

    const headers: Record<string, string> = {
      "x-llm-save-requested": String(Boolean(save)),
      "x-llm-can-save": String(canSave),
      "x-llm-generated-count": String(generation.value.length),
      "x-llm-saved-count": String(savedCount ?? 0),
      "x-llm-task": task,
      "x-gateway-request-id": ctx.requestId,
      "x-gateway-model-id": finalized.actualModel,
      "x-gateway-provider": "openrouter",
      "x-gateway-latency-ms": String(finalized.totalLatencyMs),
    };
    if (finalized.updatedQuota) {
      Object.assign(headers, quotaHeaders(finalized.updatedQuota));
    }
    return { response, headers };
  } catch (error) {
    await ctx.fail(error, {
      workspaceId: effectiveWorkspaceId,
      generation,
    });
    if (error instanceof OpenRouterRequestError) {
      throwMappedOpenRouterError(error);
    }
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw Errors.server("Generation failed. Please try again.");
  }
}
