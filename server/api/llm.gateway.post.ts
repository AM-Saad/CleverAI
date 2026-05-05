import { readBody } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  type FlashcardDTO,
  GatewayGenerateRequest,
  type QuizQuestionDTO,
} from "~/shared/utils/llm-generate.contract";
import { computeAdaptiveItemCount } from "@server/utils/llm/adaptiveCount";
import { llmRequestPipeline } from "@server/utils/llm/llmRequestPipeline";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import { SemanticGenerationCachePort } from "@server/modules/ai-generation/infrastructure/SemanticGenerationCachePort";
import {
  completeGatewayCacheHit,
  completeGatewayGeneration,
} from "@server/modules/ai-generation/application/completeGatewayGeneration";
import { prepareGatewayGeneration } from "@server/modules/ai-generation/application/prepareGatewayGeneration";
import {
  setQuotaHeaders,
} from "@server/modules/subscription/infrastructure/http/quotaHttp";
import {
  publishGenerationRequested,
  publishGenerationSucceeded,
} from "@server/modules/ai-generation/application/generationEvents";

const quotaPort = new PrismaQuotaPort();
const generationCachePort = new SemanticGenerationCachePort();

type GenerationTask = "flashcards" | "quiz";

export default defineEventHandler(async (event) => {
  const requestStartTime = Date.now();
  const prisma = event.context.prisma;

  // ─── 1. Auth ───────────────────────────────────────────────────────────
  // Auth early so material ownership checks have the user object.
  // The pipeline receives the pre-fetched user to skip a redundant DB call.
  const user = await requireRole(event, ["USER"]);

  // ─── 2. Request Parsing ────────────────────────────────────────────────
  const raw = await readBody(event);
  const parseResult = GatewayGenerateRequest.safeParse(raw);
  if (!parseResult.success) {
    throw Errors.badRequest(
      "Invalid request body",
      parseResult.error.flatten()
    );
  }
  const parsed = parseResult.data;
  const {
    task,
    workspaceId,
    materialId,
    save,
    replace,
    requiredCapability,
    text: originalText,
    generationConfig,
  } = parsed;
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
  const {
    text,
    canSave,
    saveWorkspaceId,
    loadedMaterialType,
  } = generationInput;

  // ─── 5. Adaptive Item Count ────────────────────────────────────────────
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

  // ─── 6. Pipeline: auth + quota gate + rate-limit + model + strategy ────
  // Handles: quota enforcement, rate limiting, model selection + dev override,
  // strategy instantiation with onMeasure token capture, finalize/fail hooks.
  const ctx = await llmRequestPipeline(event, {
    quotaPort,
    task,
    inputText: text,
    estimatedOutputTokens: task === "flashcards" ? 500 : 800,
    requiredCapability,
    checkQuota: true,
    incrementQuota: true,
    user, // pre-fetched above — pipeline skips redundant requireRole call
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

  // ─── 7. Semantic Cache Check ───────────────────────────────────────────
  const cacheCheck = await generationCachePort.checkSemanticCache({
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

    // Refresh subscription headers with post-increment values.
    setQuotaHeaders(event, cacheHitResult.updatedQuota);

    return success(cacheHitResult.response);
  }

  // ─── 8. Generation ─────────────────────────────────────────────────────
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
    cachePort: generationCachePort,
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

  // ─── 12. Response Headers ───────────────────────────────────────────────
  event.node.res.setHeader("x-llm-save-requested", String(!!save));
  event.node.res.setHeader("x-llm-can-save", String(canSave));
  event.node.res.setHeader("x-llm-generated-count", String(result.length));
  event.node.res.setHeader("x-llm-saved-count", String(savedCount ?? 0));
  event.node.res.setHeader("x-llm-task", task);
  event.node.res.setHeader("x-gateway-request-id", ctx.requestId);
  event.node.res.setHeader("x-gateway-model-id", ctx.selectedModel.modelId);
  event.node.res.setHeader("x-gateway-provider", ctx.selectedModel.provider);
  event.node.res.setHeader("x-gateway-latency-ms", String(totalLatencyMs));
  // Re-write subscription headers with post-increment values from finalize().
  if (updatedQuota) {
    setQuotaHeaders(event, updatedQuota);
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

  return success(response);
});
