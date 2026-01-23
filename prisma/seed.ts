// // prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting development database seeding...");

  console.log("Cleaning up existing data...");
  await prisma.llmPrice.deleteMany({
    where: {
      OR: [
        { provider: "openai", model: "gpt-4o" },
        { provider: "google", model: "gemini-1.5-pro" },
        { provider: "google", model: "gemini-1.5-flash" },
        { provider: "google", model: "gemini-2.0-flash-lite" },
        { provider: "deepseek", model: "deepseek-chat" },
        { provider: "deepseek", model: "deepseek-reasoner" },
      ],
    },
  });

  console.log("Seeding LLM prices...");
  await prisma.llmPrice.upsert({
    where: { provider_model: { provider: "openai", model: "gpt-4o" } },
    update: {
      inputPer1kMicros: 5000n,
      outputPer1kMicros: 15000n,
      isActive: true,
    },
    create: {
      provider: "openai",
      model: "gpt-4o",
      inputPer1kMicros: 5000n,
      outputPer1kMicros: 15000n,
      isActive: true,
    },
  });

  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "google", model: "gemini-1.5-flash" },
    },
    update: {
      inputPer1kMicros: 350n,
      outputPer1kMicros: 1050n,
      isActive: true,
    },
    create: {
      provider: "google",
      model: "gemini-1.5-flash",
      inputPer1kMicros: 350n,
      outputPer1kMicros: 1050n,
      isActive: true,
    },
  });

  // Gemini 2.0 Flash Lite pricing (per 1k tokens in micros)
  // Input: $0.075/1M = 75 micros/1k, Output: $0.30/1M = 300 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "google", model: "gemini-2.0-flash-lite" },
    },
    update: { inputPer1kMicros: 75n, outputPer1kMicros: 300n, isActive: true },
    create: {
      provider: "google",
      model: "gemini-2.0-flash-lite",
      inputPer1kMicros: 75n,
      outputPer1kMicros: 300n,
      isActive: true,
    },
  });

  // DeepSeek Chat pricing (per 1k tokens in micros)
  // Input: $0.28/1M = 280 micros/1k, Output: $0.42/1M = 420 micros/1k (cache-miss pricing)
  console.log("Seeding DeepSeek prices...");
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "deepseek", model: "deepseek-chat" },
    },
    update: { inputPer1kMicros: 280n, outputPer1kMicros: 420n, isActive: true },
    create: {
      provider: "deepseek",
      model: "deepseek-chat",
      inputPer1kMicros: 280n,
      outputPer1kMicros: 420n,
      isActive: true,
    },
  });

  // DeepSeek Reasoner pricing (per 1k tokens in micros)
  // Input: $0.55/1M = 550 micros/1k, Output: $2.19/1M = 2190 micros/1k (cache-miss pricing)
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "deepseek", model: "deepseek-reasoner" },
    },
    update: { inputPer1kMicros: 550n, outputPer1kMicros: 2190n, isActive: true },
    create: {
      provider: "deepseek",
      model: "deepseek-reasoner",
      inputPer1kMicros: 550n,
      outputPer1kMicros: 2190n,
      isActive: true,
    },
  });

  // ==========================================
  // Seed LlmModelRegistry for gateway routing
  // ==========================================
  console.log("Seeding LLM Model Registry...");

  // DeepSeek Chat - fast, cost-effective
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "deepseek-chat" },
    update: {
      inputCostPer1M: 0.28,
      outputCostPer1M: 0.42,
      avgLatencyMs: 800,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "deepseek-chat",
      provider: "deepseek",
      modelName: "deepseek-chat",
      inputCostPer1M: 0.28,
      outputCostPer1M: 0.42,
      capabilities: ["text"],
      maxTokens: 64000,
      latencyBudgetMs: 2000,
      avgLatencyMs: 800,
      healthStatus: "healthy",
      priority: 3,
      enabled: true,
    },
  });

  // DeepSeek Reasoner - advanced reasoning
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "deepseek-reasoner" },
    update: {
      inputCostPer1M: 0.55,
      outputCostPer1M: 2.19,
      avgLatencyMs: 2000,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "deepseek-reasoner",
      provider: "deepseek",
      modelName: "deepseek-reasoner",
      inputCostPer1M: 0.55,
      outputCostPer1M: 2.19,
      capabilities: ["text", "reasoning"],
      maxTokens: 64000,
      latencyBudgetMs: 5000,
      avgLatencyMs: 2000,
      healthStatus: "healthy",
      priority: 4,
      enabled: true,
    },
  });

  // GPT-4o-mini for comparison
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "gpt-4o-mini" },
    update: {
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      avgLatencyMs: 500,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
      capabilities: ["text", "multimodal"],
      maxTokens: 128000,
      latencyBudgetMs: 1000,
      avgLatencyMs: 500,
      healthStatus: "healthy",
      priority: 2,
      enabled: true,
    },
  });

  // Gemini 2.0 Flash
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "gemini-2.0-flash" },
    update: {
      inputCostPer1M: 0.10,
      outputCostPer1M: 0.40,
      avgLatencyMs: 400,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "gemini-2.0-flash",
      provider: "google",
      modelName: "gemini-2.0-flash",
      inputCostPer1M: 0.10,
      outputCostPer1M: 0.40,
      capabilities: ["text", "multimodal"],
      maxTokens: 1000000,
      latencyBudgetMs: 800,
      avgLatencyMs: 400,
      healthStatus: "healthy",
      priority: 1,
      enabled: true,
    },
  });

  console.log("✅ Development seeding completed successfully!");

  console.log(
    "\n💡 This script only creates missing data. Use the full seed script for complete data reset."
  );
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
