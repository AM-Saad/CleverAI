// server/utils/llm/gatewayLogger.ts
import type { LlmModelRegistry } from '@prisma/client'
import { prisma } from '../prisma'

export interface GatewayLogData {
  requestId: string
  userId: string
  folderId?: string
  selectedModel: LlmModelRegistry
  task: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  latencyMs: number
  cached: boolean
  cacheHit: boolean
  status: 'success' | 'error' | 'quota_exceeded' | 'rate_limited'
  errorCode?: string
  errorMessage?: string
  routingScore?: number
  // Adaptive generation fields
  itemCount?: number
  tokenEstimate?: number
  depth?: 'quick' | 'balanced' | 'deep'
}

/**
 * Log gateway request to database
 * Includes token counts, costs, latency, and routing information
 */
export async function logGatewayRequest(data: GatewayLogData): Promise<void> {
  try {
    // Calculate costs in micro-dollars
    const inputCostUsdMicros = BigInt(
      Math.round((data.inputTokens / 1_000_000) * data.selectedModel.inputCostPer1M * 1_000_000)
    )
    const outputCostUsdMicros = BigInt(
      Math.round((data.outputTokens / 1_000_000) * data.selectedModel.outputCostPer1M * 1_000_000)
    )

    await prisma.llmGatewayLog.create({
      data: {
        requestId: data.requestId,
        userId: data.userId,
        folderId: data.folderId,
        selectedModelId: data.selectedModel.modelId,
        provider: data.selectedModel.provider,
        task: data.task,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        inputCostUsdMicros,
        outputCostUsdMicros,
        totalCostUsdMicros: inputCostUsdMicros + outputCostUsdMicros,
        latencyMs: data.latencyMs,
        cached: data.cached,
        cacheHit: data.cacheHit,
        status: data.status,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        routingScore: data.routingScore,
        // Adaptive generation fields for analytics
        itemCount: data.itemCount,
        tokenEstimate: data.tokenEstimate,
        depth: data.depth,
      },
    })

    console.info('[gatewayLogger] Logged request:', {
      requestId: data.requestId,
      model: data.selectedModel.modelId,
      task: data.task,
      tokens: data.totalTokens,
      status: data.status,
      cached: data.cacheHit,
    })
  } catch (err) {
    console.error('[gatewayLogger] Failed to log request:', {
      requestId: data.requestId,
      error: err,
    })
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Log failed gateway request
 * Used when request fails before token counting
 */
export async function logGatewayFailure(
  requestId: string,
  userId: string,
  task: string,
  error: any,
  modelId?: string,
  folderId?: string
): Promise<void> {
  try {
    await prisma.llmGatewayLog.create({
      data: {
        requestId,
        userId,
        folderId,
        selectedModelId: modelId || 'unknown',
        provider: 'unknown',
        task,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputCostUsdMicros: BigInt(0),
        outputCostUsdMicros: BigInt(0),
        totalCostUsdMicros: BigInt(0),
        latencyMs: 0,
        cached: false,
        cacheHit: false,
        status: 'error',
        errorCode: error.statusCode?.toString() || error.code || 'UNKNOWN',
        errorMessage: error.message || 'Unknown error',
      },
    })

    console.info('[gatewayLogger] Logged failure:', {
      requestId,
      task,
      errorCode: error.statusCode || error.code,
    })
  } catch (err) {
    console.error('[gatewayLogger] Failed to log failure:', {
      requestId,
      error: err,
    })
  }
}

/**
 * Get usage statistics for a user
 */
export async function getUserGatewayStats(userId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const stats = await prisma.llmGatewayLog.aggregate({
    where: {
      userId,
      createdAt: { gte: since },
    },
    _count: { id: true },
    _sum: {
      totalTokens: true,
      totalCostUsdMicros: true,
    },
  })

  const byModel = await prisma.llmGatewayLog.groupBy({
    by: ['selectedModelId', 'provider'],
    where: {
      userId,
      createdAt: { gte: since },
    },
    _count: { id: true },
    _sum: {
      totalTokens: true,
      totalCostUsdMicros: true,
    },
  })

  return {
    totalRequests: stats._count.id,
    totalTokens: stats._sum.totalTokens || 0,
    totalCostUsd: (Number(stats._sum.totalCostUsdMicros || 0n) / 1_000_000).toFixed(4),
    byModel: byModel.map((m) => ({
      modelId: m.selectedModelId,
      provider: m.provider,
      requests: m._count.id,
      tokens: m._sum.totalTokens || 0,
      costUsd: (Number(m._sum.totalCostUsdMicros || 0n) / 1_000_000).toFixed(4),
    })),
  }
}

/**
 * Get cache hit rate statistics
 */
export async function getCacheHitStats(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const total = await prisma.llmGatewayLog.count({
    where: { createdAt: { gte: since } },
  })

  const cacheHits = await prisma.llmGatewayLog.count({
    where: {
      createdAt: { gte: since },
      cacheHit: true,
    },
  })

  const hitRate = total > 0 ? (cacheHits / total) * 100 : 0

  return {
    total,
    cacheHits,
    cacheMisses: total - cacheHits,
    hitRate: hitRate.toFixed(2) + '%',
  }
}
