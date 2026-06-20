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

const missingPriceWarnings = new Set<string>();

const resolvePriceModel = (model: string) => model.split(":")[0] ?? model;

const warnMissingPriceOnce = (provider: string, model: string) => {
  const key = `${provider}:${model}`;
  if (missingPriceWarnings.has(key)) return;
  missingPriceWarnings.add(key);
  console.warn(
    `[llmUsage] Missing LlmPrice for ${key}; recording usage with raw provider cost or zero-cost fallback.`,
  );
};

const costPer1MToPer1kMicros = (costPer1M: number) =>
  BigInt(Math.max(0, Math.round(costPer1M * 1000)));

const resolveUsagePrice = async (
  measured: LlmMeasured,
  priceModel: string,
) => {
  const price = await prisma.llmPrice.findUnique({
    where: {
      provider_model: { provider: measured.provider, model: priceModel },
    },
    select: { inputPer1kMicros: true, outputPer1kMicros: true },
  });

  if (price) {
    return {
      inputPer1kMicros: price.inputPer1kMicros,
      outputPer1kMicros: price.outputPer1kMicros,
      source: "llmPrice",
    } as const;
  }

  const registryModelId =
    typeof measured.meta?.registryModelId === "string"
      ? measured.meta.registryModelId
      : undefined;
  const registryMatchClauses = [
    ...(registryModelId ? [{ modelId: registryModelId }] : []),
    { modelId: priceModel },
    { modelName: priceModel },
  ];
  const registryModel = await prisma.llmModelRegistry.findFirst({
    where: {
      provider: measured.provider,
      OR: registryMatchClauses,
    },
    select: { inputCostPer1M: true, outputCostPer1M: true },
  });

  if (!registryModel) return null;

  return {
    inputPer1kMicros: costPer1MToPer1kMicros(registryModel.inputCostPer1M),
    outputPer1kMicros: costPer1MToPer1kMicros(registryModel.outputCostPer1M),
    source: "llmModelRegistry",
  } as const;
};

/**
 * Persists a usage row into LlmUsage with exact-cost (micro-dollars) and price snapshots.
 * Pricing is best-effort: missing LlmPrice rows should not break generation.
 */
export async function logLlmUsage(measured: LlmMeasured, ctx: LlmContext = {}) {
  const priceModel = resolvePriceModel(measured.model);
  const price = await resolveUsagePrice(measured, priceModel);

  if (!price) warnMissingPriceOnce(measured.provider, priceModel);

  let inputUsdMicros = 0n;
  let outputUsdMicros = 0n;
  let totalUsdMicros = 0n;
  const rawCost =
    typeof measured.rawCost === "number" &&
      !isNaN(measured.rawCost) &&
      measured.rawCost >= 0
      ? measured.rawCost
      : undefined;

  if (rawCost !== undefined) {
    // OpenRouter supplies the total cost in USD — use it directly
    totalUsdMicros = BigInt(Math.round(rawCost * 1_000_000));
  } else if (price) {
    inputUsdMicros = (BigInt(measured.promptTokens) * price.inputPer1kMicros) / 1000n;
    outputUsdMicros = (BigInt(measured.completionTokens) * price.outputPer1kMicros) / 1000n;
    totalUsdMicros = inputUsdMicros + outputUsdMicros;
  }

  await prisma.llmUsage.create({
    data: {
      provider: measured.provider,
      model: measured.model,
      inputPer1kMicrosSnapshot: price?.inputPer1kMicros,
      outputPer1kMicrosSnapshot: price?.outputPer1kMicros,

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

      meta: {
        ...(measured.meta ?? {}),
        priceModel,
        ...(price
          ? { priceSource: price.source }
          : { missingPrice: true, priceSource: "missing" }),
      } as any,
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
  const baseModel = resolvePriceModel(model);
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
