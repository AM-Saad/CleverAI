import type { APIError } from "@/services/FetchFactory";
import type { OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";

export interface ModelState {
  // Local state tracking
  modelId?: string;
  isDownloading: boolean;
  progress: number;
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
  loadModel: (modelId: string, task: string) => Promise<void>;
  getModelState: (modelId: string) => ComputedRef<ModelState | undefined>;
  isModelDownloading: (modelId: string) => ComputedRef<boolean>;
  getModelProgress: (modelId: string) => ComputedRef<number>;
  isModelReady: (modelId: string) => ComputedRef<boolean>;
}

// Global store instance
const stores = new Map<string, AIModelStore>();

/**
 * Creates or returns a notes store for a specific folder
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
  async function loadModel(modelId: string, task: string): Promise<void> {
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
      });

      window.addEventListener("ai-worker-message", handler);

      $aiWorker.postMessage({
        type: AI_WORKER_MESSAGE_TYPES.LOAD_MODEL,
        data: {
          task,
          modelId,
          options: {
            quantized: true,
            device: "wasm",
          },
        },
      });
    });
  }
  // Listen for worker messages
  const handleWorkerMessage = (event: CustomEvent<OutgoingAIMessage>) => {
    const message = event.detail;
    // console.log("AI Worker Message:", message);
    switch (message.type) {
      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE:
        if (models.value.has(message.data.modelId)) {
          const model = models.value.get(message.data.modelId)!;
          model.isLoading = true;
          model.isDownloading = true;
          model.progress = 0;
          model.error = null;
          models.value.set(message.data.modelId, model);
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS:
        if (models.value.has(message.data.modelId)) {
          const model = models.value.get(message.data.modelId)!;
          // Use the overall average progress calculated by the worker
          // This represents progress across ALL model files, not just the current file
          model.progress = message.data.progress;
          models.value.set(message.data.modelId, model);
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE:
        if (models.value.has(message.data.modelId)) {
          const model = models.value.get(message.data.modelId)!;
          model.isLoading = false;
          model.isDownloading = false;
          model.isReady = true;
          model.progress = 100;
          models.value.set(message.data.modelId, model);
        }
        break;

      case AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR:
        if (models.value.has(message.data.modelId)) {
          const model = models.value.get(message.data.modelId)!;
          model.isLoading = false;
          model.isDownloading = false;
          model.error = new Error(message.data.error);
          models.value.set(message.data.modelId, model);
        }
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
 * Clean up store when folder is no longer needed
 */
export function cleanupAIStore(storeId: string): void {
  stores.delete(storeId);
}
