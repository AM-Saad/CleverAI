import { z } from "zod";
import { SubscriptionInfoSchema } from "./llm-generate.contract";
import type { SubscriptionInfo } from "./llm-generate.contract";

export const LanguageSentenceSchema = z.object({
  text: z.string(),
  clozeWord: z.string(),
  clozeBlank: z.string(),
  clozeIndex: z.number(),
});

export const LanguageWordSchema = z.object({
  id: z.string(),
  word: z.string(),
  translation: z.string(),
  translationLang: z.string(),
  sourceLang: z.string(),
  sourceContext: z.string().optional(),
  sourceType: z.string(),
  status: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const LanguageStorySchema = z.object({
  id: z.string(),
  wordId: z.string(),
  storyText: z.string(),
  sentences: z.array(LanguageSentenceSchema),
  rating: z.number().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const CaptureWordDTO = z.object({
  word: z.string().min(1).max(200),
  sourceContext: z.string().max(500).optional(),
  sourceLang: z.string().optional().default("auto"),
  targetLang: z.string().optional().default("en"),
  sourceType: z
    .enum(["note", "material", "external", "manual"])
    .default("manual"),
  sourceRefId: z.string().optional(),
});

export const GenerateStoryDTO = z.object({
  wordId: z.string().min(1),
  relatedWords: z.array(z.string()).optional().default([]),
});

export const LanguageGradeRequestSchema = z.object({
  cardId: z.string().min(1),
  grade: z.enum(["0", "1", "2", "3", "4", "5"]),
  requestId: z.string().optional(),
});

export const LanguagePreferencesDTO = z.object({
  enabled: z.boolean().optional(),
  targetLanguage: z.string().optional(),
  nativeLanguage: z.string().optional(),
  autoEnroll: z.boolean().optional(),
  sessionCardLimit: z.number().int().min(5).max(50).optional(),
  showConsent: z.boolean().optional(),
});

export const LanguageWordsQuerySchema = z.object({
  status: z.string().optional(),
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
});

export const LanguageStatsSchema = z.object({
  total: z.number(),
  due: z.number(),
  enrolled: z.number(),
  mastered: z.number(),
  streakDays: z.number().optional(),
});

export type LanguageWord = z.infer<typeof LanguageWordSchema>;
export type LanguageStory = z.infer<typeof LanguageStorySchema>;
export type LanguageSentence = z.infer<typeof LanguageSentenceSchema>;
export type CaptureWordDTO = z.infer<typeof CaptureWordDTO>;
export type GenerateStoryDTO = z.infer<typeof GenerateStoryDTO>;
export type LanguageGradeRequest = z.infer<typeof LanguageGradeRequestSchema>;
export type LanguagePreferencesDTO = z.infer<typeof LanguagePreferencesDTO>;
export type LanguageQueueCard = z.infer<typeof LanguageQueueCardSchema>;
export type LanguageGradeResponse = z.infer<typeof LanguageGradeResponseSchema>;
export type LanguageStats = z.infer<typeof LanguageStatsSchema>;

export interface UserLanguagePreferences {
  id: string;
  userId: string;
  enabled: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  autoEnroll: boolean;
  sessionCardLimit: number;
  showConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaptureWordResponse {
  wordId: string;
  word: string;
  translation: string;
  partOfSpeech: string;
  detectedLang: string;
  phonetic?: string;
  /** true when the word was already in the user's deck — no LLM call was made */
  cached?: boolean;
}

export interface GenerateStoryResponse {
  storyId: string;
  storyText: string;
  sentences: LanguageSentence[];
  wordId: string;
  /** Present when story generation consumed a quota slot. */
  subscription?: Pick<SubscriptionInfo, "tier" | "generationsUsed" | "generationsQuota" | "remaining">;
}

export { SubscriptionInfoSchema };
