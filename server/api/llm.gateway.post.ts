import { defineEventHandler, readBody } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { GatewayGenerateRequest } from "~/shared/utils/llm-generate.contract";
import { selectBestModel } from "@server/utils/llm/routing";
import { getLLMStrategyFromRegistry } from "@server/utils/llm/LLMFactory";
import {
  checkSemanticCache,
  setSemanticCache,
  generateCacheKey,
} from "@server/utils/llm/cache";
import {
  logGatewayRequest,
  logGatewayFailure,
} from "@server/utils/llm/gatewayLogger";
import { updateModelLatency } from "@server/utils/llm/modelRegistry";
import { randomUUID } from "crypto";
import {
  computeAdaptiveItemCount,
} from "@server/utils/llm/adaptiveCount";
import {
  injectNoteBlockMarkers,
  injectPdfPageMarkers,
  extractSourceRef,
} from "@server/utils/contextBridge";

type GenerationTask = "flashcards" | "quiz";

interface Flashcard {
  front: string;
  back: string;
  sourceMetadata?: {
    anchor: string;
    contextSnippet?: string;
  };
}
interface QuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  sourceMetadata?: {
    anchor: string;
    contextSnippet?: string;
  };
}

// Minimal in-memory rate limiting: 5 requests per minute per user
const rateLimitMap: MemCounter = new Map();
const ipRateLimitMap: MemCounter = new Map();

