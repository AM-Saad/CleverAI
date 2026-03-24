// // prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting production-grade database seeding (March 2026 Comprehensive Update)...");

  console.log("Cleaning up existing data...");
  // Clearing models that are either deprecated (Maverick) or being updated
  await prisma.llmPrice.deleteMany({});
  await prisma.llmModelRegistry.deleteMany({});

  console.log("Seeding LLM prices (Micros per 1k tokens)...");

  /**
   * PRICING LOGIC (Micros per 1k tokens):
   * $1.00 / 1M = 1000 micros / 1k
   * $0.10 / 1M = 100 micros / 1k
   * $0.05 / 1M = 50 micros / 1k
   */

  const pricingData = [
    { provider: "openai", model: "gpt-5.4", in: 2500n, out: 15000n }, // $2.50 / $15.00 
    { provider: "openai", model: "gpt-5-mini", in: 250n, out: 2000n }, // $0.25 / $2.00 [3, 4]
    { provider: "openai", model: "gpt-5-nano", in: 50n, out: 400n }, // $0.05 / $0.40 [5, 3]
    { provider: "openai", model: "gpt-4o-mini", in: 100n, out: 400n }, // $0.10 / $0.40 

    // --- DEEPSEEK UNIFIED V3.2 ---
    // Both Chat and Reasoner use the same V3.2 base pricing 
    { provider: "deepseek", model: "deepseek-chat", in: 280n, out: 420n }, // $0.28 / $0.42
    { provider: "deepseek", model: "deepseek-reasoner", in: 280n, out: 420n },

    // --- GOOGLE FLASH & UTILITY ---
    { provider: "google", model: "gemini-2.0-flash", in: 100n, out: 400n }, // $0.10 / $0.40 
    { provider: "google", model: "gemini-2.0-flash-lite", in: 75n, out: 300n }, // $0.075 / $0.30 
    { provider: "google", model: "gemma-3-4b", in: 40n, out: 80n }, // $0.04 / $0.08 

    // --- MISTRAL & OPEN WEIGHT BUDGET ---
    { provider: "mistral", model: "mistral-nemo", in: 20n, out: 40n }, // $0.02 / $0.04
    { provider: "meta", model: "llama-3.2-1b", in: 20n, out: 20n }, // $0.02 / $0.02 [6, 3]
    { provider: "qwen", model: "qwen3-4b", in: 30n, out: 30n }, // $0.03 / $0.03 

    // --- GROQ ACCELERATED MODELS ---
    { provider: "groq", model: "llama-3.1-8b-instant", in: 50n, out: 80n }, // $0.05 / $0.08 [7, 8]
    { provider: "groq", model: "openai/gpt-oss-120b", in: 150n, out: 600n }, // $0.15 / $0.60 [7, 8]
    { provider: "groq", model: "openai/gpt-oss-20b", in: 75n, out: 300n }, // $0.075 / $0.30 [7, 9]
    { provider: "groq", model: "qwen/qwen3-32b", in: 290n, out: 590n }, // $0.29 / $0.59 [7, 10];

    // --- OPENROUTER MODELS (verified from openrouter.ai/models) ---
    { provider: "openrouter", model: "google/gemini-2.0-flash-lite-001", in: 75n, out: 300n },      // $0.075 / $0.30
    { provider: "openrouter", model: "google/gemini-2.5-flash", in: 300n, out: 2500n },              // $0.30 / $2.50 (reasoning)
    { provider: "openrouter", model: "google/gemini-3.1-flash-lite-preview", in: 250n, out: 1500n }, // $0.25 / $1.50
    { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324", in: 200n, out: 770n },        // $0.20 / $0.77
    { provider: "openrouter", model: "deepseek/deepseek-v3.2", in: 260n, out: 380n },                // $0.26 / $0.38
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct", in: 20n, out: 50n },        // $0.02 / $0.05
    { provider: "openrouter", model: "openrouter/auto", in: 0n, out: 0n },                           // Dynamic — uses rawCost from response
    // Free variants (zero cost)
    { provider: "openrouter", model: "google/gemini-2.0-flash-lite-001:free", in: 0n, out: 0n },
    { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324:free", in: 0n, out: 0n },
  ];
  for (const p of pricingData) {
    await prisma.llmPrice.upsert({
      where: { provider_model: { provider: p.provider, model: p.model } },
      update: { inputPer1kMicros: p.in, outputPer1kMicros: p.out, isActive: true },
      create: { provider: p.provider, model: p.model, inputPer1kMicros: p.in, outputPer1kMicros: p.out, isActive: true },
    });
  }

  console.log("Seeding LLM Model Registry for gateway routing...");

  const registryData = [
    {
      modelId: "gpt-5.4",
      provider: "openai",
      inCost: 2.50,
      outCost: 15.00,
      cap: ["text", "reasoning", "multimodal"],
      priority: 5,
    },
    {
      modelId: "gpt-5-nano",
      provider: "openai",
      inCost: 0.05,
      outCost: 0.40,
      cap: ["text", "multimodal"],
      priority: 1,
    },
    {
      modelId: "gpt-4o-mini",
      provider: "openai",
      inCost: 0.10,
      outCost: 0.40,
      cap: ["text", "multimodal"],
      priority: 1,
    },
    {
      modelId: "deepseek-chat",
      provider: "deepseek",
      inCost: 0.28,
      outCost: 0.42,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "deepseek-reasoner",
      provider: "deepseek",
      inCost: 0.28,
      outCost: 0.42,
      cap: ["text", "reasoning"],
      priority: 2,
    },
    {
      modelId: "gemini-2.0-flash-lite",
      provider: "google",
      inCost: 0.075,
      outCost: 0.30,
      cap: ["text", "multimodal"],
      priority: 1,
    },
    {
      modelId: "mistral-nemo",
      provider: "mistral",
      inCost: 0.02,
      outCost: 0.02,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "groq-llama-3.1-8b-instant",
      provider: "groq",
      modelName: "llama-3.1-8b-instant",
      inCost: 0.05,
      outCost: 0.08,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "groq-gpt-oss-120b",
      provider: "groq",
      modelName: "openai/gpt-oss-120b",
      inCost: 0.15,
      outCost: 0.60,
      cap: ["text", "reasoning"],
      priority: 3,
    },
    {
      modelId: "llama-3.2-1b",
      provider: "meta",
      modelName: "llama-3.2-1b-instruct",
      inCost: 0.02,
      outCost: 0.02,
      cap: ["text"],
      priority: 1,
    },
    // --- OPENROUTER BUDGET MODELS (verified March 2026) ---
    {
      modelId: "openrouter-gemini-flash-lite",
      provider: "openrouter",
      modelName: "google/gemini-2.0-flash-lite-001",
      inCost: 0.075,
      outCost: 0.30,
      cap: ["text", "multimodal"],
      priority: 1,
    },
    {
      modelId: "openrouter-gemini-2-5-flash",
      provider: "openrouter",
      modelName: "google/gemini-2.5-flash",
      inCost: 0.30,
      outCost: 2.50,
      cap: ["text", "reasoning", "multimodal"],
      priority: 3,
    },
    {
      modelId: "openrouter-gemini-3-1-preview",
      provider: "openrouter",
      modelName: "google/gemini-3.1-flash-lite-preview",
      inCost: 0.25,
      outCost: 1.50,
      cap: ["text", "multimodal"],
      priority: 2,
    },
    {
      modelId: "openrouter-deepseek-v3",
      provider: "openrouter",
      modelName: "deepseek/deepseek-chat-v3-0324",
      inCost: 0.20,
      outCost: 0.77,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "openrouter-deepseek-v3-2",
      provider: "openrouter",
      modelName: "deepseek/deepseek-v3.2",
      inCost: 0.26,
      outCost: 0.38,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "openrouter-llama-3-1-8b",
      provider: "openrouter",
      modelName: "meta-llama/llama-3.1-8b-instruct",
      inCost: 0.02,
      outCost: 0.05,
      cap: ["text"],
      priority: 1,
    },
    {
      modelId: "openrouter-auto",
      provider: "openrouter",
      modelName: "openrouter/auto",
      inCost: 0,
      outCost: 0,
      cap: ["text"],
      priority: 2,
    },
    // --- FREE VARIANTS (for FREE tier users / dev testing) ---
    {
      modelId: "openrouter-gemini-flash-lite-free",
      provider: "openrouter",
      modelName: "google/gemini-2.0-flash-lite-001:free",
      inCost: 0,
      outCost: 0,
      cap: ["text", "multimodal"],
      priority: 1,
    },
    {
      modelId: "openrouter-deepseek-v3-free",
      provider: "openrouter",
      modelName: "deepseek/deepseek-chat-v3-0324:free",
      inCost: 0,
      outCost: 0,
      cap: ["text"],
      priority: 1,
    }
  ];

  for (const item of registryData) {
    await prisma.llmModelRegistry.upsert({
      where: { modelId: item.modelId },
      update: {
        inputCostPer1M: item.inCost,
        outputCostPer1M: item.outCost,
        priority: item.priority,
        enabled: true,
      },
      create: {
        modelId: item.modelId,
        provider: item.provider,
        modelName: item.modelName || item.modelId,
        inputCostPer1M: item.inCost,
        outputCostPer1M: item.outCost,
        capabilities: item.cap,
        maxTokens: 128000,
        healthStatus: "healthy",
        priority: item.priority,
        enabled: true,
      },
    });
  }

  console.log("✅ Comprehensive March 2026 seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });