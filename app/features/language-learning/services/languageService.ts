import FetchFactory from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import {
  LanguageStatsSchema,
  LanguageGradeResponseSchema,
  LanguageQueueCardSchema,
} from "@shared/utils/language.contract";
import { SubscriptionInfoSchema } from "@shared/utils/llm-generate.contract";
import type {
  CaptureWordDTO,
  GenerateStoryDTO,
  LanguageWord,
  LanguageQueueCard,
  LanguageGradeRequest,
  LanguageGradeResponse,
  LanguageStats,
  CaptureWordResponse,
  GenerateStoryResponse,
  UserLanguagePreferences,
  LanguagePreferencesDTO,
} from "@shared/utils/language.contract";
import { z } from "zod";

const CaptureWordResponseSchema = z.object({
  wordId: z.string().optional(),
  translationId: z.string().optional(),
  word: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  detectedLang: z.string(),
  phonetic: z.string().optional(),
  meanings: z
    .array(
      z.object({
        definition: z.string(),
        translation: z.string().optional(),
        example: z.string().optional(),
        partOfSpeech: z.string().optional(),
        category: z.string().optional(),
        register: z.string().optional(),
      }),
    )
    .optional(),
  examples: z
    .array(
      z.object({
        text: z.string(),
        translation: z.string().optional(),
      }),
    )
    .optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  isPhrase: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  saved: z.boolean(),
  status: z.string().optional(),
  cached: z.boolean().optional(),
  sharedCacheHit: z.boolean().optional(),
});

const GenerateStoryResponseSchema = z.object({
  storyId: z.string(),
  storyText: z.string(),
  sentences: z.array(
    z.object({
      text: z.string(),
      clozeWord: z.string(),
      clozeBlank: z.string(),
      clozeIndex: z.number(),
    }),
  ),
  wordId: z.string(),
  subscription: SubscriptionInfoSchema.optional(),
});

const LanguageQueueResponseSchema = z.object({
  cards: z.array(LanguageQueueCardSchema),
});

const PreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  enabled: z.boolean(),
  targetLanguage: z.string(),
  nativeLanguage: z.string(),
  autoEnroll: z.boolean(),
  sessionCardLimit: z.number(),
  showConsent: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export class LanguageService extends FetchFactory {
  private readonly RESOURCE = "/api/language";

  async captureWord(
    payload: CaptureWordDTO,
  ): Promise<Result<CaptureWordResponse>> {
    return this.call<typeof CaptureWordResponseSchema>(
      "POST",
      `${this.RESOURCE}/translate`,
      payload,
      {},
      CaptureWordResponseSchema,
    );
  }

  async generateStory(
    payload: GenerateStoryDTO,
  ): Promise<Result<GenerateStoryResponse>> {
    return this.call<typeof GenerateStoryResponseSchema>(
      "POST",
      `${this.RESOURCE}/generate-story`,
      payload,
      {},
      GenerateStoryResponseSchema,
    );
  }

  async getWords(params?: {
    status?: string;
    category?: string;
    hasStory?: boolean;
    search?: string;
    targetLanguage?: string;
    nativeLanguage?: string;
    limit?: number;
    cursor?: string;
  }): Promise<
    Result<{
      words: LanguageWord[];
      nextCursor: string | null;
      categories?: string[];
      totalWords?: number;
      statusCounts?: Record<string, number>;
    }>
  > {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.category) query.set("category", params.category);
    if (typeof params?.hasStory === "boolean") {
      query.set("hasStory", String(params.hasStory));
    }
    if (params?.search) query.set("search", params.search);
    if (params?.targetLanguage) {
      query.set("targetLanguage", params.targetLanguage);
    }
    if (params?.nativeLanguage) {
      query.set("nativeLanguage", params.nativeLanguage);
    }
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    return this.call(
      "GET",
      `${this.RESOURCE}/words${qs ? `?${qs}` : ""}`,
      undefined,
      {},
    );
  }

  async deleteWord(id: string): Promise<Result<{ message: string }>> {
    return this.call("DELETE", `${this.RESOURCE}/words/${id}`, undefined, {});
  }

  async enrollWord(
    id: string,
  ): Promise<Result<{ wordId: string; status: string }>> {
    return this.call("POST", `${this.RESOURCE}/words/${id}/enroll`, {}, {});
  }

  async getQueue(params?: {
    limit?: number;
    targetLanguage?: string;
    nativeLanguage?: string;
  }): Promise<Result<{ cards: LanguageQueueCard[] }>> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.targetLanguage) {
      query.set("targetLanguage", params.targetLanguage);
    }
    if (params?.nativeLanguage) {
      query.set("nativeLanguage", params.nativeLanguage);
    }
    const qs = query.toString();
    return this.call<typeof LanguageQueueResponseSchema>(
      "GET",
      `${this.RESOURCE}/queue${qs ? `?${qs}` : ""}`,
      undefined,
      {},
      LanguageQueueResponseSchema,
    );
  }

  async gradeCard(
    payload: LanguageGradeRequest,
  ): Promise<Result<LanguageGradeResponse>> {
    return this.call<typeof LanguageGradeResponseSchema>(
      "POST",
      `${this.RESOURCE}/grade`,
      payload,
      {},
      LanguageGradeResponseSchema,
    );
  }

  async getPreferences(): Promise<Result<UserLanguagePreferences>> {
    return this.call<typeof PreferencesSchema>(
      "GET",
      `${this.RESOURCE}/preferences`,
      undefined,
      {},
      PreferencesSchema,
    );
  }

  async updatePreferences(
    data: Partial<LanguagePreferencesDTO>,
  ): Promise<Result<UserLanguagePreferences>> {
    return this.call<typeof PreferencesSchema>(
      "PUT",
      `${this.RESOURCE}/preferences`,
      data,
      {},
      PreferencesSchema,
    );
  }

  async getStats(params?: {
    targetLanguage?: string;
    nativeLanguage?: string;
  }): Promise<Result<LanguageStats>> {
    const query = new URLSearchParams();
    if (params?.targetLanguage) {
      query.set("targetLanguage", params.targetLanguage);
    }
    if (params?.nativeLanguage) {
      query.set("nativeLanguage", params.nativeLanguage);
    }
    const qs = query.toString();
    return this.call<typeof LanguageStatsSchema>(
      "GET",
      `${this.RESOURCE}/stats${qs ? `?${qs}` : ""}`,
      undefined,
      {},
      LanguageStatsSchema,
    );
  }
}
