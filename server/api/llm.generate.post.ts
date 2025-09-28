// server/api/llm.generate.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requireRole } from '~/../server/middleware/auth'
import { getLLMStrategy } from '~~/server/utils/llm/LLMFactory'
import { LLMGenerateRequest, LLMGenerateResponse } from '~~/shared/llm-generate.contract'
import { logLlmUsage } from '~~/server/utils/llmCost'
import { checkUserQuota, incrementGenerationCount } from '~~/server/utils/quota'
import { applyLimit, getClientIp, setRateLimitHeaders, type MemCounter } from '~~/server/utils/llm/rateLimit'
import { Errors, success } from '~/../server/utils/error'

// Explicit domain unions (mirror zod schema values)
export type SupportedModel = 'gpt-3.5' | 'gpt-4o' | 'claude' | 'mixtral' | 'gemini'
export type GenerationTask = 'flashcards' | 'quiz'

interface ParsedRequest {
  model: SupportedModel
  task: GenerationTask
  text: string
  folderId?: string
  save?: boolean
  replace?: boolean
}

interface Flashcard { front: string; back: string }
interface QuizQuestion { question: string; choices: string[]; answerIndex: number }

// Minimal in-memory rate limiting: 5 requests per minute per user
const rateLimitMap: MemCounter = new Map()
const ipRateLimitMap: MemCounter = new Map()

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])

  const quotaCheck = await checkUserQuota(user.id)
  if (!quotaCheck.canGenerate) {
    event.node.res.setHeader('x-quota-exceeded', 'true')
    event.node.res.setHeader('x-subscription-tier', quotaCheck.subscription.tier)
    event.node.res.setHeader('x-generations-used', String(quotaCheck.subscription.generationsUsed))
    event.node.res.setHeader('x-generations-quota', String(quotaCheck.subscription.generationsQuota))
    event.node.res.setHeader('x-generations-remaining', String(quotaCheck.subscription.remaining))
    throw Errors.badRequest('Free tier quota exceeded. Please upgrade to continue generating content.', {
      subscription: quotaCheck.subscription,
      type: 'QUOTA_EXCEEDED'
    })
  }

  const now = Date.now()
  const windowMs = 60 * 1000
  const userRemaining = await applyLimit(`rl:user:${user.id}`, 5, rateLimitMap, now, windowMs)
  const clientIp = getClientIp(event)
  const ipRemaining = await applyLimit(`rl:ip:${clientIp}`, 20, ipRateLimitMap, now, windowMs)
  const overallRemaining = Math.min(userRemaining, ipRemaining)

  event.node.res.setHeader('x-subscription-tier', quotaCheck.subscription.tier)
  event.node.res.setHeader('x-generations-used', String(quotaCheck.subscription.generationsUsed))
  event.node.res.setHeader('x-generations-quota', String(quotaCheck.subscription.generationsQuota))
  event.node.res.setHeader('x-generations-remaining', String(quotaCheck.subscription.remaining))
  setRateLimitHeaders(event, overallRemaining, userRemaining, ipRemaining, now)

  const raw = await readBody(event)
  const parseResult = LLMGenerateRequest.safeParse(raw)
  if (!parseResult.success) {
    throw Errors.badRequest('Invalid request body', parseResult.error.flatten())
  }
  const parsed = parseResult.data as ParsedRequest
  const { model, task, folderId, save, replace, text: originalText } = parsed
  const text = originalText.trim()

  const MAX_CHARS = 10_000
  if (text.length === 0) throw Errors.badRequest('Text is required')
  if (text.length > MAX_CHARS) throw Errors.badRequest('Text too large')

  const prisma = event.context.prisma
  let canSave = false
  if (save && folderId) {
    const ownerFolder = await prisma.folder.findFirst({ where: { id: folderId, userId: user.id } })
    if (!ownerFolder) throw Errors.forbidden('You do not have access to this folder.')
    canSave = true
  }

  const strategy = getLLMStrategy(model as SupportedModel, { userId: user.id, folderId, feature: task })
  if (!strategy) throw Errors.badRequest(`Unsupported model: ${model}`)

  try {
    if (task === 'flashcards') {
      const flashcards: Flashcard[] = await strategy.generateFlashcards(text)
      let savedCount: number | undefined
      if (canSave && folderId) {
        if (replace) await prisma.flashcard.deleteMany({ where: { folderId } })
        if (flashcards.length) {
          const res = await prisma.flashcard.createMany({
            data: flashcards.map((fc: Flashcard) => ({ folderId, front: fc.front, back: fc.back }))
          })
          savedCount = res.count
        } else savedCount = 0
      }

      event.node.res.setHeader('x-llm-save-requested', String(!!save))
      event.node.res.setHeader('x-llm-can-save', String(canSave))
      event.node.res.setHeader('x-llm-generated-count', String(flashcards.length))
      event.node.res.setHeader('x-llm-saved-count', String(savedCount ?? 0))
      event.node.res.setHeader('x-llm-task', task)

      const updatedQuota = await incrementGenerationCount(user.id)
      event.node.res.setHeader('x-subscription-tier', updatedQuota.tier)
      event.node.res.setHeader('x-generations-used', String(updatedQuota.generationsUsed))
      event.node.res.setHeader('x-generations-quota', String(updatedQuota.generationsQuota))
      event.node.res.setHeader('x-generations-remaining', String(updatedQuota.remaining))

      const response = {
        task: 'flashcards' as const,
        model,
        flashcards,
        savedCount,
        subscription: {
          tier: updatedQuota.tier,
          generationsUsed: updatedQuota.generationsUsed,
          generationsQuota: updatedQuota.generationsQuota,
          remaining: updatedQuota.remaining
        }
      }

      if (process.env.NODE_ENV === 'development') LLMGenerateResponse.parse(response)

      console.info('[llm.generate] Diagnostics', { requestedSave: !!save, canSave, generatedCount: flashcards.length, savedCount, task, model, subscription: updatedQuota })
      return success(response)
    }

    const quiz: QuizQuestion[] = await strategy.generateQuiz(text)
    let savedCount: number | undefined
    if (canSave && folderId) {
      if (replace) await prisma.question.deleteMany({ where: { folderId } })
      if (quiz.length) {
        const res = await prisma.question.createMany({
          data: quiz.map((q: QuizQuestion) => ({ folderId, question: q.question, choices: q.choices, answerIndex: q.answerIndex }))
        })
        savedCount = res.count
      } else savedCount = 0
    }

    event.node.res.setHeader('x-llm-save-requested', String(!!save))
    event.node.res.setHeader('x-llm-can-save', String(canSave))
    event.node.res.setHeader('x-llm-generated-count', String(quiz.length))
    event.node.res.setHeader('x-llm-saved-count', String(savedCount ?? 0))
    event.node.res.setHeader('x-llm-task', task)

    const updatedQuota = await incrementGenerationCount(user.id)
    event.node.res.setHeader('x-subscription-tier', updatedQuota.tier)
    event.node.res.setHeader('x-generations-used', String(updatedQuota.generationsUsed))
    event.node.res.setHeader('x-generations-quota', String(updatedQuota.generationsQuota))
    event.node.res.setHeader('x-generations-remaining', String(updatedQuota.remaining))

    const response = {
      task: 'quiz' as const,
      model,
      quiz,
      savedCount,
      subscription: {
        tier: updatedQuota.tier,
        generationsUsed: updatedQuota.generationsUsed,
        generationsQuota: updatedQuota.generationsQuota,
        remaining: updatedQuota.remaining
      }
    }

    if (process.env.NODE_ENV === 'development') LLMGenerateResponse.parse(response)

    console.info('[llm.generate] Diagnostics', { requestedSave: !!save, canSave, generatedCount: quiz.length, savedCount, task, model, subscription: updatedQuota })
    return success(response)
  } catch (err) {
    const provider = model === 'gemini' ? 'google' : 'openai'
    console.error('[llm.generate] strategy error:', err)
    try {
      const errorObj = err as { status?: number; code?: string; message?: string }
      await logLlmUsage(
        { provider: provider as 'openai' | 'google', model, promptTokens: 0, completionTokens: 0, totalTokens: 0, rawUsage: null },
        { userId: user.id, folderId, feature: task, status: 'error', errorCode: String(errorObj?.status ?? errorObj?.code ?? ''), errorMessage: String(errorObj?.message ?? 'unknown error') }
      )
    } catch { /* ignore logging failures */ }

    const message = (err instanceof Error && /quota/i.test(err.message)) ? 'Quota exceeded. Please check your OpenAI plan/billing or try again later.' : 'Generation failed. Please try again or switch model.'
    if (/quota exceeded|rate limit|429/i.test(message)) throw Errors.rateLimit(message)
    throw Errors.server(message)
  }
})
