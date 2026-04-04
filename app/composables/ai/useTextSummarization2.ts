import { Client, handle_file } from "@gradio/client";
import { ref, readonly } from "vue";

/**
 * Composable for image-to-text generation using Qwen3-VL via Gradio API.
 * Replaces worker-based ONNX inference with remote API calls.
 */
export function useTextSummarization(options?: {
  modelId?: string; // Default: "Qwen/Qwen3-VL-Demo"
}) {
  const modelId = options?.modelId || "Qwen/Qwen3-VL-Demo";

  const isSummarizing = ref(false);
  const currentSummary = ref<string | null>(null);
  const summaryError = ref<Error | null>(null);

  /**
   * Performs inference using the Gradio JS Client.
   * Logic matches your original promise-based structure but swaps Worker for API.
   */
  async function summarize(
    imageInput: string | File | Blob,
    prompt: string = "Describe this image."
  ): Promise<string> {
    if (!imageInput) throw new Error("No image provided");

    isSummarizing.value = true;
    summaryError.value = null;
    currentSummary.value = null;

    try {
      // 1. Connect to the hosted Space
      const app = await Client.connect(modelId);

      // 2. Run Inference
      // Qwen3-VL-Demo typically uses a '/predict' or '/chat' endpoint.
      // We use handle_file to process URLs or local Blobs correctly.
      const result = await app.predict("/predict", [
        // handle_file(imageInput),
        prompt
      ]);

      // 3. Extract Result (Standard Gradio data format is result.data[0])
      const summary = Array.isArray(result.data) ? result.data[0] : result.data;

      if (!summary) throw new Error("No response generated from model");

      currentSummary.value = summary as string;
      return summary as string;
    } catch (err: any) {
      summaryError.value = err;
      throw err;
    } finally {
      isSummarizing.value = false;
    }
  }

  function startSummarization(imageInput: string | File, prompt?: string) {
    summarize(imageInput, prompt).catch((err) => {
      console.error("Background task failed:", err);
    });
  }

  return {
    summarize,
    startSummarization,
    currentSummary: readonly(currentSummary),
    isSummarizing: readonly(isSummarizing),
    summaryError: readonly(summaryError),
    // Mocked store states since API doesn't require "downloading"
    isDownloading: ref(false),
    progress: ref(100),
    isReady: ref(true),
    retry: () => Promise.resolve(),
  };
}
