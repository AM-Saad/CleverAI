// app/services/GatewayService.ts
import type { $Fetch } from "ofetch";
import FetchFactory from "./FetchFactory";
import type { Result } from "@/types/Result";
import type {
  GatewayGenerateRequest,
  GatewayGenerateResponse,
  GenerationConfig,
} from "~/shared/utils/llm-generate.contract";

/**
 * Material upload response
 */
export interface UploadMaterialResponse {
  materialId: string;
  tokenEstimate: number;
  charCount: number;
  pageCount?: number;
  title: string;
}

/**
 * Gateway Service
 * Handles LLM generation with smart model routing
 */
export default class GatewayService extends FetchFactory {
  private RESOURCE = "/api/llm.gateway";
  private UPLOAD_RESOURCE = "/api/materials/upload";

  constructor(fetcher: $Fetch) {
    super(fetcher);
  }

  /**
   * Upload a file and create a material
   * Returns Result<T> - caller should check .success
   */
  async uploadMaterial(
    file: File,
    folderId: string,
    title?: string
  ): Promise<Result<UploadMaterialResponse>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);
    if (title) formData.append("title", title);

    return this.call<UploadMaterialResponse>(
      "POST",
      this.UPLOAD_RESOURCE,
      formData,
      {
        timeout: 120000, // 2 minutes for large files
      }
    );
  }

  /**
   * Generate flashcards or quiz using gateway routing
   * Gateway automatically selects best model based on cost, latency, and capabilities
   * Throws on error, returns data directly for compatibility with existing composables
   */
  async generate(
    request: GatewayGenerateRequest
  ): Promise<GatewayGenerateResponse> {
    const result = await this.call<GatewayGenerateResponse>(
      "POST",
      this.RESOURCE,
      request,
      {
        // Add timeout for long-running LLM requests
        timeout: 60000, // 60 seconds
      }
    );

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Generate flashcards using gateway
   */
  async generateFlashcards(
    text: string,
    options?: {
      folderId?: string;
      materialId?: string;
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
      generationConfig?: GenerationConfig;
    }
  ): Promise<GatewayGenerateResponse> {
    return this.generate({
      task: "flashcards",
      text,
      ...options,
    });
  }

  /**
   * Generate quiz using gateway
   */
  async generateQuiz(
    text: string,
    options?: {
      folderId?: string;
      materialId?: string;
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
      generationConfig?: GenerationConfig;
    }
  ): Promise<GatewayGenerateResponse> {
    return this.generate({
      task: "quiz",
      text,
      ...options,
    });
  }
}
