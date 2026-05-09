import type { H3Event } from "h3";
import { Errors } from "../../../utils/error";
import { computeAdaptiveItemCount } from "../../../utils/llm/adaptiveCount";
import type { LlmPipelineContext } from "../../../utils/llm/llmRequestPipeline";
import { PrismaQuotaPort } from "../../subscription/infrastructure/PrismaQuotaPort";
import { quotaHeaders } from "../../subscription/infrastructure/http/quotaHttp";
import type { QuotaPort } from "../../subscription/ports/QuotaPort";
import { SemanticGenerationCachePort } from "../infrastructure/SemanticGenerationCachePort";
import type { GenerationCachePort } from "../ports/GenerationCachePort";
import {
  completeGatewayCacheHit,
  completeGatewayGeneration,
} from "./completeGatewayGeneration";
import {
  publishGenerationRequested,
  publishGenerationSucceeded,
} from "./generationEvents";
import { prepareGatewayGeneration } from "./prepareGatewayGeneration";
import type {
  FlashcardDTO,
  GatewayGenerateRequest,
  GatewayGenerateResponse,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";

type GatewayUser = { id: string; [key: string]: any };
type GenerationTask = "flashcards" | "quiz";

const defaultQuotaPort = new PrismaQuotaPort();
const defaultGenerationCachePort = new SemanticGenerationCachePort();

export interface RunGatewayGenerationInput {
  event: H3Event;
  prisma: any;
  user: GatewayUser;
  request: GatewayGenerateRequest;
  requestStartTime?: number;
  quotaPort?: QuotaPort;
  cachePort?: GenerationCachePort;
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
    cachePort = defaultGenerationCachePort,
  } = input;

  const {
    task,
    workspaceId,
    materialId,
    save,
    replace,
    requiredCapability,
    text: originalText,
    generationConfig,
  } = request;

  const generationInput = await prepareGatewayGeneration({
    prisma,
    userId: user.id,
    request: {
      task,
      workspaceId,
      materialId,
      save,
      replace,
      requiredCapability,
      text: originalText,
      generationConfig,
    },
  });
  const { text, canSave, saveWorkspaceId, loadedMaterialType } =
    generationInput;

  const tokenEstimate = estimateTokensFromText(text);
  const depth = generationConfig?.depth ?? "balanced";
  const maxItems = generationConfig?.maxItems;
  const itemCount = computeAdaptiveItemCount(tokenEstimate, depth, maxItems);

  console.info("[llm.gateway] Adaptive generation:", {
    tokenEstimate,
    depth,
    itemCount,
    textLength: text.length,
  });

  const { llmRequestPipeline } = await import(
    "../../../utils/llm/llmRequestPipeline"
  );
  const ctx: LlmPipelineContext = await llmRequestPipeline(event, {
    quotaPort,
    task,
    inputText: text,
    estimatedOutputTokens: task === "flashcards" ? 500 : 800,
    requiredCapability,
    checkQuota: true,
    incrementQuota: true,
    user,
  });

  await publishGenerationRequested({
    userId: user.id,
    requestId: ctx.requestId,
    task,
    materialId,
    workspaceId,
    tokenEstimate,
    itemCount,
  });

  const cacheCheck = await cachePort.checkSemanticCache({
    text,
    task,
    itemCount,
  });

  if (cacheCheck.hit && cacheCheck.value) {
    console.info("[llm.gateway] Cache hit:", {
      requestId: ctx.requestId,
      task,
      textLength: text.length,
    });

    const cacheHitResult = await completeGatewayCacheHit({
      quotaPort,
      userId: ctx.user.id,
      requestId: ctx.requestId,
      task,
      cachedValue: cacheCheck.value,
      itemCount,
      tokenEstimate,
      requestStartTime,
    });

    const headers: Record<string, string> = {};
    const response = cacheHitResult.response;

    headers["x-gateway-request-id"] = String(response.requestId);
    headers["x-gateway-model-id"] = String(response.selectedModelId);
    headers["x-gateway-provider"] = String(response.provider);
    headers["x-gateway-latency-ms"] = String(response.latencyMs);
    headers["x-llm-task"] = String(response.task);
    headers["x-llm-save-requested"] = String(!!save);
    headers["x-llm-can-save"] = String(canSave);
    const generatedCount =
      response.task === "flashcards"
        ? response.flashcards.length
        : response.quiz.length;
    headers["x-llm-generated-count"] = String(generatedCount);
    headers["x-llm-saved-count"] = "0";
    Object.assign(headers, quotaHeaders(cacheHitResult.updatedQuota));

    return { response, headers };
  }

  const effectiveWorkspaceId = saveWorkspaceId || workspaceId;
  let result: FlashcardDTO[] | QuizQuestionDTO[];

  try {
    if (task === "flashcards") {
      result = await ctx.strategy.generateFlashcards(text, { itemCount });
    } else {
      result = await ctx.strategy.generateQuiz(text, { itemCount });
    }

    console.info("[llm.gateway] Generation successful:", {
      requestId: ctx.requestId,
      modelId: ctx.selectedModel.modelId,
      task,
      count: result.length,
    });

    await publishGenerationSucceeded({
      userId: user.id,
      requestId: ctx.requestId,
      task,
      generatedCount: result.length,
      modelId: ctx.selectedModel.modelId,
    });
  } catch (err) {
    await ctx.fail(err, effectiveWorkspaceId);
    console.error("[llm.gateway] Generation failed:", {
      requestId: ctx.requestId,
      modelId: ctx.selectedModel.modelId,
      task,
      error: err,
    });
    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan/billing or try again later."
        : "Generation failed. Please try again.";
    if (/quota exceeded|rate limit|429/i.test(message)) {
      throw Errors.rateLimit(message);
    }
    throw Errors.server(message);
  }

  const completion = await completeGatewayGeneration({
    prisma,
    ctx,
    cachePort,
    task,
    text,
    result,
    canSave,
    workspaceId: effectiveWorkspaceId,
    materialId,
    replace,
    loadedMaterialType,
    depth,
    itemCount,
    tokenEstimate,
  });
  const { response, finalizeResult, savedCount, deletedCount, deletedReviewsCount } =
    completion;
  const { updatedQuota, totalLatencyMs } = finalizeResult;

  const headers: Record<string, string> = {
    "x-llm-save-requested": String(!!save),
    "x-llm-can-save": String(canSave),
    "x-llm-generated-count": String(result.length),
    "x-llm-saved-count": String(savedCount ?? 0),
    "x-llm-task": task,
    "x-gateway-request-id": ctx.requestId,
    "x-gateway-model-id": ctx.selectedModel.modelId,
    "x-gateway-provider": ctx.selectedModel.provider,
    "x-gateway-latency-ms": String(totalLatencyMs),
  };

  if (updatedQuota) {
    Object.assign(headers, quotaHeaders(updatedQuota));
  }

  console.info("[llm.gateway] Request completed", {
    requestId: ctx.requestId,
    modelId: ctx.selectedModel.modelId,
    task,
    generatedCount: result.length,
    savedCount,
    deletedCount,
    deletedReviewsCount,
    materialId,
    latencyMs: totalLatencyMs,
    subscription: updatedQuota,
  });

  return {
    response,
    headers,
  };
}
