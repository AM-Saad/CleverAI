import type { ChatMessage, OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";
import { useAIStore } from "./useAIStore";

/**
 * Composable for generative AI using LLMs (Gemma 4, etc.) via Web Worker.
 *
 * Unlike the pipeline-based composables (useTextSummarization, useSpeachToText),
 * this uses the auto-classes API (AutoProcessor + Model.from_pretrained)
 * which supports:
 *  - Chat templates (structured message formatting)
 *  - Multimodal inputs (text + images)
 *  - Token-by-token streaming
 *  - Generation parameters (temperature, top_p, etc.)
 *
 * @example
 * ```ts
 * const { generate, streamedText, isGenerating } = useGenerativeAI();
 *
 * // Simple text prompt
 * const result = await ask("What is 2+2?");
 *
 * // Multimodal with image
 * const result = await generate([{
 *   role: "user",
 *   content: [
 *     { type: "image" },
 *     { type: "text", text: "Describe this image" }
 *   ]
 * }], { imageUrl: "https://..." });
 *
 * // Watch streaming tokens
 * watch(streamedText, (text) => console.log("Streaming:", text));
 * ```
 */
export function useGenerativeAI(options?: {
  modelId?: string;
  modelClass?: string;
  dtype?: string;
  device?: string;
  immediate?: boolean;
}) {
  const { $aiWorker } = useNuxtApp();
  const store = useAIStore("global-ai-store");

  const modelId = options?.modelId || "onnx-community/gemma-4-E2B-it-ONNX";
  const modelClass = options?.modelClass;

  // ── Reactive state ──
  const isGenerating = ref(false);
  const streamedText = ref("");
  const completedText = ref<string | null>(null);
  const generationError = ref<Error | null>(null);
  const webgpuSupported = ref<boolean | null>(null);

  // Track active handlers for cleanup
  const activeHandlers = new Set<{ handler: EventListener; timeout: ReturnType<typeof setTimeout> }>();

  onUnmounted(() => {
    for (const { handler, timeout } of activeHandlers) {
      clearTimeout(timeout);
      window.removeEventListener("ai-worker-message", handler);
    }
    activeHandlers.clear();
  });

  // Use store for reactive model state (download progress, ready state)
  const isDownloading = store.isModelDownloading(modelId);
  const progress = store.getModelProgress(modelId);
  const isReady = store.isModelReady(modelId);

  const generateRequestId = () => `generative-${Date.now()}-${Math.random()}`;

  /**
   * Check if WebGPU is available in the current browser.
   * Gemma 4 requires WebGPU — no WASM fallback.
   */
  async function checkWebGPU(): Promise<boolean> {
    if (webgpuSupported.value !== null) return webgpuSupported.value;

    try {
      const nav = navigator as any;
      if (!nav.gpu) {
        webgpuSupported.value = false;
        return false;
      }
      const adapter = await nav.gpu.requestAdapter();
      webgpuSupported.value = !!adapter;
      return !!adapter;
    } catch {
      webgpuSupported.value = false;
      return false;
    }
  }

  /**
   * Load the generative model (processor + model via auto-classes API).
   * Shows progress in AIModalStatus panel automatically.
   */
  async function loadModel(): Promise<void> {
    // Check WebGPU first
    const gpuOk = await checkWebGPU();
    if (!gpuOk) {
      const err = new Error(
        "WebGPU is not supported in this browser. " +
        "Generative AI models require WebGPU. " +
        "Please use Chrome 113+, Edge 113+, or another WebGPU-capable browser."
      );
      generationError.value = err;
      throw err;
    }

    return store.loadGenerativeModel(modelId, {
      modelClass: modelClass,
      dtype: options?.dtype ?? "q4f16",
      device: options?.device ?? "webgpu",
    });
  }

  /**
   * Generate a response from chat messages with streaming support.
   *
   * @param messages - Chat messages in OpenAI/Gemma format
   * @param genOptions - Generation options (maxNewTokens, temperature, etc.)
   * @returns The complete generated text
   */
  async function generate(
    messages: ChatMessage[],
    genOptions?: {
      maxNewTokens?: number;
      doSample?: boolean;
      temperature?: number;
      topP?: number;
      topK?: number;
      enableThinking?: boolean;
      imageUrl?: string;
      audioUrl?: string;
    }
  ): Promise<string> {
    if (!messages || messages.length === 0) {
      throw new Error("No messages provided for generation");
    }

    // Reset state
    streamedText.value = "";
    completedText.value = null;
    generationError.value = null;

    // Ensure model is loaded
    if (!isReady.value) {
      await loadModel();
    }

    const requestId = generateRequestId();
    isGenerating.value = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          activeHandlers.delete(entry);
          window.removeEventListener("ai-worker-message", handler);
          isGenerating.value = false;
          reject(new Error("Generation timeout (10 minutes)"));
        },
        10 * 60 * 1000 // 10 minute timeout for generation
      );

      const handler = (event: Event) => {
        const message = (event as CustomEvent<OutgoingAIMessage>).detail;

        // Streaming token
        if (
          message.type === AI_WORKER_MESSAGE_TYPES.GENERATION_TOKEN &&
          message.data.requestId === requestId
        ) {
          streamedText.value += message.data.token;
        }

        // Generation complete
        if (
          message.type === AI_WORKER_MESSAGE_TYPES.GENERATION_COMPLETE &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          activeHandlers.delete(entry);
          window.removeEventListener("ai-worker-message", handler);
          isGenerating.value = false;

          const text = message.data.text;
          completedText.value = text;
          resolve(text);
        }

        // Generation error
        if (
          message.type === AI_WORKER_MESSAGE_TYPES.GENERATION_ERROR &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          activeHandlers.delete(entry);
          window.removeEventListener("ai-worker-message", handler);
          isGenerating.value = false;

          const err = new Error(message.data.error);
          generationError.value = err;
          reject(err);
        }
      };

      // eslint-disable-next-line prefer-const
      const entry = { handler: handler as EventListener, timeout };
      activeHandlers.add(entry);
      window.addEventListener("ai-worker-message", handler);

      // Send generation request to worker
      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.RUN_GENERATION,
        data: {
          requestId,
          modelId,
          messages,
          imageUrl: genOptions?.imageUrl,
          audioUrl: genOptions?.audioUrl,
          options: {
            maxNewTokens: genOptions?.maxNewTokens ?? 512,
            doSample: genOptions?.doSample ?? false,
            temperature: genOptions?.temperature,
            topP: genOptions?.topP,
            topK: genOptions?.topK,
            enableThinking: genOptions?.enableThinking ?? false,
          },
        },
      });
    });
  }

  /**
   * Convenience: simple text prompt → response.
   */
  async function ask(
    prompt: string,
    genOptions?: {
      maxNewTokens?: number;
      doSample?: boolean;
      temperature?: number;
      imageUrl?: string;
    }
  ): Promise<string> {
    const content: Array<{ type: "text" | "image"; text?: string }> = [];

    // If imageUrl provided, add image content part
    if (genOptions?.imageUrl) {
      content.push({ type: "image" });
    }

    content.push({ type: "text", text: prompt });

    return generate(
      [{ role: "user", content }],
      genOptions
    );
  }

  /**
   * Retry after error
   */
  async function retry() {
    generationError.value = null;
    return loadModel();
  }

  // Auto-load if immediate flag is set
  if (options?.immediate) {
    onMounted(() => {
      loadModel().catch((err) => {
        console.error("[useGenerativeAI] Auto-load failed:", err);
      });
    });
  }

  return {
    // Generation methods
    generate,
    ask,
    loadModel,
    retry,

    // Streaming state
    streamedText: readonly(streamedText),
    completedText: readonly(completedText),
    isGenerating: readonly(isGenerating),
    generationError: readonly(generationError),

    // Model state (from store)
    isDownloading,
    progress,
    isReady,

    // Capability check
    webgpuSupported: readonly(webgpuSupported),
    checkWebGPU,
  };
}
