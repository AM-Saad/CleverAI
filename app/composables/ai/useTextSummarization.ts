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
export function useTextSummarization(options?: {
  modelId?: string;
  immediate?: boolean;
}) {
  const { $aiWorker } = useNuxtApp();
  const store = useAIStore("global-ai-store");
  const { loadModel } = store;
  const modelId = options?.modelId || "Xenova/distilbart-cnn-6-6";
  const task = "summarization";

  const isSummarizing = ref(false);
  const currentSummary = ref<string | null>(null);
  const error = ref<Error | null>(null);
  const summaryError = ref<Error | null>(null);

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
  ): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error("No text provided to summarize");
    }

    // Reset state
    currentSummary.value = null;
    summaryError.value = null;

    // Ensure model is loaded (loadModel handles caching internally)
    await loadModel(modelId, task);

    const requestId = generateRequestId();
    isSummarizing.value = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          isSummarizing.value = false;
          reject(new Error("Summarization timeout"));
        },
        2 * 60 * 1000
      ); // 2 minute timeout

      const handler = (event: Event) => {
        const message = (event as CustomEvent<OutgoingAIMessage>).detail;

        if (
          message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          isSummarizing.value = false;

          // Extract summary text from result
          const result = message.data.result as
            | { summary_text: string }
            | Array<{ summary_text: string }>;
          const summary = Array.isArray(result)
            ? result[0]?.summary_text
            : result?.summary_text;

          if (!summary) {
            const err = new Error("No summary generated");
            summaryError.value = err;
            reject(err);
            return;
          }

          console.log("Generated summary:", summary);
          currentSummary.value = summary;
          resolve(summary);
        } else if (
          message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          isSummarizing.value = false;

          const err = new Error(message.data.error);
          summaryError.value = err;
          reject(err);
        }
      };

      window.addEventListener("ai-worker-message", handler);

      // Send inference request to worker
      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.RUN_INFERENCE,
        data: {
          requestId,
          modelId,
          task,
          input: text,
          options: {
            max_length: options?.maxLength || 130,
            min_length: options?.minLength || 30,
            do_sample: false,
          },
        },
      });
    });
  }

  /**
   * Start summarization without awaiting (non-blocking)
   */
  function startSummarization(
    text: string,
    options?: {
      maxLength?: number;
      minLength?: number;
    }
  ) {
    // Fire and forget - don't await
    summarize(text, options).catch((err) => {
      console.error("Background summarization failed:", err);
    });
  }

  /**
   * Retry after error
   */
  async function retry() {
    error.value = null;
    summaryError.value = null;
    return loadModel(modelId, task);
  }

  return {
    summarize,
    startSummarization,
    currentSummary: readonly(currentSummary),
    isSummarizing: readonly(isSummarizing),
    error: readonly(error),
    summaryError: readonly(summaryError),
    // Reactive computed refs from store
    isDownloading,
    progress,
    isReady,
    retry,
  };
}
