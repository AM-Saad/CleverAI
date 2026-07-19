import FetchFactory from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import {
  CaptureWordResponseSchema,
  GenerateStoryResponseSchema,
  LanguageDeleteResponseSchema,
  LanguageEnrollResponseSchema,
  LanguagePreferencesSchema,
  LanguageQueueResponseSchema,
  LanguageStatsSchema,
  LanguageGradeResponseSchema,
  LanguageWordsResponseSchema,
} from "@shared/utils/language.contract";
import type {
  CaptureWordDTO,
  GenerateStoryDTO,
  SaveLanguageWordDTO,
  LanguageWord,
  LanguageQueueCard,
  LanguageGradeRequest,
  LanguageGradeResponse,
  LanguageDeleteResponse,
  LanguageEnrollResponse,
  LanguageStats,
  CaptureWordResponse,
  GenerateStoryResponse,
  UserLanguagePreferences,
  LanguagePreferencesDTO,
} from "@shared/utils/language.contract";

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

  async saveWord(
    payload: SaveLanguageWordDTO,
  ): Promise<Result<CaptureWordResponse>> {
    return this.call<typeof CaptureWordResponseSchema>(
      "POST",
      `${this.RESOURCE}/words`,
      payload,
      {},
      CaptureWordResponseSchema,
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
    return this.call<typeof LanguageWordsResponseSchema>(
      "GET",
      `${this.RESOURCE}/words${qs ? `?${qs}` : ""}`,
      undefined,
      {},
      LanguageWordsResponseSchema,
    );
  }

  async deleteWord(id: string): Promise<Result<LanguageDeleteResponse>> {
    return this.call<typeof LanguageDeleteResponseSchema>(
      "DELETE",
      `${this.RESOURCE}/words/${id}`,
      undefined,
      {},
      LanguageDeleteResponseSchema,
    );
  }

  async enrollWord(id: string): Promise<Result<LanguageEnrollResponse>> {
    return this.call<typeof LanguageEnrollResponseSchema>(
      "POST",
      `${this.RESOURCE}/words/${id}/enroll`,
      {},
      {},
      LanguageEnrollResponseSchema,
    );
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
    return this.call<typeof LanguagePreferencesSchema>(
      "GET",
      `${this.RESOURCE}/preferences`,
      undefined,
      {},
      LanguagePreferencesSchema,
    );
  }

  async updatePreferences(
    data: Partial<LanguagePreferencesDTO>,
  ): Promise<Result<UserLanguagePreferences>> {
    return this.call<typeof LanguagePreferencesSchema>(
      "PUT",
      `${this.RESOURCE}/preferences`,
      data,
      {},
      LanguagePreferencesSchema,
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
