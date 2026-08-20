import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { createError } from "h3";
import { requireRole } from "../auth";
import type {
  ConsumedQuota,
  QuotaPort,
  QuotaStatus,
} from "@server/modules/subscription/ports/QuotaPort";
import {
  setQuotaHeaders,
  throwQuotaExceeded,
} from "@server/modules/subscription/infrastructure/http/quotaHttp";
import { enforceLlmRateLimit } from "./rateLimit";
import {
  createOpenRouterAI,
  OpenRouterRequestError,
  type OpenRouterAI,
  type OpenRouterGeneration,
} from "./openRouter";
import { logOpenRouterFailure, logOpenRouterSuccess } from "./usageLogger";
import { estimateTokensFromText } from "./tokenEstimate";

export interface LlmPipelineOptions {
  quotaPort: QuotaPort;
  task: string;
  inputText: string;
  checkQuota?: boolean;
  incrementQuota?: boolean;
  rateLimitMax?: number;
  ipRateLimitMax?: number;
  user?: { id: string; [key: string]: any };
  precheckedQuota?: QuotaStatus;
  ai?: OpenRouterAI;
}

export interface LlmFinalizeOptions<T> {
  generation: OpenRouterGeneration<T>;
  workspaceId?: string;
}

export interface LlmFinalizeResult {
  updatedQuota: ConsumedQuota | undefined;
  totalLatencyMs: number;
  generationLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestedModel: string;
  actualModel: string;
  costUsd?: number;
}

export interface LlmPipelineContext {
  user: { id: string; [key: string]: any };
  requestId: string;
  ai: OpenRouterAI;
  requestedModel: string;
  quotaCheck: QuotaStatus | undefined;
  reservedQuota: ConsumedQuota | undefined;
  tokenEstimate: number;
  finalize<T>(opts: LlmFinalizeOptions<T>): Promise<LlmFinalizeResult>;
  fail(
    error: unknown,
    options?: {
      workspaceId?: string;
      generation?: OpenRouterGeneration<unknown>;
    },
  ): Promise<void>;
}

function mapOpenRouterError(error: unknown): never {
  if (!(error instanceof OpenRouterRequestError)) throw error;
  throw createError({
    statusCode: error.statusCode,
    statusMessage: error.message,
    data: {
      provider: "openrouter",
      code: error.upstreamCode,
      details: error.details,
    },
  });
}

export async function llmRequestPipeline(
  event: H3Event,
  options: LlmPipelineOptions,
): Promise<LlmPipelineContext> {
  const requestId = randomUUID();
  const requestStartTime = Date.now();
  const {
    task,
    inputText,
    quotaPort,
    checkQuota = true,
    incrementQuota = true,
    rateLimitMax = 5,
    ipRateLimitMax = 20,
  } = options;

  const user = options.user ?? (await requireRole(event, ["USER"]));

  await enforceLlmRateLimit(event, user.id, {
    userMax: rateLimitMax,
    ipMax: ipRateLimitMax,
  });

  const ai = options.ai ?? createOpenRouterAI();

  let quotaCheck: QuotaStatus | undefined;
  let reservedQuota: ConsumedQuota | undefined;
  if (checkQuota) {
    quotaCheck =
      options.precheckedQuota ??
      (await quotaPort.checkGenerationQuota(user.id));
    if (!quotaCheck.canGenerate) {
      throwQuotaExceeded(
        event,
        quotaCheck.subscription,
        "Quota exceeded. Please upgrade to continue generating content.",
      );
    }
    setQuotaHeaders(event, quotaCheck.subscription);
  }

  if (incrementQuota) {
    try {
      reservedQuota = await quotaPort.consumeGeneration(user.id);
      setQuotaHeaders(event, reservedQuota);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GENERATION_QUOTA_EXCEEDED"
      ) {
        throwQuotaExceeded(
          event,
          quotaCheck?.subscription ?? {
            tier: "FREE",
            generationsUsed: 0,
            generationsQuota: 0,
            remaining: 0,
            creditBalance: 0,
          },
          "Quota exceeded. Please upgrade to continue generating content.",
        );
      }
      throw error;
    }
  }

  const tokenEstimate = estimateTokensFromText(inputText);
  const generationStartTime = Date.now();
  let settled = false;

  const finalize = async <T>(
    opts: LlmFinalizeOptions<T>,
  ): Promise<LlmFinalizeResult> => {
    if (settled) {
      throw new Error(`LLM request ${requestId} already settled`);
    }
    settled = true;
    const totalLatencyMs = Date.now() - requestStartTime;
    await logOpenRouterSuccess({
      prisma: event.context.prisma,
      appRequestId: requestId,
      userId: user.id,
      workspaceId: opts.workspaceId,
      feature: task,
      generation: opts.generation,
      totalLatencyMs,
    });

    return {
      updatedQuota: reservedQuota,
      totalLatencyMs,
      generationLatencyMs: Date.now() - generationStartTime,
      inputTokens: opts.generation.measurement.promptTokens,
      outputTokens: opts.generation.measurement.completionTokens,
      totalTokens: opts.generation.measurement.totalTokens,
      requestedModel: opts.generation.measurement.requestedModel,
      actualModel: opts.generation.measurement.actualModel,
      costUsd: opts.generation.measurement.costUsd,
    };
  };

  const fail = async (
    error: unknown,
    failure?: {
      workspaceId?: string;
      generation?: OpenRouterGeneration<unknown>;
    },
  ): Promise<void> => {
    if (settled) return;
    settled = true;
    if (reservedQuota) {
      try {
        await quotaPort.refundGeneration(user.id, reservedQuota);
      } catch (refundError) {
        console.error("[openrouter] Failed to refund quota reservation", {
          requestId,
          userId: user.id,
          error:
            refundError instanceof Error
              ? refundError.message
              : String(refundError),
        });
      }
    }
    await logOpenRouterFailure({
      prisma: event.context.prisma,
      appRequestId: requestId,
      userId: user.id,
      workspaceId: failure?.workspaceId,
      feature: task,
      requestedModel: ai.model,
      generation: failure?.generation,
      error,
      totalLatencyMs: Date.now() - requestStartTime,
    });
  };

  return {
    user,
    requestId,
    ai,
    requestedModel: ai.model,
    quotaCheck,
    reservedQuota,
    tokenEstimate,
    finalize,
    fail,
  };
}

export function throwMappedOpenRouterError(error: unknown): never {
  return mapOpenRouterError(error);
}
