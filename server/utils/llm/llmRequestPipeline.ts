/**
 * llmRequestPipeline — shared pre/post logic for every LLM generation endpoint.
 *
 * Encapsulates the cross-cutting concerns that previously only lived in
 * llm.gateway.post.ts but are equally required by the language endpoints:
 *   - Authentication (requireRole)
 *   - Quota gate (checkUserQuota)       — optional per call
 *   - Rate limiting (user + IP)
 *   - Model selection via routing OR a pinned model ID
 *   - Dev-model override (development env)
 *   - LLM strategy instantiation with onMeasure token capture
 *   - Post-generation: latency update, quota increment, LlmGatewayLog write
 *
 * DECISIONS ENCODED HERE
 * ─────────────────────────────────────────────────────────────────────────
 * D1  Rate-limit MemCounters are module-level singletons so gateway and
 *     language requests share the same IP/user buckets.
 * D2  translate → checkQuota:false, incrementQuota:false (call with those opts)
 * D3  generate-story → checkQuota:true, incrementQuota:true (defaults)
 * D4  Frontend credit pre-check for story: handled in useLanguageCapture.
 *     Pipeline enforces server-side authoritatively regardless.
 */

import { randomUUID } from "crypto";
import { useRuntimeConfig } from "#imports";
import type { H3Event } from "h3";
import { Errors } from "../error";
import { requireRole } from "../auth";
import { checkUserQuota, incrementGenerationCount } from "../quota";
import {
  applyLimit,
  getClientIp,
  setRateLimitHeaders,
  type MemCounter,
} from "./rateLimit";
import { selectBestModel } from "./routing";
import { getLLMStrategyFromRegistry } from "./LLMFactory";
import { updateModelLatency } from "./modelRegistry";
import { logGatewayRequest, logGatewayFailure } from "./gatewayLogger";
import { estimateTokensFromText } from "./tokenEstimate";
import { prisma } from "../prisma";
import type { LlmModelRegistry } from "@prisma/client";
import type { LlmMeasured } from "../llmCost";
import type { LLMStrategy } from "./LLMStrategy";

// ─── Module-level singletons ───────────────────────────────────────────────
// Shared across ALL endpoints that use this pipeline (gateway + language).
// A user cannot bypass gateway rate limits by hammering language endpoints.
const _userRateLimitMap: MemCounter = new Map();
const _ipRateLimitMap: MemCounter = new Map();

// ─── Public types ──────────────────────────────────────────────────────────

export interface LlmPipelineOptions {
  /** Task label used for routing, logging, and LlmGatewayLog.task. */
  task: string;
  /** Input text for token estimation and model routing. */
  inputText: string;
  /** Rough estimate of output tokens for the routing scorer (default: 400). */
  estimatedOutputTokens?: number;
  /** Required model capability filter passed to selectBestModel. */
  requiredCapability?: string;
  /**
   * Bypass selectBestModel and use this exact model ID.
   * The model must exist, be enabled, and not be health-status "down".
   * Example: "gemini-2.0-flash-lite" for the translate endpoint.
   */
  pinnedModelId?: string;
  /**
   * Gate the request against UserSubscription.generationsQuota.
   * Set to false for cheap/free tasks (e.g. word translation).
   * Default: true.
   */
  checkQuota?: boolean;
  /**
   * Call incrementGenerationCount after a successful generation.
   * Set to false for tasks below the billing threshold.
   * Default: true.
   */
  incrementQuota?: boolean;
  /** Per-user requests per 60-second window (default: 5). */
  rateLimitMax?: number;
  /** Per-IP requests per 60-second window (default: 20). */
  ipRateLimitMax?: number;
  /**
   * Pre-authenticated user object. When provided, the pipeline skips
   * calling requireRole a second time. Use when the endpoint already
   * called requireRole for a DB lookup before invoking the pipeline.
   */
  user?: { id: string;[key: string]: any };
}

export interface LlmFinalizeOptions {
  /** Raw LLM output — length used for fallback output token estimation. */
  outputText?: string;
  /** Pre-computed output token count (alternative to outputText). */
  outputTokenEstimate?: number;
  /** workspaceId stored in the LlmGatewayLog row (optional). */
  workspaceId?: string;
  /** Depth tier for LlmGatewayLog analytics (optional). */
  depth?: "quick" | "balanced" | "deep";
  /** Adaptive item count for LlmGatewayLog analytics (optional). */
  itemCount?: number;
}

