// shared/llm-generate.contract.ts
import { z } from 'zod'
import { LLMEnum } from './llm'

export const FlashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
})
export type FlashcardDTO = z.infer<typeof FlashcardSchema>

export const QuizQuestionSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).length(4),
  answerIndex: z.number().int().nonnegative(),
}).refine(q => q.answerIndex < q.choices.length, { message: 'answerIndex out of bounds' })
export type QuizQuestionDTO = z.infer<typeof QuizQuestionSchema>

export const TaskEnum = z.enum(['flashcards', 'quiz'])

export const LLMGenerateRequest = z.object({
  model: LLMEnum,
  task: TaskEnum,
  text: z.string().min(1),
  folderId: z.string().optional(),
  save: z.boolean().optional(),
  replace: z.boolean().optional(),
})
export type LLMGenerateRequest = z.infer<typeof LLMGenerateRequest>

// Define subscription schema
export const SubscriptionInfoSchema = z.object({
  tier: z.string(),
  generationsUsed: z.number(),
  generationsQuota: z.number(),
  remaining: z.number(),
})
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>

export const LLMGenerateResponse = z.union([
  z.object({
    task: z.literal('flashcards'),
    model: LLMEnum,
    flashcards: z.array(FlashcardSchema),
    savedCount: z.number().optional(),
    subscription: SubscriptionInfoSchema.optional(),
  }),
  z.object({
    task: z.literal('quiz'),
    model: LLMEnum,
    quiz: z.array(QuizQuestionSchema),
    savedCount: z.number().optional(),
    subscription: SubscriptionInfoSchema.optional(),
  }),
])
export type LLMGenerateResponse = z.infer<typeof LLMGenerateResponse>
