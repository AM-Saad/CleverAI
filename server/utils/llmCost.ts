// server/utils/llmCost.ts
export type CostInput = {
  provider: "openai" | "google" | "deepseek" | "groq" | "openrouter";
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export type LlmMeasured = {
  provider: "openai" | "google" | "deepseek" | "groq" | "openrouter";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestId?: string;
  rawUsage?: unknown;
  rawCost?: number;
  reasoningTokens?: number;
  meta?: {
    inputChars?: number;
    outputChars?: number;
    // allow any extra diagnostic fields if needed
    [k: string]: any;
  };
};

export type LlmContext = {
  userId?: string;
  workspaceId?: string;
  feature?: string; // "flashcards" | "quiz" | "chat" | etc.
  status?: "success" | "error";
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Persists a usage row into LlmUsage with exact-cost (micro-dollars) and price snapshots.
 * Assumes a price row exists in LlmPrice for the given provider+model.
 */
export async function logLlmUsage(measured: LlmMeasured, ctx: LlmContext = {}) {
  const baseModel = measured.model.split(':')[0];
  const price = await prisma.llmPrice.findUnique({
    where: {
      provider_model: { provider: measured.provider, model: baseModel },
    },
    select: { inputPer1kMicros: true, outputPer1kMicros: true },
  });

  if (!price) {
    throw new Error(
      `LlmPrice not found for ${measured.provider}:${measured.model}`
    );
  }

  let inputUsdMicros = 0n;
  let outputUsdMicros = 0n;
  let totalUsdMicros = 0n;

  if (typeof measured.rawCost === "number" && !isNaN(measured.rawCost) && measured.rawCost > 0) {
    // OpenRouter supplies the total cost in USD — use it directly
    totalUsdMicros = BigInt(Math.round(measured.rawCost * 1_000_000));
  } else {
    const estimated = await estimateCostMicros({
      provider: measured.provider,
      model: measured.model,
      promptTokens: measured.promptTokens,
      completionTokens: measured.completionTokens,
    });
    inputUsdMicros = estimated.inputUsdMicros;
    outputUsdMicros = estimated.outputUsdMicros;
    totalUsdMicros = estimated.totalUsdMicros;
  }

  await prisma.llmUsage.create({
    data: {
      provider: measured.provider,
      model: measured.model,
      inputPer1kMicrosSnapshot: price.inputPer1kMicros,
      outputPer1kMicrosSnapshot: price.outputPer1kMicros,

      promptTokens: measured.promptTokens,
      completionTokens: measured.completionTokens,
      totalTokens: measured.totalTokens,

      inputUsdMicros,
      outputUsdMicros,
      totalUsdMicros,

      requestId: measured.requestId,
      status: ctx.status ?? "success",
      errorCode: ctx.errorCode,
      errorMessage: ctx.errorMessage,

      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      feature: ctx.feature,

      meta: measured.meta as any,
      rawUsageJson: measured.rawUsage as any,
    },
  });
}

export async function estimateCostMicros({
  provider,
  model,
  promptTokens,
  completionTokens,
}: CostInput) {
  const baseModel = model.split(':')[0];
  const price = await prisma.llmPrice.findUniqueOrThrow({
    where: { provider_model: { provider, model: baseModel } },
    select: { inputPer1kMicros: true, outputPer1kMicros: true },
  });

  const input = (BigInt(promptTokens) * price.inputPer1kMicros) / 1000n;
  const output = (BigInt(completionTokens) * price.outputPer1kMicros) / 1000n;
  return {
    inputUsdMicros: input,
    outputUsdMicros: output,
    totalUsdMicros: input + output,
  };
}
