import type { OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";

/**
 * Composable for text-to-speech using AI models via Web Worker
 *
 * ARCHITECTURE NOTE: Uses the AI Worker (sw-src/ai-worker.ts) to run model
 * downloads and inference off the main thread, keeping UI responsive.
 * For quick/cached operations where worker overhead isn't worth it,
 * consider if worker overhead is worth it for your use case.
 *
 * @example
 * ```ts
 * const { synthesize, isLoading, audioUrl } = useTextToSpeechWorker();
 *
 * await synthesize('Hello world');
 * // audioUrl.value now contains the audio blob URL
 * ```
 */
export function useTextToSpeechWorker(options?: {
  modelId?: string;
  immediate?: boolean;
}) {
  const { $aiWorker } = useNuxtApp();
  const modelId = options?.modelId || "Xenova/speecht5_tts";
  const task = "text-to-speech";

  const isLoading = ref(false);
  const isDownloading = ref(false);
  const isSynthesizing = ref(false);
  const audioUrl = ref<string | null>(null);
  const error = ref<Error | null>(null);
  const synthesisError = ref<Error | null>(null);
  const progress = ref(0);
  const isReady = ref(false);

  // Generate unique request IDs
  const generateRequestId = () => `${task}-${Date.now()}-${Math.random()}`;

  // Listen for worker messages
  const handleWorkerMessage = (event: CustomEvent<OutgoingAIMessage>) => {
    const message = event.detail;

    switch (message.type) {
      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE:
        if (message.data.modelId === modelId) {
          isLoading.value = true;
          isDownloading.value = true;
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS:
        if (message.data.modelId === modelId) {
          progress.value = message.data.progress;
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE:
        if (message.data.modelId === modelId) {
          isLoading.value = false;
          isDownloading.value = false;
          isReady.value = true;
          progress.value = 100;
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR:
        if (message.data.modelId === modelId) {
          isLoading.value = false;
          isDownloading.value = false;
          error.value = new Error(message.data.error);
        }
        break;
    }
  };

  // Register event listener
  onMounted(() => {
    window.addEventListener(
      "ai-worker-message",
      handleWorkerMessage as EventListener
    );
  });

  onUnmounted(() => {
    window.removeEventListener(
      "ai-worker-message",
      handleWorkerMessage as EventListener
    );

    // Cleanup audio URL
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value);
    }
  });

  /**
   * Load the model if not already loaded
   */
  async function loadModel(): Promise<void> {
    if (isReady.value || isLoading.value) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          reject(new Error("Model load timeout"));
        },
        5 * 60 * 1000
      ); // 5 minute timeout

      const handler = (event: Event) => {
        const message = (event as CustomEvent<OutgoingAIMessage>).detail;

        if (
          message.type === AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE &&
          message.data.modelId === modelId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          resolve();
        } else if (
          message.type === AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR &&
          message.data.modelId === modelId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          reject(new Error(message.data.error));
        }
      };

      window.addEventListener("ai-worker-message", handler);

      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.LOAD_MODEL,
        data: {
          task,
          modelId,
          options: {
            quantized: false, // TTS models typically need full precision
            device: "wasm",
          },
        },
      });
    });
  }

  /**
   * Synthesize speech from text (non-blocking via worker)
   */
  async function synthesize(text: string): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error("No text provided to synthesize");
    }

    // Reset state
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value);
      audioUrl.value = null;
    }
    synthesisError.value = null;

    // Ensure model is loaded
    if (!isReady.value) {
      await loadModel();
    }

    const requestId = generateRequestId();
    isSynthesizing.value = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          isSynthesizing.value = false;
          reject(new Error("Speech synthesis timeout"));
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
          isSynthesizing.value = false;

          // Extract audio data from result
          const result = message.data.result as {
            audio: number[];
            sampling_rate: number;
          };

          if (!result?.audio) {
            const err = new Error("No audio generated");
            synthesisError.value = err;
            reject(err);
            return;
          }

          // Convert audio array to Float32Array and then to WAV blob
          const audioArray = new Float32Array(result.audio);
          const wavBlob = convertToWav(audioArray, result.sampling_rate);
          const url = URL.createObjectURL(wavBlob);

          console.log("Generated speech audio:", url);
          audioUrl.value = url;
          resolve(url);
        } else if (
          message.type === AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR &&
          message.data.requestId === requestId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("ai-worker-message", handler);
          isSynthesizing.value = false;

          const err = new Error(message.data.error);
          synthesisError.value = err;
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
          options: {},
        },
      });
    });
  }

  /**
   * Convert Float32Array audio to WAV blob
   */
  function convertToWav(audioData: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    // Audio data (convert float to int16)
    let offset = 44;
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Retry after a failure
   */
  async function retry() {
    error.value = null;
    synthesisError.value = null;
    return loadModel();
  }

  // Auto-load if immediate flag is set
  if (options?.immediate) {
    onMounted(() => {
      loadModel();
    });
  }

  return {
    // State
    audioUrl: readonly(audioUrl),
    isLoading: readonly(isLoading),
    isDownloading: readonly(isDownloading),
    isSynthesizing: readonly(isSynthesizing),
    isReady: readonly(isReady),
    error: readonly(error),
    synthesisError: readonly(synthesisError),
    progress: readonly(progress),

    // Methods
    synthesize,
    loadModel,
    retry,
  };
}
