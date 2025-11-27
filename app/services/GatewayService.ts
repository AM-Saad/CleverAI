// app/services/GatewayService.ts
import type { $Fetch } from "ofetch";
import FetchFactory from "./FetchFactory";
import type {
  GatewayGenerateRequest,
  GatewayGenerateResponse,
} from "~/shared/utils/llm-generate.contract";

/**
 * Gateway Service
 * Handles LLM generation with smart model routing
 */
export default class GatewayService extends FetchFactory {
  private RESOURCE = "/api/llm.gateway";

  constructor(fetcher: $Fetch) {
    super(fetcher);
  }

  /**
   * Generate flashcards or quiz using gateway routing
   * Gateway automatically selects best model based on cost, latency, and capabilities
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
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
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
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
    }
  ): Promise<GatewayGenerateResponse> {
    return this.generate({
      task: "quiz",
      text,
      ...options,
    });
  }
}
