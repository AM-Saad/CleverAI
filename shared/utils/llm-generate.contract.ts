// shared/llm-generate.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";

// Source metadata for Context Bridge feature
export const SourceMetadataSchema = z.object({
  anchor: z.string(), // blockId for notes, page number for PDFs
  contextSnippet: z.string().optional(), // For fuzzy matching
}).optional();

export const FlashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
  sourceMetadata: SourceMetadataSchema,
});
export type FlashcardDTO = z.infer<typeof FlashcardSchema>;

export const QuizQuestionSchema = z
  .object({
    question: z.string(),
    choices: z.array(z.string()).length(4),
    answerIndex: z.number().int().nonnegative(),
    sourceMetadata: SourceMetadataSchema,
  })
  .refine((q) => q.answerIndex < q.choices.length, {
    message: "answerIndex out of bounds",
  });
export type QuizQuestionDTO = z.infer<typeof QuizQuestionSchema>;

export const TaskEnum = z.enum(["flashcards", "quiz"]);

export const LLMGenerateRequest = z.object({
  model: LLMEnum,
  task: TaskEnum,
  text: z.string().min(1),
  folderId: z.string().optional(),
  save: z.boolean().optional(),
  replace: z.boolean().optional(),
});
export type LLMGenerateRequest = z.infer<typeof LLMGenerateRequest>;

// Define subscription schema
export const SubscriptionInfoSchema = z.object({
  tier: z.string(),
  generationsUsed: z.number(),
  generationsQuota: z.number(),
  remaining: z.number(),
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

export const LLMGenerateResponse = z.union([
  z.object({
    task: z.literal("flashcards"),
    model: LLMEnum,
    flashcards: z.array(FlashcardSchema),
    savedCount: z.number().optional(),
    subscription: SubscriptionInfoSchema.optional(),
  }),
  z.object({
    task: z.literal("quiz"),
    model: LLMEnum,
    quiz: z.array(QuizQuestionSchema),
    savedCount: z.number().optional(),
    subscription: SubscriptionInfoSchema.optional(),
  }),
]);
export type LLMGenerateResponse = z.infer<typeof LLMGenerateResponse>;

// ==========================================
// Gateway Contracts
// ==========================================

/**
 * Generation configuration for adaptive flashcard/quiz creation
 */
export const GenerationConfigSchema = z.object({
  depth: z.enum(["quick", "balanced", "deep"]).default("balanced"),
  maxItems: z.number().int().positive().optional(), // Override computed item count
});
export type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

/**
 * Gateway request schema - extends base generation with routing options
 */
export const GatewayGenerateRequest = z
  .object({
    task: TaskEnum,
    text: z.string().min(10).max(100000).optional(), // Optional if materialId provided
    folderId: z.string().optional(),
    materialId: z.string().optional(), // Generate from specific material
    save: z.boolean().optional(),
    replace: z.boolean().optional(),
    // Gateway-specific options:
    preferredModelId: z.string().optional(), // e.g., 'gpt-4o-mini', 'gemini-flash-8b'
    requiredCapability: z.enum(["text", "multimodal", "reasoning"]).optional(),
    generationConfig: GenerationConfigSchema.optional(), // Adaptive generation config
  })
  .refine((data) => data.text || data.materialId, {
    message: "Either text or materialId must be provided",
  });
export type GatewayGenerateRequest = z.infer<typeof GatewayGenerateRequest>;

/**
 * Gateway response schema - includes routing metadata
 */
export const GatewayGenerateResponse = z.union([
  z.object({
    task: z.literal("flashcards"),
    flashcards: z.array(FlashcardSchema),
    savedCount: z.number().optional(),
    deletedCount: z.number().optional(), // For regeneration: how many old items were deleted
    deletedReviewsCount: z.number().optional(), // For regeneration: how many CardReviews were deleted
    subscription: SubscriptionInfoSchema.optional(),
    // Gateway metadata:
    requestId: z.string(),
    selectedModelId: z.string(),
    provider: z.string(),
    latencyMs: z.number(),
    cached: z.boolean(),
    routingScore: z.number().optional(),
    itemCount: z.number().optional(), // Number of items generated (adaptive)
    tokenEstimate: z.number().optional(), // Estimated tokens for input
  }),
  z.object({
    task: z.literal("quiz"),
    quiz: z.array(QuizQuestionSchema),
    savedCount: z.number().optional(),
    deletedCount: z.number().optional(), // For regeneration: how many old items were deleted
    deletedReviewsCount: z.number().optional(), // For regeneration: how many CardReviews were deleted
    subscription: SubscriptionInfoSchema.optional(),
    // Gateway metadata:
    requestId: z.string(),
    selectedModelId: z.string(),
    provider: z.string(),
    latencyMs: z.number(),
    cached: z.boolean(),
    routingScore: z.number().optional(),
    itemCount: z.number().optional(), // Number of items generated (adaptive)
    tokenEstimate: z.number().optional(), // Estimated tokens for input
  }),
]);
export type GatewayGenerateResponse = z.infer<typeof GatewayGenerateResponse>;
