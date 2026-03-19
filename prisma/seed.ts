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

  // ==========================================
  // Seed Groq Models
  // ==========================================
  console.log("Seeding Groq prices...");

  // Groq llama-3.1-8b-instant pricing (per 1k tokens in micros)
  // Input: $0.05/1M = 50 micros/1k, Output: $0.08/1M = 80 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "groq", model: "llama-3.1-8b-instant" },
    },
    update: { inputPer1kMicros: 50n, outputPer1kMicros: 80n, isActive: true },
    create: {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      inputPer1kMicros: 50n,
      outputPer1kMicros: 80n,
      isActive: true,
    },
  });

  // Groq qwen-qwq-32b pricing
  // Input: $0.075/1M = 75 micros/1k, Output: $0.30/1M = 300 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "groq", model: "qwen-qwq-32b" },
    },
    update: { inputPer1kMicros: 75n, outputPer1kMicros: 300n, isActive: true },
    create: {
      provider: "groq",
      model: "qwen-qwq-32b",
      inputPer1kMicros: 75n,
      outputPer1kMicros: 300n,
      isActive: true,
    },
  });

  // Groq llama-4-scout-17b pricing
  // Input: $0.11/1M = 110 micros/1k, Output: $0.34/1M = 340 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "groq", model: "llama-4-scout-17b" },
    },
    update: { inputPer1kMicros: 110n, outputPer1kMicros: 340n, isActive: true },
    create: {
      provider: "groq",
      model: "llama-4-scout-17b",
      inputPer1kMicros: 110n,
      outputPer1kMicros: 340n,
      isActive: true,
    },
  });

  // Groq llama-4-maverick-17b pricing
  // Input: $0.20/1M = 200 micros/1k, Output: $0.60/1M = 600 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "groq", model: "llama-4-maverick-17b" },
    },
    update: { inputPer1kMicros: 200n, outputPer1kMicros: 600n, isActive: true },
    create: {
      provider: "groq",
      model: "llama-4-maverick-17b",
      inputPer1kMicros: 200n,
      outputPer1kMicros: 600n,
      isActive: true,
    },
  });

  console.log("Seeding Groq Model Registry...");

  // Groq llama-3.1-8b-instant - fastest, most cost-effective
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "groq-llama-3.1-8b-instant" },
    update: {
      inputCostPer1M: 0.05,
      outputCostPer1M: 0.08,
      avgLatencyMs: 400,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "groq-llama-3.1-8b-instant",
      provider: "groq",
      modelName: "llama-3.1-8b-instant",
      inputCostPer1M: 0.05,
      outputCostPer1M: 0.08,
      capabilities: ["text", "chat"],
      maxTokens: 131072,
      latencyBudgetMs: 400,
      avgLatencyMs: 400,
      healthStatus: "healthy",
      priority: 1,
      enabled: true,
    },
  });

  // Groq qwen-qwq-32b
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "groq-qwen-qwq-32b" },
    update: {
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.3,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "groq-qwen-qwq-32b",
      provider: "groq",
      modelName: "qwen-qwq-32b",
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.3,
      capabilities: ["text", "chat"],
      maxTokens: 131072,
      latencyBudgetMs: 600,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      priority: 2,
      enabled: true,
    },
  });

  // Groq llama-4-scout-17b
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "groq-llama-4-scout-17b" },
    update: {
      inputCostPer1M: 0.11,
      outputCostPer1M: 0.34,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "groq-llama-4-scout-17b",
      provider: "groq",
      modelName: "llama-4-scout-17b",
      inputCostPer1M: 0.11,
      outputCostPer1M: 0.34,
      capabilities: ["text", "chat"],
      maxTokens: 131072,
      latencyBudgetMs: 600,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      priority: 3,
      enabled: true,
    },
  });

  // Groq llama-4-maverick-17b
  await prisma.llmModelRegistry.upsert({
    where: { modelId: "groq-llama-4-maverick-17b" },
    update: {
      inputCostPer1M: 0.2,
      outputCostPer1M: 0.6,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      enabled: true,
    },
    create: {
      modelId: "groq-llama-4-maverick-17b",
      provider: "groq",
      modelName: "llama-4-maverick-17b",
      inputCostPer1M: 0.2,
      outputCostPer1M: 0.6,
      capabilities: ["text", "chat"],
      maxTokens: 131072,
      latencyBudgetMs: 600,
      avgLatencyMs: 600,
      healthStatus: "healthy",
      priority: 4,
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

