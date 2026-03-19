import type { OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";
import { useAIStore } from "./useAIStore";

/**
 * Composable for text summarization using AI models via Web Worker
 *
 * ARCHITECTURE NOTE: Uses the AI Worker (sw-src/ai-worker.ts) to run heavy
 * ONNX inference (5-30 seconds) off the main thread, keeping UI responsive.
 *
 * @example
 * ```ts
 * const { summarize, isLoading, error } = useTextSummarization();
 *
 * const summary = await summarize('Long text to summarize...');
 * console.log(summary);
 * ```
 */
export function useSpeachToText(options?: {
  modelId?: string;
  immediate?: boolean;
}) {
  const { $aiWorker } = useNuxtApp();
  const store = useAIStore("global-ai-store");
  const { loadModel } = store;
  const modelId = options?.modelId || "Xenova/realtime-whisper-webgpu";
  const task = "automatic-speech-recognition";

  const isRecognizing = ref(false);
  const currentSummary = ref<string | null>(null);
  const error = ref<Error | null>(null);
  const recognitionError = ref<Error | null>(null);

  // Use store abstractions for reactive model state
  const isDownloading = store.isModelDownloading(modelId);
  const progress = store.getModelProgress(modelId);
  const isReady = store.isModelReady(modelId);

  // Generate unique request IDs
  const generateRequestId = () => `${task}-${Date.now()}-${Math.random()}`;

  /**
   * Summarize a piece of text (non-blocking via worker)
   */
  async function summarize(
    text: string,
    options?: {
      maxLength?: number;
      minLength?: number;
    }
  ): Promise<void> {
    if (!text || !text.trim()) {
      throw new Error("No text provided to summarize");
    }

    // Reset state
    currentSummary.value = null;
    recognitionError.value = null;

    // Ensure model is loaded (loadModel handles caching internally)
    await loadModel(modelId, task);

    const requestId = generateRequestId();
    isRecognizing.value = true;

    // return new Promise((resolve, reject) => {
    //   const timeout = setTimeout(
    //     () => {
    //       isRecognizing.value = false;
    //       reject(new Error("Summarization timeout"));
    //     },
    //     2 * 60 * 1000
    //   ); // 2 minute timeout

    //   const handler = (event: Event) => {
    //     const message = (event as CustomEvent<OutgoingAIMessage>).detail;

    //     if (
    //       message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE &&
    //       message.data.requestId === requestId
    //     ) {
    //       clearTimeout(timeout);
    //       window.removeEventListener("ai-worker-message", handler);
    //       isRecognizing.value = false;

    //       // Extract summary text from result
    //       const result = message.data.result as
    //         | { summary_text: string }
    //         | Array<{ summary_text: string }>;
    //       const summary = Array.isArray(result)
    //         ? result[0]?.summary_text
    //         : result?.summary_text;

    //       if (!summary) {
    //         const err = new Error("No summary generated");
    //         recognitionError.value = err;
    //         reject(err);
    //         return;
    //       }

    //       console.log("Generated summary:", summary);
    //       currentSummary.value = summary;
    //       resolve(summary);
    //     } else if (
    //       message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR &&
    //       message.data.requestId === requestId
    //     ) {
    //       clearTimeout(timeout);
    //       window.removeEventListener("ai-worker-message", handler);
    //       isRecognizing.value = false;

    //       const err = new Error(message.data.error);
    //       recognitionError.value = err;
    //       reject(err);
    //     }
    //   };

    //   window.addEventListener("ai-worker-message", handler);

    //   // Send inference request to worker
    //   $aiWorker.postMessage({
    //     type: AI_WORKER_MESSAGE_TYPES.RUN_INFERENCE,
    //     data: {
    //       requestId,
    //       modelId,
    //       task,
    //       input: text,
    //       options: {
    //         max_length: options?.maxLength || 130,
    //         min_length: options?.minLength || 30,
    //         do_sample: false,
    //       },
    //     },
    //   });
    // });
  }

  /**
   * Start recognition without awaiting (non-blocking)
   */
  function startRecognition(
    text: string,
    options?: {
      maxLength?: number;
      minLength?: number;
    }
  ) {
    // Fire and forget - don't await
    // summarize(text, options).catch((err) => {
    //   console.error("Background recognition failed:", err);
    // });
  }

  /**
   * Retry after error
   */
  async function retry() {
    error.value = null;
    recognitionError.value = null;
    return loadModel(modelId, task);
  }

  return {
    summarize,
    startRecognition,
    currentSummary: readonly(currentSummary),
    isRecognizing: readonly(isRecognizing),
    error: readonly(error),
    recognitionError: readonly(recognitionError),
    // Reactive computed refs from store
    isDownloading,
    progress,
    isReady,
    retry,
  };
}
