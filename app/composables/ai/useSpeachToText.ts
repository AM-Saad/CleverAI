import type { OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";
import { useAIStore } from "./useAIStore";

/**
 * Composable for speech to text using AI models via Web Worker
 *
 * ARCHITECTURE NOTE: Uses the AI Worker (sw-src/ai-worker.ts) to run heavy
 * ONNX inference (5-30 seconds) off the main thread, keeping UI responsive.
 *
 * @example
 * ```ts
 * const { transcribing, isTranscribing, error } = useSpeachToText();
 *
 * const transcript = await transcribe(audioFloat32Array);
 * console.log(transcript);
 * ```
 */
export function useSpeachToText(options?: {
  modelId?: string;
  immediate?: boolean;
}) {
  const { $aiWorker } = useNuxtApp();
  const store = useAIStore("global-ai-store");
  const { loadModel } = store;
  const modelId = options?.modelId || "onnx-community/whisper-tiny.en";
  const task = "automatic-speech-recognition";

  const isTranscribing = ref(false);
  const currentTranscript = ref<string | null>(null);
  const error = ref<Error | null>(null);
  const transcriptionError = ref<Error | null>(null);

  // Use store abstractions for reactive model state
  const isDownloading = store.isModelDownloading(modelId);
  const progress = store.getModelProgress(modelId);
  const isReady = store.isModelReady(modelId);

  // Generate unique request IDs
  const generateRequestId = () => `${task}-${Date.now()}-${Math.random()}`;

  /**
   * Transcribe audio data (non-blocking via worker)
   */
  async function transcribe(
    audioData: Float32Array,
    options?: {
      language?: string;
    }
  ): Promise<string> {
    if (!audioData || audioData.length === 0) {
      throw new Error("No audio provided to transcribe");
    }

    // Reset state
    currentTranscript.value = null;
    transcriptionError.value = null;

    // Ensure model is loaded (loadModel handles caching internally)
    await loadModel(modelId, task);

    const requestId = generateRequestId();
    isTranscribing.value = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          isTranscribing.value = false;
          reject(new Error("Transcription timeout"));
        },
        5 * 60 * 1000
      ); // 5 minute timeout for speech-to-text

      const handler = (event: Event) => {
        const message = (event as CustomEvent<OutgoingAIMessage>).detail;

        if (
          message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          isTranscribing.value = false;

          // Extract text from result
          const result = message.data.result as any;
          let transcript = "";
          console.log(result)

          if (Array.isArray(result) && result.length > 0) {
            transcript = result[0]?.text || result[0]?.generated_text || "";
          } else if (result?.text || result?.generated_text) {
            transcript = result.text || result.generated_text;
          } else if (typeof result === "string") {
            transcript = result;
          }

          if (!transcript) {
            const err = new Error("No transcript generated");
            transcriptionError.value = err;
            reject(err);
            return;
          }

          console.log("Generated transcript:", transcript);
          currentTranscript.value = transcript;
          resolve(transcript);
        } else if (
          message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          isTranscribing.value = false;

          const err = new Error(message.data.error);
          transcriptionError.value = err;
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
          input: audioData,
          options: {
            chunk_length_s: 30,
            stride_length_s: 5,
            ...(options?.language ? {
              language: options.language,
              task: "transcribe",
            } : {})
          },
        },
      });
    });
  }

  /**
   * Start transcribing without awaiting (non-blocking)
   */
  function startTranscribing(
    audioData: Float32Array,
    options?: {
      language?: string;
    }
  ) {
    // Fire and forget - don't await
    transcribe(audioData, options).catch((err) => {
      console.error("Background transcription failed:", err);
    });
  }

  /**
   * Retry after error
   */
  async function retry() {
    error.value = null;
    transcriptionError.value = null;
    return loadModel(modelId, task);
  }

  return {
    transcribe,
    startTranscribing,
    currentTranscript: readonly(currentTranscript),
    isTranscribing: readonly(isTranscribing),
    error: readonly(error),
    transcriptionError: readonly(transcriptionError),
    // Reactive computed refs from store
    isDownloading,
    progress,
    isReady,
    retry,
  };
}
