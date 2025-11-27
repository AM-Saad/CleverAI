// app/composables/folders/useGatewayGenerate.ts
import type {
  GatewayGenerateRequest,
  GatewayGenerateResponse,
} from "~/shared/utils/llm-generate.contract";

/**
 * Composable for LLM Gateway generation (smart model routing)
 * 
 * @example
 * ```ts
 * const { generate, isGenerating, error } = useGatewayGenerate()
 * 
 * const result = await generate({
 *   task: 'flashcards',
 *   text: 'Study material...',
 *   folderId: 'folder-id',
 *   save: true,
 *   preferredModelId: 'gpt-4o-mini', // optional
 *   requiredCapability: 'text', // optional
 * })
 * ```
 */
export function useGatewayGenerate() {
  const { $api } = useNuxtApp();
  const isGenerating = ref(false);
  const error = ref<string | null>(null);
  const lastResult = ref<GatewayGenerateResponse | null>(null);

  /**
   * Generate flashcards or quiz using gateway routing
   */
  async function generate(
    request: GatewayGenerateRequest
  ): Promise<GatewayGenerateResponse> {
    isGenerating.value = true;
    error.value = null;

    try {
      const gatewayService = $api.gateway;
      const result = await gatewayService.generate(request);

      lastResult.value = result;
      
      console.info('[useGatewayGenerate] Success:', {
        task: result.task,
        modelId: result.selectedModelId,
        provider: result.provider,
        latencyMs: result.latencyMs,
        cached: result.cached,
        count: 'flashcards' in result ? result.flashcards.length : result.quiz.length,
      });

      return result;
    } catch (err: any) {
      const errorMessage =
        err?.data?.message ||
        err?.message ||
        "Failed to generate content. Please try again.";
      
      error.value = errorMessage;
      
      console.error('[useGatewayGenerate] Error:', {
        message: errorMessage,
        status: err?.status,
        statusCode: err?.statusCode,
      });

      throw err;
    } finally {
      isGenerating.value = false;
    }
  }

  /**
   * Generate flashcards specifically
   */
  async function generateFlashcards(
    text: string,
    options?: {
      folderId?: string;
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
    }
  ) {
    return generate({
      task: "flashcards",
      text,
      ...options,
    });
  }

  /**
   * Generate quiz specifically
   */
  async function generateQuiz(
    text: string,
    options?: {
      folderId?: string;
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: "text" | "multimodal" | "reasoning";
    }
  ) {
    return generate({
      task: "quiz",
      text,
      ...options,
    });
  }

  return {
    generate,
    generateFlashcards,
    generateQuiz,
    isGenerating: readonly(isGenerating),
    error: readonly(error),
    lastResult: readonly(lastResult),
  };
}
