import type { OpenRouterGeneration } from "./openRouter";

type PrismaLike = {
  llmUsage: {
    create(input: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

const usdMicros = (costUsd?: number) =>
  costUsd === undefined ? 0n : BigInt(Math.round(costUsd * 1_000_000));

export async function logOpenRouterSuccess(input: {
  prisma: PrismaLike;
  appRequestId: string;
  userId: string;
  workspaceId?: string;
  feature: string;
  generation: OpenRouterGeneration<unknown>;
  totalLatencyMs: number;
}) {
  const { measurement } = input.generation;
  try {
    await input.prisma.llmUsage.create({
      data: {
        provider: "openrouter",
        model: measurement.requestedModel,
        actualModel: measurement.actualModel,
        appRequestId: input.appRequestId,
        requestId: measurement.providerRequestId,
        promptTokens: measurement.promptTokens,
        completionTokens: measurement.completionTokens,
        totalTokens: measurement.totalTokens,
        inputUsdMicros: 0n,
        outputUsdMicros: 0n,
        totalUsdMicros: usdMicros(measurement.costUsd),
        status: "success",
        userId: input.userId,
        workspaceId: input.workspaceId,
        feature: input.feature,
        latencyMs: input.totalLatencyMs,
        cacheHit: measurement.cacheHit,
        rawUsageJson: measurement.rawUsage as any,
        meta: {
          finishReason: measurement.finishReason,
          cachedTokens: measurement.cachedTokens,
          cacheWriteTokens: measurement.cacheWriteTokens,
          reasoningTokens: measurement.reasoningTokens,
          providerLatencyMs: measurement.latencyMs,
          costSource:
            measurement.costUsd === undefined
              ? "missing_provider_cost"
              : "openrouter_usage",
        },
      },
    });
  } catch (error) {
    console.error("[openrouter] Failed to persist success usage", {
      appRequestId: input.appRequestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logOpenRouterFailure(input: {
  prisma: PrismaLike;
  appRequestId: string;
  userId: string;
  workspaceId?: string;
  feature: string;
  requestedModel: string;
  generation?: OpenRouterGeneration<unknown>;
  error: unknown;
  totalLatencyMs: number;
}) {
  const error = input.error as {
    statusCode?: number;
    upstreamCode?: string;
    message?: string;
  };
  const measurement = input.generation?.measurement;
  try {
    await input.prisma.llmUsage.create({
      data: {
        provider: "openrouter",
        model: measurement?.requestedModel ?? input.requestedModel,
        actualModel: measurement?.actualModel ?? input.requestedModel,
        appRequestId: input.appRequestId,
        requestId: measurement?.providerRequestId,
        promptTokens: measurement?.promptTokens ?? 0,
        completionTokens: measurement?.completionTokens ?? 0,
        totalTokens: measurement?.totalTokens ?? 0,
        inputUsdMicros: 0n,
        outputUsdMicros: 0n,
        totalUsdMicros: usdMicros(measurement?.costUsd),
        status: "error",
        errorCode: error.upstreamCode || String(error.statusCode || "UNKNOWN"),
        errorMessage: error.message || "OpenRouter request failed",
        userId: input.userId,
        workspaceId: input.workspaceId,
        feature: input.feature,
        latencyMs: input.totalLatencyMs,
        cacheHit: measurement?.cacheHit ?? false,
        rawUsageJson: measurement?.rawUsage as any,
        meta: measurement
          ? {
              finishReason: measurement.finishReason,
              providerLatencyMs: measurement.latencyMs,
              failureStage: "application",
            }
          : undefined,
      },
    });
  } catch (loggingError) {
    console.error("[openrouter] Failed to persist failure usage", {
      appRequestId: input.appRequestId,
      error:
        loggingError instanceof Error
          ? loggingError.message
          : String(loggingError),
    });
  }
}
