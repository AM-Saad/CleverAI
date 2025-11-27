// server/utils/llm/modelRegistry.ts
import type { Prisma, LlmModelRegistry } from '@prisma/client'
import { prisma } from '../prisma'

/**
 * Default models to seed into the registry
 * Prices as of November 2025
 */
export const DEFAULT_MODELS: Prisma.LlmModelRegistryCreateInput[] = [
  {
    modelId: 'gemini-2.0-flash-lite',
    provider: 'google',
    modelName: 'gemini-2.0-flash-lite',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.300,
    capabilities: ['text', 'chat'],
    maxTokens: 32000,
    latencyBudgetMs: 400,
    priority: 1, // Prefer for cost
    enabled: true,
  },
  {
    modelId: 'openai-gpt4o-mini',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    inputCostPer1M: 0.150,
    outputCostPer1M: 0.600,
    capabilities: ['text', 'chat'],
    maxTokens: 128000,
    latencyBudgetMs: 500,
    priority: 2,
    enabled: true,
  },
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    modelName: 'gemini-2.0-flash',
    inputCostPer1M: 0.100,
    outputCostPer1M: 0.400,
    capabilities: ['text', 'multimodal', 'chat'],
    maxTokens: 1000000,
    latencyBudgetMs: 600,
    priority: 3,
    enabled: true,
  },
  {
    modelId: 'openai-gpt35-turbo',
    provider: 'openai',
    modelName: 'gpt-3.5-turbo',
    inputCostPer1M: 0.50,
    outputCostPer1M: 1.50,
    capabilities: ['text', 'chat'],
    maxTokens: 16385,
    latencyBudgetMs: 450,
    priority: 4,
    enabled: true,
  },
  {
    modelId: 'openai-gpt4o',
    provider: 'openai',
    modelName: 'gpt-4o',
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    capabilities: ['text', 'multimodal', 'realtime', 'chat'],
    maxTokens: 128000,
    latencyBudgetMs: 800,
    priority: 8, // Expensive, use sparingly
    enabled: true,
  },
]

/**
 * Seed model registry with default models
 * Call this from your seed script or migration
 */
export async function seedModelRegistry() {
  console.log('🌱 Seeding LLM Model Registry...')

  const exist = await prisma.llmModelRegistry.findFirst()
  if (exist) {
    console.log('LLM Model Registry already seeded, skipping.')
    return
  }
  for (const model of DEFAULT_MODELS) {
    await prisma.llmModelRegistry.upsert({
      where: { modelId: model.modelId },
      update: {
        ...model,
        updatedAt: new Date(),
      },
      create: model,
    })
    console.log(`  ✓ ${model.modelId} (priority: ${model.priority}, $${model.inputCostPer1M.toFixed(3)}/$${model.outputCostPer1M.toFixed(3)} per 1M)`)
  }
  
  console.log(`✅ Seeded ${DEFAULT_MODELS.length} models`)
}

/**
 * Get all enabled models, optionally filtered by capability
 */
export async function getAvailableModels(capability?: string): Promise<LlmModelRegistry[]> {

  await seedModelRegistry() // Ensure seeded

  return await prisma.llmModelRegistry.findMany({
    where: {
      enabled: true,
      healthStatus: { in: ['healthy', 'degraded'] },
      ...(capability && {
        capabilities: { has: capability },
      }),
    },
    orderBy: [
      { priority: 'asc' },
      { inputCostPer1M: 'asc' },
    ],
  })
}

/**
 * Get a single model by ID
 */
export async function getModelById(modelId: string): Promise<LlmModelRegistry | null> {
  
  
  return await prisma.llmModelRegistry.findUnique({
    where: { modelId },
  })
}

/**
 * Update model health status (called by health check cron)
 */
export async function updateModelHealth(
  modelId: string,
  status: 'healthy' | 'degraded' | 'down'
): Promise<void> {
  
  
  try {
    await prisma.llmModelRegistry.update({
      where: { modelId },
      data: {
        healthStatus: status,
        lastHealthCheck: new Date(),
      },
    })
    console.info(`[modelRegistry] Updated health: ${modelId} → ${status}`)
  } catch (err) {
    console.error(`[modelRegistry] Failed to update health for ${modelId}:`, err)
  }
}

/**
 * Update model latency with rolling average
 * Uses 80% old, 20% new for smoothing
 */
export async function updateModelLatency(modelId: string, latencyMs: number): Promise<void> {
  
  
  try {
    const model = await prisma.llmModelRegistry.findUnique({
      where: { modelId },
    })
    
    if (!model) {
      console.warn(`[modelRegistry] Model ${modelId} not found for latency update`)
      return
    }
    
    // Rolling average: 80% old, 20% new
    const newAvg = model.avgLatencyMs
      ? Math.round(model.avgLatencyMs * 0.8 + latencyMs * 0.2)
      : latencyMs
    
    await prisma.llmModelRegistry.update({
      where: { modelId },
      data: { avgLatencyMs: newAvg },
    })
  } catch (err) {
    console.error(`[modelRegistry] Failed to update latency for ${modelId}:`, err)
  }
}

/**
 * Toggle model enabled status
 */
export async function toggleModelEnabled(modelId: string, enabled: boolean): Promise<LlmModelRegistry> {
  
  
  return await prisma.llmModelRegistry.update({
    where: { modelId },
    data: { enabled },
  })
}

/**
 * Update model pricing (admin function)
 */
export async function updateModelPricing(
  modelId: string,
  inputCostPer1M: number,
  outputCostPer1M: number
): Promise<LlmModelRegistry> {
  
  
  return await prisma.llmModelRegistry.update({
    where: { modelId },
    data: {
      inputCostPer1M,
      outputCostPer1M,
      updatedAt: new Date(),
    },
  })
}

/**
 * Update model priority (lower = higher priority)
 */
export async function updateModelPriority(
  modelId: string,
  priority: number
): Promise<LlmModelRegistry> {
  
  
  if (priority < 1 || priority > 10) {
    throw new Error('Priority must be between 1 and 10')
  }
  
  return await prisma.llmModelRegistry.update({
    where: { modelId },
    data: { priority },
  })
}

/**
 * Get model statistics (usage counts from gateway logs)
 */
export async function getModelStats(modelId: string, days = 30) {
  
  
  const since = new Date()
  since.setDate(since.getDate() - days)
  
  const stats = await prisma.llmGatewayLog.aggregate({
    where: {
      selectedModelId: modelId,
      createdAt: { gte: since },
    },
    _count: { id: true },
    _sum: {
      totalTokens: true,
      totalCostUsdMicros: true,
      latencyMs: true,
    },
    _avg: {
      latencyMs: true,
    },
  })
  
  return {
    requestCount: stats._count.id,
    totalTokens: stats._sum.totalTokens || 0,
    totalCostUsd: (Number(stats._sum.totalCostUsdMicros || 0n) / 1_000_000).toFixed(4),
    avgLatencyMs: Math.round(stats._avg.latencyMs || 0),
  }
}
