import FetchFactory from "./FetchFactory";
import type { Result } from "~/types/Result";
import {
  LanguageStatsSchema,
  LanguageGradeResponseSchema,
  SubscriptionInfoSchema,
} from "@shared/utils/language.contract";
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
  wordId: z.string(),
  word: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  detectedLang: z.string(),
  phonetic: z.string().optional(),
  cached: z.boolean().optional(),
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
    })
  ),
  wordId: z.string(),
  subscription: SubscriptionInfoSchema.optional(),
});

const LanguageQueueResponseSchema = z.object({
  cards: z.array(z.any()),
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

  async captureWord(payload: CaptureWordDTO): Promise<Result<CaptureWordResponse>> {
    return this.call(
      "POST",
      `${this.RESOURCE}/translate`,
      payload,
      {},
      CaptureWordResponseSchema
    );
  }

  async generateStory(payload: GenerateStoryDTO): Promise<Result<GenerateStoryResponse>> {
    return this.call(
      "POST",
      `${this.RESOURCE}/generate-story`,
      payload,
      {},
      GenerateStoryResponseSchema
    );
  }

  async getWords(params?: { status?: string; limit?: number }): Promise<Result<{ words: LanguageWord[]; nextCursor: string | null }>> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.call("GET", `${this.RESOURCE}/words${qs ? `?${qs}` : ""}`, undefined, {});
  }

  async deleteWord(id: string): Promise<Result<{ message: string }>> {
    return this.call("DELETE", `${this.RESOURCE}/words/${id}`, undefined, {});
  }

  async enrollWord(id: string): Promise<Result<{ wordId: string; status: string }>> {
    return this.call("POST", `${this.RESOURCE}/words/${id}/enroll`, {}, {});
  }

  async getQueue(): Promise<Result<{ cards: LanguageQueueCard[] }>> {
    return this.call("GET", `${this.RESOURCE}/queue`, undefined, {}, LanguageQueueResponseSchema);
  }

  async gradeCard(payload: LanguageGradeRequest): Promise<Result<LanguageGradeResponse>> {
    return this.call(
      "POST",
      `${this.RESOURCE}/grade`,
      payload,
      {},
      LanguageGradeResponseSchema
    );
  }

  async getPreferences(): Promise<Result<UserLanguagePreferences>> {
    return this.call("GET", `${this.RESOURCE}/preferences`, undefined, {}, PreferencesSchema);
  }

  async updatePreferences(data: Partial<LanguagePreferencesDTO>): Promise<Result<UserLanguagePreferences>> {
    return this.call("PUT", `${this.RESOURCE}/preferences`, data, {}, PreferencesSchema);
  }

  async getStats(): Promise<Result<LanguageStats>> {
    return this.call("GET", `${this.RESOURCE}/stats`, undefined, {}, LanguageStatsSchema);
  }
}
