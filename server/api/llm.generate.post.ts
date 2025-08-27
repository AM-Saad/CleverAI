// server/api/llm.generate.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requireRole } from '~/../server/middleware/auth'
import { getLLMStrategy } from '~~/server/utils/llm/LLMFactory'
import { LLMGenerateRequest, LLMGenerateResponse } from '~~/shared/llm-generate.contract'
import { logLlmUsage } from '~~/server/utils/llmCost'
import { checkUserQuota, incrementGenerationCount } from '~~/server/utils/quota'
import { WINDOW_SEC, applyLimit, getClientIp, setRateLimitHeaders, type MemCounter } from '~~/server/utils/llm/rateLimit'

// Minimal in-memory rate limiting: 5 requests per minute per user
const rateLimitMap: MemCounter = new Map()
const ipRateLimitMap: MemCounter = new Map()

export default defineEventHandler(async (event) => {
  // Ensure only authenticated users can generate content (consistent with folders APIs)
  const user = await requireRole(event, ['USER'])

  // --- Check user quota (freemium limit) ---
  const quotaCheck = await checkUserQuota(user.id)
  if (!quotaCheck.canGenerate) {
    // Set header to inform frontend this is a quota issue, not a rate limit
    event.node.res.setHeader('x-quota-exceeded', 'true')
    event.node.res.setHeader('x-subscription-tier', quotaCheck.subscription.tier)
    event.node.res.setHeader('x-generations-used', String(quotaCheck.subscription.generationsUsed))
    event.node.res.setHeader('x-generations-quota', String(quotaCheck.subscription.generationsQuota))
    event.node.res.setHeader('x-generations-remaining', String(quotaCheck.subscription.remaining))

    throw createError({
      statusCode: 402, // Payment Required
      statusMessage: 'Free tier quota exceeded. Please upgrade to continue generating content.',
      data: {
        subscription: quotaCheck.subscription,
        type: 'QUOTA_EXCEEDED'
      }
    })
  }

  // --- Rate limits (user + IP) - short-term limits to prevent abuse ---
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const userRemaining = await applyLimit(`rl:user:${user.id}`, 5, rateLimitMap, now, windowMs)
  const clientIp = getClientIp(event)
  const ipRemaining = await applyLimit(`rl:ip:${clientIp}`, 20, ipRateLimitMap, now, windowMs)
  const overallRemaining = Math.min(userRemaining, ipRemaining)

  // Add quota information to headers
  event.node.res.setHeader('x-subscription-tier', quotaCheck.subscription.tier)
  event.node.res.setHeader('x-generations-used', String(quotaCheck.subscription.generationsUsed))
  event.node.res.setHeader('x-generations-quota', String(quotaCheck.subscription.generationsQuota))
  event.node.res.setHeader('x-generations-remaining', String(quotaCheck.subscription.remaining))

  // Set rate limit headers
  setRateLimitHeaders(event, overallRemaining, userRemaining, ipRemaining, now)

  // Parse and validate request using shared contract
  const raw = await readBody(event)
  const parsed = LLMGenerateRequest.safeParse(raw)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }
  const { model, task, folderId, save, replace } = parsed.data as any
  let { text } = parsed.data as any

  // Normalize input text
  text = text.trim()
  const MAX_CHARS = 10_000
  if (text.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Text is required' })
  }
  if (text.length > MAX_CHARS) {
    throw createError({ statusCode: 413, statusMessage: 'Text too large' })
  }

  const prisma = event.context.prisma
  let canSave = false
  if (save && folderId) {
    const ownerFolder = await prisma.folder.findFirst({ where: { id: folderId, userId: user.id } })
    if (!ownerFolder) {
      throw createError({ statusCode: 403, statusMessage: 'You do not have access to this folder.' })
    }
    canSave = true
  }

  const strategy = getLLMStrategy(model, {
    userId: user.id,
    folderId,
    feature: task,
  })
  if (!strategy) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported model: ${model}` })
  }

  try {
    if (task === 'flashcards') {
      const flashcards = await strategy.generateFlashcards(text)
      let savedCount: number | undefined
      if (canSave && folderId) {
        if (replace) {
          await prisma.flashcard.deleteMany({ where: { folderId } })
        }
        if (flashcards.length) {
          const res = await prisma.flashcard.createMany({
            data: flashcards.map(fc => ({ folderId, front: fc.front, back: fc.back })),
          })
          savedCount = res.count
        } else {
          savedCount = 0
        }
      }
      // Set extra debug headers
      event.node.res.setHeader('x-llm-save-requested', String(!!save))
      event.node.res.setHeader('x-llm-can-save', String(canSave))
      event.node.res.setHeader('x-llm-generated-count', String(flashcards.length))
      event.node.res.setHeader('x-llm-saved-count', String(savedCount ?? 0))
      event.node.res.setHeader('x-llm-task', task)

      // Increment the user's generation count if successful and they're on free tier
      const updatedQuota = await incrementGenerationCount(user.id)

      // Update quota headers with latest info
      event.node.res.setHeader('x-subscription-tier', updatedQuota.tier)
      event.node.res.setHeader('x-generations-used', String(updatedQuota.generationsUsed))
      event.node.res.setHeader('x-generations-quota', String(updatedQuota.generationsQuota))
      event.node.res.setHeader('x-generations-remaining', String(updatedQuota.remaining))

      const response = {
        task: 'flashcards',
        model,
        flashcards,
        savedCount,
        subscription: {
          tier: updatedQuota.tier,
          generationsUsed: updatedQuota.generationsUsed,
          generationsQuota: updatedQuota.generationsQuota,
          remaining: updatedQuota.remaining
        }
      } as const

      if (process.env.NODE_ENV === 'development') {
        LLMGenerateResponse.parse(response)
      }

      // Diagnostics log
      console.info('[llm.generate] Diagnostics', {
        requestedSave: !!save,
        canSave,
        generatedCount: flashcards.length,
        savedCount,
        task,
        model,
        subscription: updatedQuota
      })

      return response
    } else {
      const quiz = await strategy.generateQuiz(text)
      let savedCount: number | undefined
      if (canSave && folderId) {
        if (replace) {
          await prisma.question.deleteMany({ where: { folderId } })
        }
        if (quiz.length) {
          const res = await prisma.question.createMany({
            data: quiz.map(q => ({ folderId, question: q.question, choices: q.choices, answerIndex: q.answerIndex })),
          })
          savedCount = res.count
        } else {
          savedCount = 0
        }
      }
      // Set extra debug headers
      event.node.res.setHeader('x-llm-save-requested', String(!!save))
      event.node.res.setHeader('x-llm-can-save', String(canSave))
      event.node.res.setHeader('x-llm-generated-count', String(quiz.length))
      event.node.res.setHeader('x-llm-saved-count', String(savedCount ?? 0))
      event.node.res.setHeader('x-llm-task', task)

      // Increment the user's generation count if successful and they're on free tier
      const updatedQuota = await incrementGenerationCount(user.id)

      // Update quota headers with latest info
      event.node.res.setHeader('x-subscription-tier', updatedQuota.tier)
      event.node.res.setHeader('x-generations-used', String(updatedQuota.generationsUsed))
      event.node.res.setHeader('x-generations-quota', String(updatedQuota.generationsQuota))
      event.node.res.setHeader('x-generations-remaining', String(updatedQuota.remaining))

      const response = {
        task: 'quiz',
        model,
        quiz,
        savedCount,
        subscription: {
          tier: updatedQuota.tier,
          generationsUsed: updatedQuota.generationsUsed,
          generationsQuota: updatedQuota.generationsQuota,
          remaining: updatedQuota.remaining
        }
      } as const

      if (process.env.NODE_ENV === 'development') {
        LLMGenerateResponse.parse(response)
      }

      // Diagnostics log
      console.info('[llm.generate] Diagnostics', {
        requestedSave: !!save,
        canSave,
        generatedCount: quiz.length,
        savedCount,
        task,
        model,
        subscription: updatedQuota
      })

      return response
    }
  } catch (err: any) {
    // Surface concise error to the client, log details on server
    const provider = model === 'gemini' ? 'google' : 'openai'
    console.error('[llm.generate] strategy error:', err)
    try {
      await logLlmUsage(
        {
          provider: provider as 'openai' | 'google',
          model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          rawUsage: null,
        },
        {
          userId: user.id,
          folderId,
          feature: task,
          status: 'error',
          errorCode: String(err?.status ?? err?.code ?? ''),
          errorMessage: String(err?.message ?? 'unknown error'),
        }
      )
    } catch (logErr) {
      // Swallow logging errors to not mask the original failure
    }
    if (err?.status === 429 || /quota/i.test(err?.message || '')) {
      throw createError({ statusCode: 429, statusMessage: 'Quota exceeded. Please check your OpenAI plan/billing or try again later.' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Generation failed. Please try again or switch model.' })
  }
})
