// server/utils/llm/routing.ts
import { Errors } from '../error'
import type { LlmModelRegistry } from '@prisma/client'
import { prisma } from '../prisma'
import { estimateTokensFromText } from './tokenEstimate'

export interface RoutingContext {
  userId: string
  task: 'flashcards' | 'quiz' | 'chat'
  inputText: string
  requiredCapability?: string
  estimatedOutputTokens?: number
  userTier?: 'FREE' | 'PRO' | 'ENTERPRISE'
  preferredModelId?: string
}

export interface ScoredModel {
  model: LlmModelRegistry
  score: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
}

/**
 * Compute model score for routing decision
 * Lower score = better choice
 * 
 * Factors:
 * - Base cost (input + output tokens) - primary factor
 * - Latency penalty (exceeding budget adds cost)
 * - Priority penalty (admin control - higher priority number = avoid)
 * - Capability bonus (required capability match = prefer)
 * - Health penalty (degraded models = avoid)
 */
export function computeModelScore(
  model: LlmModelRegistry,
  inputTokens: number,
  outputTokens: number,
  ctx: RoutingContext
): number {
  // Base cost in USD (primary factor)
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M
  const baseCost = inputCost + outputCost

  // Latency penalty: Models exceeding their latency budget get penalized
  // This encourages fast models for better UX
  const latencyMs = model.avgLatencyMs ?? model.latencyBudgetMs
  const latencyOverage = Math.max(0, latencyMs - model.latencyBudgetMs)
  const latencyPenalty = (latencyOverage / 1000) * 0.001 // $0.001 per extra second

  // Priority penalty: Lower priority number (1-10) = preferred by admin
  // Priority 1 gets 0.001 penalty, Priority 10 gets 0.010 penalty
  const priorityPenalty = model.priority * 0.001

  // Capability bonus: If model has required capability, make it more attractive
  // This ensures feature requirements are met (e.g., multimodal for image tasks)
  const capabilityBonus = ctx.requiredCapability &&
    model.capabilities.includes(ctx.requiredCapability) ? -0.005 : 0

  // Health penalty: Degraded models should be avoided unless they're significantly cheaper
  const healthPenalty = model.healthStatus === 'degraded' ? 0.01 : 0

  const totalScore = baseCost + latencyPenalty + priorityPenalty + capabilityBonus + healthPenalty

  // Don't clamp to 0 - allow scores to differentiate even when bonuses exceed base cost
  return totalScore
}

/**
 * Select best model based on cost, latency, and capabilities
 * 
 * Algorithm:
 * 1. Check if preferred model is specified and valid
 * 2. Fetch all enabled, healthy models matching capability
 * 3. Score all candidates
 * 4. Sort by score (lowest = best)
 * 5. For PRO+ users, apply health-aware fallback logic
 */
export async function selectBestModel(
  ctx: RoutingContext
): Promise<ScoredModel> {


  const inputTokens = estimateTokensFromText(ctx.inputText)
  const outputTokens = ctx.estimatedOutputTokens ?? Math.ceil(inputTokens * 0.6)

  // If preferred model specified and valid, use it
  if (ctx.preferredModelId) {
    const preferred = await prisma.llmModelRegistry.findUnique({
      where: {
        modelId: ctx.preferredModelId,
      },
    })

    if (preferred && preferred.enabled && preferred.healthStatus !== 'down') {
      const score = computeModelScore(preferred, inputTokens, outputTokens, ctx)
      const estimatedCostUsd =
        (inputTokens / 1_000_000) * preferred.inputCostPer1M +
        (outputTokens / 1_000_000) * preferred.outputCostPer1M

      console.info('[routing] Using preferred model:', {
        modelId: preferred.modelId,
        score: score.toFixed(6),
        estimatedCostUsd: estimatedCostUsd.toFixed(6),
      })

      return {
        model: preferred,
        score,
        estimatedCostUsd,
        inputTokens,
        outputTokens,
      }
    }

    console.warn('[routing] Preferred model unavailable, falling back to auto-selection:', {
      preferredModelId: ctx.preferredModelId,
      enabled: preferred?.enabled,
      healthStatus: preferred?.healthStatus,
    })
  }

  // Fetch enabled, healthy models
  const candidates = await prisma.llmModelRegistry.findMany({
    where: {
      enabled: true,
      healthStatus: { in: ['healthy', 'degraded'] },
      ...(ctx.requiredCapability && {
        capabilities: { has: ctx.requiredCapability },
      }),
    },
    orderBy: { priority: 'asc' },
  })

  if (candidates.length === 0) {
    console.error('[routing] No healthy models available')
    throw Errors.server('No healthy models available. Please try again later.')
  }

  // Score all candidates
  const scored: ScoredModel[] = candidates.map((m: LlmModelRegistry) => {
    const score = computeModelScore(m, inputTokens, outputTokens, ctx)
    const estimatedCostUsd =
      (inputTokens / 1_000_000) * m.inputCostPer1M +
      (outputTokens / 1_000_000) * m.outputCostPer1M

    return {
      model: m,
      score,
      estimatedCostUsd,
      inputTokens,
      outputTokens,
    }
  })

  // Sort by score (lowest = best)
  scored.sort((a, b) => a.score - b.score)

  console.info('[routing] Model candidates:', scored.slice(0, 3).map(s => ({
    modelId: s.model.modelId,
    provider: s.model.provider,
    score: s.score.toFixed(6),
    costUsd: s.estimatedCostUsd.toFixed(6),
    health: s.model.healthStatus,
    priority: s.model.priority,
  })))

  // For PRO+ users, consider using top 2 and pick based on health
  if (ctx.userTier !== 'FREE' && scored.length > 1) {
    const topTwo = scored.slice(0, 2)
    // If best model is degraded but second is healthy, use second
    if (
      topTwo[0].model.healthStatus === 'degraded' &&
      topTwo[1].model.healthStatus === 'healthy'
    ) {
      console.info('[routing] Preferring healthy model over degraded:', {
        selected: topTwo[1].model.modelId,
        skipped: topTwo[0].model.modelId,
      })
      return topTwo[1]
    }
  }

  console.info('[routing] Selected model:', {
    modelId: scored[0].model.modelId,
    provider: scored[0].model.provider,
    score: scored[0].score.toFixed(6),
    estimatedCostUsd: scored[0].estimatedCostUsd.toFixed(6),
  })

  return scored[0]
}

/**
 * Map legacy model names to registry model IDs
 * Used for backward compatibility with existing folders
 */
export function legacyModelToRegistryId(legacyModel: string): string | undefined {
  const mapping: Record<string, string> = {
    'gpt-3.5': 'openai-gpt35-turbo',
    'gpt-4o': 'openai-gpt4o',
    'gemini': 'gemini-2.0-flash-lite',
  }

  return mapping[legacyModel]
}
