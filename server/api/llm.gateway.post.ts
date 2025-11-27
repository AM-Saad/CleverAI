// server/api/llm.gateway.post.ts
import { defineEventHandler, readBody } from "h3";
import { requireRole } from "@server/middleware/auth";
import { GatewayGenerateRequest } from "~/shared/utils/llm-generate.contract";
import { selectBestModel } from "@server/utils/llm/routing";
import { getLLMStrategyFromRegistry } from "@server/utils/llm/LLMFactory";
import { checkSemanticCache, setSemanticCache, generateCacheKey } from "@server/utils/llm/cache";
import { logGatewayRequest, logGatewayFailure } from "@server/utils/llm/gatewayLogger";
import { updateModelLatency } from "@server/utils/llm/modelRegistry";
import { randomUUID } from 'crypto';

type GenerationTask = "flashcards" | "quiz";

interface Flashcard {
  front: string;
  back: string;
}
interface QuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
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
  const { task, folderId, save, replace, preferredModelId, requiredCapability, text: originalText } = parsed;
  const text = originalText.trim();

  const MAX_CHARS = 10_000;
  if (text.length === 0) throw Errors.badRequest("Text is required");
  if (text.length > MAX_CHARS) throw Errors.badRequest("Text too large");

  // ==========================================
  // Folder Permission Check
  // ==========================================
  let canSave = false;
  if (save && folderId) {
    const ownerFolder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    });
    if (!ownerFolder) {
      throw Errors.forbidden("You do not have access to this folder.");
    }
    canSave = true;
  }

  

  // ==========================================
  // Semantic Cache Check
  // ==========================================
  const cacheCheck = await checkSemanticCache(text, task);

  if (cacheCheck.hit && cacheCheck.value) {
    console.info('[llm.gateway] Cache hit:', {
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
    };

    return success(response);
  }

  // ==========================================
  // Model Selection (Gateway Routing)
  // ==========================================
  let selectedModel;
  try {
    const routingContext = {
      userId: user.id,
      task,
      inputText: text,
      estimatedOutputTokens: task === 'flashcards' ? 500 : 800, // Rough estimates
      userTier: quotaCheck.subscription.tier as 'FREE' | 'PRO' | 'ENTERPRISE',
      preferredModelId,
      requiredCapability,
    };

    const selected = await selectBestModel(routingContext);
    selectedModel = selected.model;

    console.info('[llm.gateway] Model selected:', {
      requestId,
      modelId: selectedModel.modelId,
      provider: selectedModel.provider,
      score: selected.score,
      avgLatency: selectedModel.avgLatencyMs,
      priority: selectedModel.priority,
      task,
    });
  } catch (err) {
    console.error('[llm.gateway] Model selection failed:', err);
    await logGatewayFailure(requestId, user.id, task, err, undefined, folderId);
    throw Errors.server('Failed to select model. Please try again.');
  }

  // ==========================================
  // Strategy Instantiation & Generation
  // ==========================================
  let strategy;
  let result: Flashcard[] | QuizQuestion[];
  const generationStartTime = Date.now();

  try {
    strategy = await getLLMStrategyFromRegistry(selectedModel.modelId, {
      userId: user.id,
      folderId,
      feature: task,
    });

    if (task === "flashcards") {
      result = await strategy.generateFlashcards(text);
    } else {
      result = await strategy.generateQuiz(text);
    }

    const latencyMs = Date.now() - generationStartTime;

    // Update model latency in registry (rolling average)
    await updateModelLatency(selectedModel.modelId, latencyMs);

    console.info('[llm.gateway] Generation successful:', {
      requestId,
      modelId: selectedModel.modelId,
      task,
      count: result.length,
      latencyMs,
    });

  } catch (err) {
    const latencyMs = Date.now() - generationStartTime;
    console.error('[llm.gateway] Generation failed:', {
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
  // ==========================================
  let savedCount: number | undefined;
  if (canSave && folderId) {
    try {
      if (task === "flashcards") {
        if (replace) {
          await prisma.flashcard.deleteMany({ where: { folderId } });
        }
        if (result.length) {
          const res = await prisma.flashcard.createMany({
            data: (result as Flashcard[]).map((fc) => ({
              folderId,
              front: fc.front,
              back: fc.back,
            })),
          });
          savedCount = res.count;
        } else {
          savedCount = 0;
        }
      } else {
        if (replace) {
          await prisma.question.deleteMany({ where: { folderId } });
        }
        if (result.length) {
          const res = await prisma.question.createMany({
            data: (result as QuizQuestion[]).map((q) => ({
              folderId,
              question: q.question,
              choices: q.choices,
              answerIndex: q.answerIndex,
            })),
          });
          savedCount = res.count;
        } else {
          savedCount = 0;
        }
      }
    } catch (err) {
      console.error('[llm.gateway] Failed to save to database:', {
        requestId,
        folderId,
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
    ...(task === 'flashcards' ? { flashcards: result } : { quiz: result }),
    modelId: selectedModel.modelId,
    provider: selectedModel.provider,
  };
  
  await setSemanticCache(
    text,
    task,
    cacheableData,
    7 * 24 * 60 * 60 // 7 days TTL
  );

  // ==========================================
  // Log Gateway Request
  // ==========================================
  const totalLatencyMs = Date.now() - requestStartTime;
  
  // Estimate token counts (strategy might have actual counts via onMeasure callback)
  const estimatedInputTokens = Math.ceil(text.length / 3.5);
  const estimatedOutputTokens = task === 'flashcards' 
    ? (result as Flashcard[]).reduce((sum, fc) => sum + fc.front.length + fc.back.length, 0) / 3.5
    : (result as QuizQuestion[]).reduce((sum, q) => sum + q.question.length + q.choices.join('').length, 0) / 3.5;

  await logGatewayRequest({
    requestId,
    userId: user.id,
    folderId,
    selectedModel,
    task,
    inputTokens: Math.ceil(estimatedInputTokens),
    outputTokens: Math.ceil(estimatedOutputTokens),
    totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
    latencyMs: totalLatencyMs,
    cached: false,
    cacheHit: false,
    status: 'success',
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
    ...(task === 'flashcards' ? { flashcards: result } : { quiz: result }),
    savedCount,
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
  };

  console.info("[llm.gateway] Request completed", {
    requestId,
    modelId: selectedModel.modelId,
    task,
    generatedCount: result.length,
    savedCount,
    latencyMs: totalLatencyMs,
    subscription: updatedQuota,
  });

  return success(response);
});