export interface LlmFinalizeResult {
  /**
   * Updated quota returned by incrementGenerationCount.
   * undefined when incrementQuota=false.
   */
  updatedQuota:
  | {
    tier: string;
    generationsUsed: number;
    generationsQuota: number;
    remaining: number;
    creditBalance: number;
    creditSpent: boolean;
  }
  | undefined;
  totalLatencyMs: number;
  generationLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmPipelineContext {
  user: { id: string;[key: string]: any };
  requestId: string;
  strategy: LLMStrategy;
  selectedModel: LlmModelRegistry;
  /** Populated when checkQuota=true, undefined otherwise. */
  quotaCheck: Awaited<ReturnType<typeof checkUserQuota>> | undefined;
  /** Token estimate for inputText (for convenience — matches what finalize uses). */
  tokenEstimate: number;
  /**
   * Call AFTER a successful generation.
   * Handles: model latency update, quota increment, LlmGatewayLog success row.
   */
  finalize(opts?: LlmFinalizeOptions): Promise<LlmFinalizeResult>;
  /**
   * Call WHEN generation throws.
   * Handles: model latency update, LlmGatewayLog failure row.
   */
  fail(error: unknown, workspaceId?: string): Promise<void>;
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

export async function llmRequestPipeline(
  event: H3Event,
  options: LlmPipelineOptions
): Promise<LlmPipelineContext> {
  const requestId = randomUUID();
  const requestStartTime = Date.now();

  const {
    task,
    inputText,
    estimatedOutputTokens = 400,
    requiredCapability,
    pinnedModelId,
    checkQuota = true,
    incrementQuota = true,
    rateLimitMax = 5,
    ipRateLimitMax = 20,
  } = options;

  // ── Auth ────────────────────────────────────────────────────────────────
  // requireRole caches the user on event.context.user, so calling it twice
  // within the same request is idempotent (second call is a no-op DB hit).
  const user = options.user ?? (await requireRole(event, ["USER"]));

  // ── Quota gate ──────────────────────────────────────────────────────────
  let quotaCheck: Awaited<ReturnType<typeof checkUserQuota>> | undefined;
  if (checkQuota) {
    quotaCheck = await checkUserQuota(user.id);
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
        "Quota exceeded. Please upgrade to continue generating content.",
        { subscription: quotaCheck.subscription, type: "QUOTA_EXCEEDED" }
      );
    }
    // Always expose current subscription state in headers on a passing check
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
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const now = Date.now();
  const windowMs = 60_000;
  const userRemaining = await applyLimit(
    `rl:user:${user.id}`,
    rateLimitMax,
    _userRateLimitMap,
    now,
    windowMs
  );
  const clientIp = getClientIp(event);
  const ipRemaining = await applyLimit(
    `rl:ip:${clientIp}`,
    ipRateLimitMax,
    _ipRateLimitMap,
    now,
    windowMs
  );
  setRateLimitHeaders(
    event,
    Math.min(userRemaining, ipRemaining),
    userRemaining,
    ipRemaining,
    now
  );

  // ── Model selection ──────────────────────────────────────────────────────
  let selectedModel: LlmModelRegistry | undefined;

  // Development-only model override (env: DEV_LLM_MODEL_OVERRIDE)
  const config = useRuntimeConfig();
  const devModelOverride =
    process.env.NODE_ENV === "development"
      ? (config as any).devLlmModelOverride as string | undefined
      : undefined;

  if (devModelOverride) {
    const overrideModel = await prisma.llmModelRegistry.findUnique({
      where: { modelId: devModelOverride },
    });
    if (overrideModel) {
      selectedModel = overrideModel;
      console.info("[pipeline] DEV override model:", {
        requestId,
        modelId: selectedModel.modelId,
        task,
      });
    } else {
      console.warn(
        `[pipeline] DEV_LLM_MODEL_OVERRIDE "${devModelOverride}" not found in registry`
      );
    }
  }

  if (!selectedModel) {
    if (pinnedModelId) {
      // Caller specified an exact model — validate it is usable
      const pinned = await prisma.llmModelRegistry.findUnique({
        where: { modelId: pinnedModelId },
      });
      if (!pinned || !pinned.enabled || pinned.healthStatus === "down") {
        await logGatewayFailure(
          requestId,
          user.id,
          task,
          new Error(`Pinned model unavailable: ${pinnedModelId}`),
          pinnedModelId
        );
        throw Errors.server(
          "Generation model is currently unavailable. Please try again."
        );
      }
      selectedModel = pinned;
    } else {
      // Normal routing: score all healthy models and pick the best
      try {
        const scored = await selectBestModel({
          userId: user.id,
          task: task as any,
          inputText,
          estimatedOutputTokens,
          userTier: (quotaCheck?.subscription.tier ?? "FREE") as
            | "FREE"
            | "PRO"
            | "ENTERPRISE",
          requiredCapability,
        });
        selectedModel = scored.model;
        console.info("[pipeline] Model selected:", {
          requestId,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider,
          task,
        });
      } catch (err) {
        await logGatewayFailure(requestId, user.id, task, err);
        throw Errors.server("Failed to select model. Please try again.");
      }
    }
  }

  // ── Strategy instantiation ───────────────────────────────────────────────
  // The measuredTokens holder is written by the onMeasure callback inside
  // getLLMStrategyFromRegistry. It captures actual API token counts so that
  // finalize() can write precise cost data to LlmGatewayLog.
  const measuredTokens: {
    value: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  } = { value: null };

  const strategy = await getLLMStrategyFromRegistry(
    selectedModel.modelId,
    { userId: user.id, feature: task },
    (m: LlmMeasured) => {
      measuredTokens.value = {
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        totalTokens: m.totalTokens,
      };
    }
  );

  const tokenEstimate = estimateTokensFromText(inputText);
  // Record the time just before returning — caller starts generation immediately
  const generationStartTime = Date.now();

  // ── finalize closure ────────────────────────────────────────────────────
  const finalize = async (
    opts: LlmFinalizeOptions = {}
  ): Promise<LlmFinalizeResult> => {
    const generationLatencyMs = Date.now() - generationStartTime;
    const totalLatencyMs = Date.now() - requestStartTime;

    // Update rolling-average latency in model registry (used by routing scorer)
    await updateModelLatency(selectedModel!.modelId, generationLatencyMs);

    // Token resolution order: actual (onMeasure) > outputText heuristic > caller estimate > 0
    let inputTokens: number;
    let outputTokens: number;
    let totalTokens: number;

    if (measuredTokens.value) {
      inputTokens = measuredTokens.value.promptTokens;
      outputTokens = measuredTokens.value.completionTokens;
      totalTokens = measuredTokens.value.totalTokens;
    } else {
      inputTokens = tokenEstimate;
      outputTokens = opts.outputText
        ? Math.ceil(opts.outputText.length / 3.5)
        : (opts.outputTokenEstimate ?? 0);
      totalTokens = inputTokens + outputTokens;
    }

    // Increment quota only for billed tasks
    let updatedQuota: LlmFinalizeResult["updatedQuota"];
    if (incrementQuota) {
      updatedQuota = await incrementGenerationCount(user.id);
    }

    // Write LlmGatewayLog row regardless of quota tracking
    await logGatewayRequest({
      requestId,
      userId: user.id,
      workspaceId: opts.workspaceId,
      selectedModel: selectedModel!,
      task,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs: totalLatencyMs,
      cached: false,
      cacheHit: false,
      status: "success",
      itemCount: opts.itemCount,
      tokenEstimate,
      depth: opts.depth,
    });

    return {
      updatedQuota,
      totalLatencyMs,
      generationLatencyMs,
      inputTokens,
      outputTokens,
      totalTokens,
    };
  };

  // ── fail closure ────────────────────────────────────────────────────────
  const fail = async (
    error: unknown,
    workspaceId?: string
  ): Promise<void> => {
    const generationLatencyMs = Date.now() - generationStartTime;
    // Track degraded latency so routing scorer can deprioritize this model
    await updateModelLatency(selectedModel!.modelId, generationLatencyMs);
    await logGatewayFailure(
      requestId,
      user.id,
      task,
      error,
      selectedModel!.modelId,
      workspaceId
    );
  };

  return {
    user,
    requestId,
    strategy,
    selectedModel,
    quotaCheck,
    tokenEstimate,
    finalize,
    fail,
  };
}
