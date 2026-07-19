import { z } from "zod";
import { SubscriptionInfoSchema } from "./llm-generate.contract";
import type { SubscriptionInfo } from "./llm-generate.contract";

export const SUPPORTED_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
] as const;

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGE_OPTIONS.map(
  (language) => language.value,
);

export const SupportedLanguageCodeSchema = z.enum([
  "en",
  "ar",
  "es",
  "fr",
  "de",
  "it",
]);

export type SupportedLanguageCode = z.infer<typeof SupportedLanguageCodeSchema>;

export const getLanguageLabel = (code: string) =>
  SUPPORTED_LANGUAGE_OPTIONS.find((language) => language.value === code)
    ?.label ?? code;

export const LanguageSentenceSchema = z.object({
  text: z.string(),
  clozeWord: z.string(),
  clozeBlank: z.string(),
  clozeIndex: z.number(),
});

export const LanguageStorySchema = z.object({
  id: z.string(),
  wordId: z.string(),
  storyText: z.string(),
  sentences: z.array(LanguageSentenceSchema),
  rating: z.number().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const LanguageStoryPreviewSchema = z.object({
  id: z.string(),
  storyText: z.string(),
  sentences: z.array(LanguageSentenceSchema),
});

export const LanguageWordStatusSchema = z.enum([
  "captured",
  "story_ready",
  "enrolled",
  "mastered",
]);
export type LanguageWordStatus = z.infer<typeof LanguageWordStatusSchema>;

export const LanguageMeaningSchema = z.object({
  definition: z.string(),
  translation: z.string().optional(),
  example: z.string().optional(),
  partOfSpeech: z.string().optional(),
  category: z.string().optional(),
  register: z.string().optional(),
});

export const LanguageExampleSchema = z.object({
  text: z.string(),
  translation: z.string().optional(),
});

export const LanguageWordSchema = z.object({
  id: z.string(),
  translationId: z.string().nullable().optional(),
  word: z.string(),
  translation: z.string(),
  translationLang: z.string(),
  sourceLang: z.string(),
  sourceContext: z.string().optional(),
  sourceType: z.string(),
  partOfSpeech: z.string().optional(),
  phonetic: z.string().nullable().optional(),
  meanings: z.array(LanguageMeaningSchema).optional(),
  examples: z.array(LanguageExampleSchema).optional(),
  category: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  isPhrase: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  stories: z.array(LanguageStoryPreviewSchema).optional(),
  status: LanguageWordStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CaptureWordDTO = z.object({
  word: z.string().min(1).max(200),
  sourceContext: z.string().max(500).optional(),
  sourceLang: z.string().optional().default("auto"),
  targetLang: SupportedLanguageCodeSchema.optional().default("en"),
  includeTranslation: z.boolean().optional().default(true),
  translateOnly: z.boolean().optional().default(false),
  forceRetranslate: z.boolean().optional().default(false),
  sourceType: z
    .enum(["note", "material", "external", "manual"])
    .default("manual"),
  sourceRefId: z.string().optional(),
});

export const GenerateStoryDTO = z.object({
  wordId: z.string().min(1),
  relatedWords: z.array(z.string()).optional().default([]),
});

export const SaveLanguageWordDTO = z.object({
  translationId: z.string().min(1),
  sourceContext: z.string().max(500).optional(),
  sourceType: z
    .enum(["note", "material", "external", "manual"])
    .default("manual"),
  sourceRefId: z.string().optional(),
});

export const LanguageGradeRequestSchema = z.object({
  cardId: z.string().min(1),
  grade: z.enum(["0", "1", "2", "3", "4", "5"]),
  requestId: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
});

export const LanguagePreferencesDTO = z.object({
  enabled: z.boolean().optional(),
  targetLanguage: SupportedLanguageCodeSchema.optional(),
  nativeLanguage: SupportedLanguageCodeSchema.optional(),
  translateOnCapture: z.boolean().optional(),
  autoEnroll: z.boolean().optional(),
  sessionCardLimit: z.number().int().min(5).max(50).optional(),
  showConsent: z.boolean().optional(),
});

export const LanguageWordsQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  hasStory: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  search: z.string().max(100).optional(),
  targetLanguage: SupportedLanguageCodeSchema.optional(),
  nativeLanguage: SupportedLanguageCodeSchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export const LanguageQueueCardSchema = z.object({
  cardId: z.string(),
  wordId: z.string(),
  word: z.string(),
  translation: z.string(),
  sourceLang: z.string(),
  translationLang: z.string(),
  storyId: z.string().nullable().optional(),
  storyText: z.string().nullable().optional(),
  sentences: z.array(LanguageSentenceSchema).nullable().optional(),
  mode: z.enum(["story_cloze", "word_translation"]).default("word_translation"),
  reviewState: z.object({
    intervalDays: z.number(),
    easeFactor: z.number(),
    repetitions: z.number(),
    nextReviewAt: z.coerce.date(),
    lastGrade: z.number().nullable().optional(),
    streak: z.number(),
  }),
});

export const LanguageGradeResponseSchema = z.object({
  nextReviewAt: z.string(),
  intervalDays: z.number(),
  easeFactor: z.number(),
  xpEarned: z.number(),
  projection: z
    .array(
      z.object({
        entity: z.enum(["languageWord", "languageReview"]),
        entityId: z.string(),
        version: z.number().int().nonnegative(),
        canonical: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
});

export const LanguageStatsSchema = z.object({
  total: z.number(),
  due: z.number(),
  enrolled: z.number(),
  mastered: z.number(),
  streakDays: z.number().optional(),
});

export const CaptureWordResponseSchema = z.object({
  wordId: z.string().optional(),
  translationId: z.string().optional(),
  word: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  detectedLang: z.string(),
  phonetic: z.string().optional(),
  meanings: z.array(LanguageMeaningSchema).optional(),
  examples: z.array(LanguageExampleSchema).optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  isPhrase: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  saved: z.boolean(),
  status: LanguageWordStatusSchema.optional(),
  cached: z.boolean().optional(),
  sharedCacheHit: z.boolean().optional(),
  projection: z
    .array(
      z.object({
        entity: z.enum(["languageWord", "languageReview"]),
        entityId: z.string(),
        version: z.number().int().nonnegative(),
        canonical: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
});

export const GenerateStoryResponseSchema = z.object({
  storyId: z.string(),
  storyText: z.string(),
  sentences: z.array(LanguageSentenceSchema),
  wordId: z.string(),
  language: z.string(),
  subscription: SubscriptionInfoSchema.optional(),
  projection: CaptureWordResponseSchema.shape.projection,
});

export const LanguageQueueResponseSchema = z.object({
  cards: z.array(LanguageQueueCardSchema),
});

export const LanguagePreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  enabled: z.boolean(),
  targetLanguage: SupportedLanguageCodeSchema,
  nativeLanguage: SupportedLanguageCodeSchema,
  translateOnCapture: z.boolean(),
  autoEnroll: z.boolean(),
  sessionCardLimit: z.number().int().min(5).max(50),
  showConsent: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  offlineVersion: z.number().int().nonnegative().optional(),
});

export const LanguageWordsResponseSchema = z.object({
  words: z.array(LanguageWordSchema),
  nextCursor: z.string().nullable(),
  categories: z.array(z.string()).optional(),
  totalWords: z.number().optional(),
  statusCounts: z.record(z.string(), z.number()).optional(),
});

export const LanguageDeleteResponseSchema = z.object({
  message: z.string(),
  projection: CaptureWordResponseSchema.shape.projection,
});

export const LanguageEnrollResponseSchema = z.object({
  wordId: z.string(),
  status: LanguageWordStatusSchema,
  reviewId: z.string().optional(),
  storyId: z.string().nullable().optional(),
  projection: CaptureWordResponseSchema.shape.projection,
});

export type LanguageWord = z.infer<typeof LanguageWordSchema>;
export type LanguageStory = z.infer<typeof LanguageStorySchema>;
export type LanguageStoryPreview = z.infer<typeof LanguageStoryPreviewSchema>;
export type LanguageSentence = z.infer<typeof LanguageSentenceSchema>;
export type LanguageMeaning = z.infer<typeof LanguageMeaningSchema>;
export type LanguageExample = z.infer<typeof LanguageExampleSchema>;
export type CaptureWordDTO = z.infer<typeof CaptureWordDTO>;
export type GenerateStoryDTO = z.infer<typeof GenerateStoryDTO>;
export type SaveLanguageWordDTO = z.infer<typeof SaveLanguageWordDTO>;
export type LanguageGradeRequest = z.infer<typeof LanguageGradeRequestSchema>;
export type LanguagePreferencesDTO = z.infer<typeof LanguagePreferencesDTO>;
export type LanguageQueueCard = z.infer<typeof LanguageQueueCardSchema>;
export type LanguageGradeResponse = z.infer<typeof LanguageGradeResponseSchema>;
export type LanguageDeleteResponse = z.infer<
  typeof LanguageDeleteResponseSchema
>;
export type LanguageEnrollResponse = z.infer<
  typeof LanguageEnrollResponseSchema
>;
export type LanguageStats = z.infer<typeof LanguageStatsSchema>;

export interface UserLanguagePreferences {
  id: string;
  userId: string;
  enabled: boolean;
  targetLanguage: SupportedLanguageCode;
  nativeLanguage: SupportedLanguageCode;
  translateOnCapture: boolean;
  autoEnroll: boolean;
  sessionCardLimit: number;
  showConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
  offlineVersion?: number;
}

export interface CaptureWordResponse {
  wordId?: string;
  translationId?: string;
  word: string;
  translation: string;
  partOfSpeech: string;
  detectedLang: string;
  phonetic?: string;
  meanings?: LanguageMeaning[];
  examples?: LanguageExample[];
  category?: string;
  difficulty?: string;
  isPhrase?: boolean;
  metadata?: Record<string, unknown>;
  saved: boolean;
  status?: string;
  /** true when the word was already in the user's deck — no LLM call was made */
  cached?: boolean;
  /** true when the lexical data came from the shared translation pool */
  sharedCacheHit?: boolean;
  projection?: Array<{
    entity: "languageWord" | "languageReview";
    entityId: string;
    version: number;
    canonical: Record<string, unknown>;
  }>;
}

export interface GenerateStoryResponse {
  storyId: string;
  storyText: string;
  sentences: LanguageSentence[];
  wordId: string;
  /** ISO code of the learned language used for story text and sentences. */
  language: string;
  /** Present when story generation consumed a quota slot. */
  subscription?: Pick<
    SubscriptionInfo,
    "tier" | "generationsUsed" | "generationsQuota" | "remaining"
  >;
  projection?: CaptureWordResponse["projection"];
}