export default defineEventHandler(async (event) => {
  const requestId = randomUUID();
  const requestStartTime = Date.now();

  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  // ==========================================
  // Quota Check
  // ==========================================
  const quotaCheck = await checkUserQuota(user.id);
  if (!quotaCheck.canGenerate) {
    event.node.res.setHeader("x-quota-exceeded", "true");
    event.node.res.setHeader(
      "x-subscription-tier",
      quotaCheck.subscription.tier
    );
    event.node.res.setHeader(
      "x-generations-used",
      String(quotaCheck.subscription.generationsUsed)
    );
    event.node.res.setHeader(
      "x-generations-quota",
      String(quotaCheck.subscription.generationsQuota)
    );
    event.node.res.setHeader(
      "x-generations-remaining",
      String(quotaCheck.subscription.remaining)
    );
    throw Errors.badRequest(
      "Free tier quota exceeded. Please upgrade to continue generating content.",
      {
        subscription: quotaCheck.subscription,
        type: "QUOTA_EXCEEDED",
      }
    );
  }

  // ==========================================
  // Rate Limiting
  // ==========================================
  const now = Date.now();
  const windowMs = 60 * 1000;
  const userRemaining = await applyLimit(
    `rl:user:${user.id}`,
    5,
    rateLimitMap,
    now,
    windowMs
  );
  const clientIp = getClientIp(event);
  const ipRemaining = await applyLimit(
    `rl:ip:${clientIp}`,
    20,
    ipRateLimitMap,
    now,
    windowMs
  );
  const overallRemaining = Math.min(userRemaining, ipRemaining);

  event.node.res.setHeader("x-subscription-tier", quotaCheck.subscription.tier);
  event.node.res.setHeader(
    "x-generations-used",
    String(quotaCheck.subscription.generationsUsed)
  );
  event.node.res.setHeader(
    "x-generations-quota",
    String(quotaCheck.subscription.generationsQuota)
  );
  event.node.res.setHeader(
    "x-generations-remaining",
    String(quotaCheck.subscription.remaining)
  );
  setRateLimitHeaders(event, overallRemaining, userRemaining, ipRemaining, now);

  // ==========================================
  // Request Validation
  // ==========================================
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
    folderId,
    materialId,
    save,
    replace,
    preferredModelId,
    requiredCapability,
    text: originalText,
    generationConfig,
  } = parsed;

  // Load material content if materialId provided
  let text = originalText?.trim() || "";
  let loadedMaterial: any = null;

  if (materialId) {
    loadedMaterial = await prisma.material.findUnique({
      where: { id: materialId },
      include: { folder: { select: { userId: true, id: true } } },
    });

    if (!loadedMaterial) {
      throw Errors.notFound("Material not found.");
    }
    if (loadedMaterial.folder.userId !== user.id) {
      throw Errors.forbidden("You do not have access to this material.");
    }

    text = loadedMaterial.content || "";

    // Inject markers for Context Bridge based on material type
    if (loadedMaterial.type === "pdf" && loadedMaterial.metadata) {
      const pageCount = (loadedMaterial.metadata as any)?.pageCount;
      text = injectPdfPageMarkers(text, pageCount);
    } else if (loadedMaterial.type === "txt" || !loadedMaterial.type) {
      // Treat as note-like content
      text = injectNoteBlockMarkers(text);
    }
  }

  const MAX_CHARS = 100_000;
  if (text.length === 0) throw Errors.badRequest("Text is required");
  if (text.length > MAX_CHARS) throw Errors.badRequest("Text too large");

  // ==========================================
  // Folder/Material Permission Check
  // ==========================================
  let canSave = false;
  let materialFolderId: string | undefined;

  // If materialId is provided, verify ownership (already done above)
  if (save && loadedMaterial) {
    canSave = true;
    materialFolderId = loadedMaterial.folder.id;
  } else if (save && materialId) {
    const material = await prisma.material.findFirst({
      where: { id: materialId },
      include: { folder: { select: { userId: true, id: true } } },
    });
    if (!material) {
      throw Errors.notFound("Material not found.");
    }
    if (material.folder.userId !== user.id) {
      throw Errors.forbidden("You do not have access to this material.");
    }
    canSave = true;
    materialFolderId = material.folder.id;
  } else if (save && folderId) {
    const ownerFolder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    });
    if (!ownerFolder) {
      throw Errors.forbidden("You do not have access to this folder.");
    }
    canSave = true;
  }

  // ==========================================
  // Adaptive Item Count Computation
  // ==========================================
  const tokenEstimate = estimateTokensFromText(text);
  const depth = generationConfig?.depth ?? "balanced";
  const maxItems = generationConfig?.maxItems;
  const itemCount = computeAdaptiveItemCount(tokenEstimate, depth, maxItems);

  console.info("[llm.gateway] Adaptive generation:", {
    requestId,
    tokenEstimate,
    depth,
    itemCount,
    textLength: text.length,
  });

  // ==========================================
  // Semantic Cache Check (include itemCount in key)
  // ==========================================
  const cacheCheck = await checkSemanticCache(text, task, itemCount);

  if (cacheCheck.hit && cacheCheck.value) {
    console.info("[llm.gateway] Cache hit:", {
      requestId,
      task,
      textLength: text.length,
    });

    // Parse cached response
    const cached = cacheCheck.value as {
      task: GenerationTask;
      flashcards?: Flashcard[];
      quiz?: QuizQuestion[];
      modelId: string;
      provider: string;
    };

    // Update quota even for cached responses
    const updatedQuota = await incrementGenerationCount(user.id);

    // Return cached response with gateway metadata
    const response = {
      ...cached,
      savedCount: undefined, // Don't auto-save cached responses
      subscription: {
        tier: updatedQuota.tier,
        generationsUsed: updatedQuota.generationsUsed,
        generationsQuota: updatedQuota.generationsQuota,
        remaining: updatedQuota.remaining,
      },
      requestId,
      selectedModelId: cached.modelId,
      provider: cached.provider,
      latencyMs: Date.now() - requestStartTime,
      cached: true,
      itemCount, // Include computed itemCount
      tokenEstimate, // Include token estimate
    };

    return success(response);
  }

  // ==========================================
  // Model Selection (Gateway Routing)
  // ==========================================
  let selectedModel;

  // Dev override: force a specific model for testing
  const config = useRuntimeConfig();
  const devModelOverride = process.env.NODE_ENV === 'development'
    ? config.devLlmModelOverride
    : undefined;

  console.log("[llm.gateway] Dev model override:", { devModelOverride });

  if (devModelOverride) {
    // Fetch the override model directly from registry
    const overrideModel = await prisma.llmModelRegistry.findUnique({
      where: { modelId: devModelOverride }
    });

    if (!overrideModel) {
      console.warn(`[llm.gateway] DEV_LLM_MODEL_OVERRIDE model "${devModelOverride}" not found in registry`);
    } else {
      selectedModel = overrideModel;
      console.info("[llm.gateway] 🔧 DEV MODE: Using override model:", {
        requestId,
        modelId: selectedModel.modelId,
        provider: selectedModel.provider,
        task,
      });
    }
  }

  // Normal model selection if no override or override not found
  if (!selectedModel) {
    try {
      const routingContext = {
        userId: user.id,
        task,
        inputText: text,
        estimatedOutputTokens: task === "flashcards" ? 500 : 800, // Rough estimates
        userTier: quotaCheck.subscription.tier as "FREE" | "PRO" | "ENTERPRISE",
        preferredModelId: undefined,
        requiredCapability,
      };

      const selected = await selectBestModel(routingContext);
      selectedModel = selected.model;

      console.info("[llm.gateway] Model selected:", {
        requestId,
        modelId: selectedModel.modelId,
        provider: selectedModel.provider,
        score: selected.score,
        avgLatency: selectedModel.avgLatencyMs,
        priority: selectedModel.priority,
        task,
      });
    } catch (err) {
      console.error("[llm.gateway] Model selection failed:", err);
      await logGatewayFailure(requestId, user.id, task, err, undefined, folderId);
      throw Errors.server("Failed to select model. Please try again.");
    }
  }

  // ==========================================
  // Strategy Instantiation & Generation
  // ==========================================
  let strategy;
  let result: Flashcard[] | QuizQuestion[];
  const generationStartTime = Date.now();

  // Capture actual token values from strategy callback (using object holder for TS closure compatibility)
  const measuredTokens: { value: { promptTokens: number; completionTokens: number; totalTokens: number } | null } = { value: null };

  try {
    strategy = await getLLMStrategyFromRegistry(
      selectedModel.modelId,
      {
        userId: user.id,
        folderId,
        feature: task,
      },
      (m) => {
        // Capture actual API token values for gateway logging
        measuredTokens.value = {
          promptTokens: m.promptTokens,
          completionTokens: m.completionTokens,
          totalTokens: m.totalTokens,
        };
      }
    );

    if (task === "flashcards") {
      result = await strategy.generateFlashcards(text, { itemCount });
    } else {
      result = await strategy.generateQuiz(text, { itemCount });
    }

    const latencyMs = Date.now() - generationStartTime;

    // Update model latency in registry (rolling average)
    await updateModelLatency(selectedModel.modelId, latencyMs);

    console.info("[llm.gateway] Generation successful:", {
      requestId,
      modelId: selectedModel.modelId,
      task,
      count: result.length,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - generationStartTime;
    console.error("[llm.gateway] Generation failed:", {
      requestId,
      modelId: selectedModel.modelId,
      task,
      latencyMs,
      error: err,
    });

    // Log failure
    await logGatewayFailure(
      requestId,
      user.id,
      task,
      err,
      selectedModel.modelId,
      folderId
    );

    // Still update latency even for failures (to track degraded performance)
    await updateModelLatency(selectedModel.modelId, latencyMs);

    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan/billing or try again later."
        : "Generation failed. Please try again.";

    if (/quota exceeded|rate limit|429/i.test(message)) {
      throw Errors.rateLimit(message);
    }
    throw Errors.server(message);
  }

  // ==========================================
  // Save to Database (if requested)
  // Use transaction for atomicity - prevents partial saves
  // For material-based generation with replace=true, delete old items + CardReviews
  // ==========================================
  let savedCount: number | undefined;
  let deletedCount: number | undefined;
  let deletedReviewsCount: number | undefined;

  const effectiveFolderId = materialFolderId || folderId;

  if (canSave && effectiveFolderId) {
    try {
      if (task === "flashcards") {
        // Use transaction to ensure atomic delete + create
        await prisma.$transaction(async (tx) => {
          // If replacing for a specific material, delete old flashcards and their CardReviews
          if (replace && materialId) {
            // Get IDs of flashcards to be deleted for CardReview cleanup
            const oldFlashcards = await tx.flashcard.findMany({
              where: { materialId },
              select: { id: true },
            });
            const oldFlashcardIds = oldFlashcards.map((f) => f.id);

            // Delete CardReviews for these flashcards
            if (oldFlashcardIds.length > 0) {
              const reviewsDeleted = await tx.cardReview.deleteMany({
                where: {
                  cardId: { in: oldFlashcardIds },
                  resourceType: "flashcard",
                },
              });
              deletedReviewsCount = reviewsDeleted.count;
            }

            // Delete old flashcards
            const deleted = await tx.flashcard.deleteMany({
              where: { materialId },
            });
            deletedCount = deleted.count;
          }

          // Create new flashcards
          if (result.length) {
            const res = await tx.flashcard.createMany({
              data: (result as Flashcard[]).map((fc) => {
                // Extract sourceRef from sourceMetadata if available
                const sourceRef = materialId && fc.sourceMetadata
                  ? extractSourceRef(
                    fc.sourceMetadata,
                    loadedMaterial?.type === "pdf" ? "PDF" : "NOTE",
                    materialId
                  )
                  : null;

                return {
                  folderId: effectiveFolderId,
                  materialId: materialId || null,
                  front: fc.front,
                  back: fc.back,
                  sourceRef: sourceRef as any, // JSON field
                  status: "DRAFT", // New items start as DRAFT
                };
              }),
            });
            savedCount = res.count;
          } else {
            savedCount = 0;
          }
        });
      } else {
        // Quiz/Questions
        await prisma.$transaction(async (tx) => {
          // If replacing for a specific material, delete old questions and their CardReviews
          if (replace && materialId) {
            // Get IDs of questions to be deleted for CardReview cleanup
            const oldQuestions = await tx.question.findMany({
              where: { materialId },
              select: { id: true },
            });
            const oldQuestionIds = oldQuestions.map((q) => q.id);

            // Delete CardReviews for these questions
            if (oldQuestionIds.length > 0) {
              const reviewsDeleted = await tx.cardReview.deleteMany({
                where: {
                  cardId: { in: oldQuestionIds },
                  resourceType: "question",
                },
              });
              deletedReviewsCount = reviewsDeleted.count;
            }

            // Delete old questions
            const deleted = await tx.question.deleteMany({
              where: { materialId },
            });
            deletedCount = deleted.count;
          }

          // Create new questions
          if (result.length) {
            const res = await tx.question.createMany({
              data: (result as QuizQuestion[]).map((q) => {
                // Extract sourceRef from sourceMetadata if available
                const sourceRef = materialId && q.sourceMetadata
                  ? extractSourceRef(
                    q.sourceMetadata,
                    loadedMaterial?.type === "pdf" ? "PDF" : "NOTE",
                    materialId
                  )
                  : null;

                return {
                  folderId: effectiveFolderId,
                  materialId: materialId || null,
                  question: q.question,
                  choices: q.choices,
                  answerIndex: q.answerIndex,
                  sourceRef: sourceRef as any, // JSON field
                  status: "DRAFT", // New items start as DRAFT
                };
              }),
            });
            savedCount = res.count;
          } else {
            savedCount = 0;
          }
        });
      }
    } catch (err) {
      console.error("[llm.gateway] Failed to save to database:", {
        requestId,
        folderId: effectiveFolderId,
        materialId,
        task,
        error: err,
      });
      // Don't throw - generation succeeded even if save failed
    }
  }

  // ==========================================
  // Update User Quota
  // ==========================================
  const updatedQuota = await incrementGenerationCount(user.id);

  // ==========================================
  // Cache Response
  // ==========================================
  const cacheableData = {
    task,
    ...(task === "flashcards" ? { flashcards: result } : { quiz: result }),
    modelId: selectedModel.modelId,
    provider: selectedModel.provider,
  };

  await setSemanticCache(
    text,
    task,
    cacheableData,
    7 * 24 * 60 * 60, // 7 days TTL
    itemCount // Include itemCount in cache key
  );

  // ==========================================
  // Log Gateway Request
  // ==========================================
  const totalLatencyMs = Date.now() - requestStartTime;

  // Use actual token counts from strategy callback if available, otherwise fall back to estimates
  let inputTokens: number;
  let outputTokens: number;
  let totalTokens: number;

  if (measuredTokens.value) {
    // Use actual API values
    inputTokens = measuredTokens.value.promptTokens;
    outputTokens = measuredTokens.value.completionTokens;
    totalTokens = measuredTokens.value.totalTokens;
  } else {
    // Fall back to heuristic estimates (legacy behavior)
    inputTokens = Math.ceil(text.length / 3.5);
    outputTokens = Math.ceil(
      task === "flashcards"
        ? (result as Flashcard[]).reduce(
          (sum, fc) => sum + fc.front.length + fc.back.length,
          0
        ) / 3.5
        : (result as QuizQuestion[]).reduce(
          (sum, q) => sum + q.question.length + q.choices.join("").length,
          0
        ) / 3.5
    );
    totalTokens = inputTokens + outputTokens;
  }

  await logGatewayRequest({
    requestId,
    userId: user.id,
    folderId,
    selectedModel,
    task,
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs: totalLatencyMs,
    cached: false,
    cacheHit: false,
    status: "success",
    // Adaptive generation fields for cost analysis by depth tier
    itemCount,
    tokenEstimate,
    depth,
  });

  // ==========================================
  // Response Headers
  // ==========================================
  event.node.res.setHeader("x-llm-save-requested", String(!!save));
  event.node.res.setHeader("x-llm-can-save", String(canSave));
  event.node.res.setHeader("x-llm-generated-count", String(result.length));
  event.node.res.setHeader("x-llm-saved-count", String(savedCount ?? 0));
  event.node.res.setHeader("x-llm-task", task);
  event.node.res.setHeader("x-gateway-request-id", requestId);
  event.node.res.setHeader("x-gateway-model-id", selectedModel.modelId);
  event.node.res.setHeader("x-gateway-provider", selectedModel.provider);
  event.node.res.setHeader("x-gateway-latency-ms", String(totalLatencyMs));
  event.node.res.setHeader("x-subscription-tier", updatedQuota.tier);
  event.node.res.setHeader(
    "x-generations-used",
    String(updatedQuota.generationsUsed)
  );
  event.node.res.setHeader(
    "x-generations-quota",
    String(updatedQuota.generationsQuota)
  );
  event.node.res.setHeader(
    "x-generations-remaining",
    String(updatedQuota.remaining)
  );

  // ==========================================
  // Build Response
  // ==========================================
  const response = {
    task,
    ...(task === "flashcards" ? { flashcards: result } : { quiz: result }),
    savedCount,
    deletedCount,
    deletedReviewsCount,
    subscription: {
      tier: updatedQuota.tier,
      generationsUsed: updatedQuota.generationsUsed,
      generationsQuota: updatedQuota.generationsQuota,
      remaining: updatedQuota.remaining,
    },
    requestId,
    selectedModelId: selectedModel.modelId,
    provider: selectedModel.provider,
    latencyMs: totalLatencyMs,
    cached: false,
    itemCount, // Adaptive item count
    tokenEstimate, // Estimated tokens
  };

  console.info("[llm.gateway] Request completed", {
    requestId,
    modelId: selectedModel.modelId,
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
