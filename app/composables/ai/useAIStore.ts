import type { APIError } from "@/services/FetchFactory";
import type { AITask, OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";

export interface ModelState {
  // Local state tracking
  modelId?: string;
  isDownloading: boolean;
  progress: number;
  loaded: number;      // bytes downloaded so far
  total: number;       // total bytes for the model
  isLoading: boolean;
  isReady?: boolean;
  error?: any;
}

interface AIModelStore {
  models: Ref<Map<string, ModelState>>;
  modelsList: ComputedRef<ModelState[]>;
  loadingStates: Ref<Map<string, boolean>>;
  errorStates: Ref<Map<string, string | null>>;
  fetchError: Ref<APIError | null>;
  fetchTypedError: Ref<APIError | null>;
  loadModel: (modelId: string, task: AITask) => Promise<void>;
  loadGenerativeModel: (modelId: string, options?: { modelClass?: string; dtype?: string; device?: string }) => Promise<void>;
  getModelState: (modelId: string) => ComputedRef<ModelState | undefined>;
  isModelDownloading: (modelId: string) => ComputedRef<boolean>;
  getModelProgress: (modelId: string) => ComputedRef<number>;
  isModelReady: (modelId: string) => ComputedRef<boolean>;
}

// Global store instance
const stores = new Map<string, AIModelStore>();

/**
 * Creates or returns a notes store for a specific workspace
 * This provides local state management with optimistic updates
 */
export function useAIStore(storeId: string): AIModelStore {
  // Return existing store if available
  if (stores.has(storeId)) {
    return stores.get(storeId)!;
  }

  const { $aiWorker } = useNuxtApp();

  // Local reactive state
  const models = ref<Map<string, ModelState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const errorStates = ref<Map<string, string | null>>(new Map());
  const fetchError = ref<APIError | null>(null);
  const fetchTypedError = ref<APIError | null>(null);

  // Computed array for easier template iteration
  const modelsList = computed(() => Array.from(models.value.values()));

  /**
   * Load the model if not already loaded
   */
  async function loadModel(modelId: string, task: AITask): Promise<void> {
    // Check if model is already loaded or loading
    const existingModel = models.value.get(modelId);
    if (existingModel?.isReady) {
      console.log(`[AI Store] Model ${modelId} already loaded`);
      return;
    }
    if (existingModel?.isLoading) {
      console.log(`[AI Store] Model ${modelId} already loading`);
      return;
    }

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

      // Initialize model entry BEFORE registering listener to avoid race condition
      models.value.set(modelId, {
        modelId,
        isLoading: false,
        isDownloading: false,
        error: null,
        progress: 0,
        loaded: 0,
        total: 0,
      });

      window.addEventListener("ai-worker-message", handler);

      // VisionEncoderDecoder models (latex OCR) need full-precision fp32
      // to avoid misreading small strokes (e.g. "1" → "13").
      const isLatexModel = modelId.includes('latex') || modelId.includes('TexTeller');

      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.LOAD_MODEL,
        data: {
          task,
          modelId,
          options: {
            quantized: isLatexModel ? false : true,
            dtype: isLatexModel ? 'fp32' : undefined,
            device: "wasm",
          },
        },
      });
    });
  }

  /**
   * Load a generative model (auto-classes API: AutoProcessor + Model)
   * For LLMs like Gemma 4 that use chat templates and streaming.
   */
  async function loadGenerativeModel(
    modelId: string,
    options?: {
      modelClass?: string;
      dtype?: string;
      device?: string;
    }
  ): Promise<void> {
    // Check if model is already loaded or loading
    const existingModel = models.value.get(modelId);
    if (existingModel?.isReady) {
      console.log(`[AI Store] Generative model ${modelId} already loaded`);
      return;
    }
    if (existingModel?.isLoading) {
      console.log(`[AI Store] Generative model ${modelId} already loading`);
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          reject(new Error("Generative model load timeout"));
        },
        10 * 60 * 1000
      ); // 10 minute timeout (generative models are large)

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

      // Initialize model entry BEFORE registering listener
      models.value.set(modelId, {
        modelId,
        isLoading: false,
        isDownloading: false,
        error: null,
        progress: 0,
        loaded: 0,
        total: 0,
      });

      window.addEventListener("ai-worker-message", handler);

      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.LOAD_GENERATIVE_MODEL,
        data: {
          modelId,
          modelClass: options?.modelClass,
          dtype: options?.dtype ?? "q4f16",
          device: options?.device ?? "webgpu",
        },
      });
    });
  }
  // Listen for worker messages
  const handleWorkerMessage = (event: CustomEvent<OutgoingAIMessage>) => {
    const message = event.detail;

    switch (message.type) {
      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE: {
        const id = message.data.modelId;
        // Auto-create entry if not pre-registered (e.g. TTS composable
        // triggers downloads outside of store.loadModel)
        if (!models.value.has(id)) {
          models.value.set(id, {
            modelId: id,
            isLoading: true,
            isDownloading: true,
            error: null,
            progress: 0,
            loaded: 0,
            total: 0,
          });
        } else {
          const model = models.value.get(id)!;
          model.isLoading = true;
          model.isDownloading = true;
          model.progress = 0;
          model.error = null;
          models.value.set(id, model);
        }
        break;
      }

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS: {
        const id = message.data.modelId;
        if (models.value.has(id)) {
          const model = models.value.get(id)!;
          // Use byte-weighted progress calculated by the worker
          model.progress = message.data.progress;
          model.loaded = message.data.loaded ?? 0;
          model.total = message.data.total ?? 0;
          models.value.set(id, model);
        }
        break;
      }

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_DONE:
        // Per-file completion — no action needed at store level
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE: {
        const id = message.data.modelId;
        if (models.value.has(id)) {
          const model = models.value.get(id)!;
          model.isDownloading = false;
          model.isLoading = false;
          model.isReady = true;
          model.progress = 100;
          models.value.set(id, model);
        }
        break;
      }

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR: {
        const id = message.data.modelId;
        if (models.value.has(id)) {
          const model = models.value.get(id)!;
          model.isLoading = false;
          model.isDownloading = false;
          model.error = new Error(message.data.error);
          models.value.set(id, model);
        }
        break;
      }

      // These message types are handled elsewhere (plugin, composables)
      // and do not need store-level handling.
      case AI_WORKER_MESSAGE_TYPES.WORKER_READY:
      case AI_WORKER_MESSAGE_TYPES.INFERENCE_STARTED:
      case AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE:
      case AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR:
      case AI_WORKER_MESSAGE_TYPES.GENERATION_TOKEN:
      case AI_WORKER_MESSAGE_TYPES.GENERATION_COMPLETE:
      case AI_WORKER_MESSAGE_TYPES.GENERATION_ERROR:
      case "WORKER_ERROR": // Handled by plugin with console.error
        break;
    }
  };

  /**
   * Get reactive computed model state for a specific model
   */
  const getModelState = (modelId: string) => {
    return computed(() => models.value.get(modelId));
  };

  /**
   * Check if model is currently downloading (reactive)
   */
  const isModelDownloading = (modelId: string) => {
    return computed(() => models.value.get(modelId)?.isDownloading ?? false);
  };

  /**
   * Get model download progress (reactive)
   */
  const getModelProgress = (modelId: string) => {
    return computed(() => models.value.get(modelId)?.progress ?? 0);
  };

  /**
   * Check if model is ready for inference (reactive)
   */
  const isModelReady = (modelId: string) => {
    return computed(() => models.value.get(modelId)?.isReady ?? false);
  };

  // Create store instance
  const store: AIModelStore = {
    models,
    modelsList,
    loadingStates,
    errorStates,
    fetchError,
    fetchTypedError,
    loadModel,
    loadGenerativeModel,
    getModelState,
    isModelDownloading,
    getModelProgress,
    isModelReady,
  };

  // Cache the store
  stores.set(storeId, store);

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
  });
  return store;
}

/**
 * Clean up store when workspace is no longer needed
 */
export function cleanupAIStore(storeId: string): void {
  stores.delete(storeId);
}
