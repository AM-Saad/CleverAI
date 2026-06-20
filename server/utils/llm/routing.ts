// server/utils/llm/routing.ts
import { Errors } from '../error'
import type { LlmModelRegistry } from '@prisma/client'
import { prisma } from '../prisma'
import { estimateTokensFromText } from './tokenEstimate'

export interface RoutingContext {
  userId: string
  task: 'flashcards' | 'quiz' | 'chat' | 'language_translate' | 'language_story'
  inputText: string
  requiredCapability?: string
  estimatedOutputTokens?: number
  userTier?: 'FREE' | 'PRO' | 'ENTERPRISE'
  preferredModelId?: string
  providerAllowlist?: readonly string[]
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

  const providerAllowed = (provider: string) =>
    !ctx.providerAllowlist?.length ||
    ctx.providerAllowlist.includes(provider.toLowerCase())

  // If preferred model specified and valid, use it
  if (ctx.preferredModelId) {
    const [baseModelId, suffixPart] = ctx.preferredModelId.split(':')
    const resolvedBaseModelId = baseModelId ?? ctx.preferredModelId
    const suffix = suffixPart ? `:${suffixPart}` : ''

    const preferred = await prisma.llmModelRegistry.findUnique({
      where: {
        modelId: resolvedBaseModelId,
      },
    })

    if (
      preferred &&
      preferred.enabled &&
      preferred.healthStatus !== 'down' &&
      providerAllowed(preferred.provider)
    ) {
      // Clone and re-apply suffix so the original Prisma entity is not mutated
      const routedModel = suffix
        ? { ...preferred, modelId: `${preferred.modelId}${suffix}` }
        : preferred

      const score = computeModelScore(preferred, inputTokens, outputTokens, ctx)
      const estimatedCostUsd =
        (inputTokens / 1_000_000) * preferred.inputCostPer1M +
        (outputTokens / 1_000_000) * preferred.outputCostPer1M

      console.info('[routing] Using preferred model:', {
        modelId: routedModel.modelId,
        score: score.toFixed(6),
        estimatedCostUsd: estimatedCostUsd.toFixed(6),
      })

      return {
        model: routedModel,
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
      provider: preferred?.provider,
      providerAllowlist: ctx.providerAllowlist,
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
      ...(ctx.providerAllowlist?.length && {
        provider: { in: [...ctx.providerAllowlist] },
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

  const selectedModel = scored[0]
  if (!selectedModel) {
    throw Errors.server('No scored models available. Please try again later.')
  }

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
    const primary = topTwo[0]
    const secondary = topTwo[1]
    // If best model is degraded but second is healthy, use second
    if (
      primary &&
      secondary &&
      primary.model.healthStatus === 'degraded' &&
      secondary.model.healthStatus === 'healthy'
    ) {
      console.info('[routing] Preferring healthy model over degraded:', {
        selected: secondary.model.modelId,
        skipped: primary.model.modelId,
      })
      return secondary
    }
  }

  console.info('[routing] Selected model:', {
    modelId: selectedModel.model.modelId,
    provider: selectedModel.model.provider,
    score: selectedModel.score.toFixed(6),
    estimatedCostUsd: selectedModel.estimatedCostUsd.toFixed(6),
  })

  return selectedModel
}

/**
 * Map legacy model names to registry model IDs
 * Used for backward compatibility with existing workspaces
 */
export function legacyModelToRegistryId(legacyModel: string): string | undefined {
  const mapping: Record<string, string> = {
    'gpt-3.5': 'openai-gpt35-turbo',
    'gpt-4o': 'openai-gpt4o',
    'gemini': 'gemini-2.0-flash-lite',
  }

  return mapping[legacyModel]
}
