/// <reference lib="WebWorker" />
// TypeScript source of the AI worker. Built to public/ai-worker.js via esbuild.
// AI Worker for Transformers.js model inference
// Runs heavy ML computations off the main thread to keep UI responsive
// Based on Transformers.js React tutorial pattern
//
// ARCHITECTURE NOTE: This worker handles ONLY text summarization tasks
// that are too heavy for the main thread (5-30 second ONNX inference).
// For other AI tasks (text-to-speech, etc.), see app/stores/modelDownload.ts
// which provides main-thread AI capabilities via the useAIModel composable.

// IMMEDIATE DEBUG LOG - This should appear first if the worker loads at all
console.log(
  "🚀 [AI Worker] TOP OF FILE - Worker script loading... VERSION 2.0 - FIXED DIVISION"
);

import { AI_WORKER_MESSAGE_TYPES } from "../app/utils/constants/pwa";
import type {
  OutgoingAIMessage,
  IncomingAIMessage,
  ModelConfig,
} from "../shared/types/ai-messages";

// Dynamically import transformers from CDN to avoid bundling ONNX Runtime
// We wrap this in a try-catch and notify the main thread if it fails
let pipeline: any;
let env: any;

try {
  console.log("📦 [AI Worker] Loading Transformers.js from CDN...");
  // @ts-expect-error - CDN import doesn't have type declarations
  const transformers = await import(
    "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2"
  );
  pipeline = transformers.pipeline;
  env = transformers.env;
  console.log("✅ [AI Worker] Transformers.js loaded successfully");
} catch (error: any) {
  console.error("❌ [AI Worker] Failed to load Transformers.js:", error);
  self.postMessage({
    type: "WORKER_ERROR",
    data: {
      message: "Failed to load Transformers.js from CDN: " + error.message,
      stack: error.stack,
    },
  });
  throw error;
}

// Wrap the worker initialization in a try-catch
try {
  // Log immediately to verify worker script starts executing
  console.log("⚙️ [AI Worker] Starting configuration...");

  // Configure Transformers.js to use CDN for ONNX Runtime
  // This avoids bundling issues with ONNX Runtime's WASM files
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  env.cacheDir = ".transformers-cache";

  // Use CDN for ONNX Runtime to avoid bundling WASM files
  env.backends.onnx.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";
  env.backends.onnx.wasm.numThreads = 1;

  console.log("[AI Worker] Transformers.js configured");

  // Debug flag
  let DEBUG = false;

  const log = (...args: any[]) => {
    if (DEBUG) console.log("[AI Worker]", ...args);
  };

  const error = (...args: any[]) => {
    console.error("[AI Worker]", ...args);
  };

  // Singleton pattern for model management
  class ModelPipeline {
    static instances = new Map<string, any>();

    static async getInstance(
      task: string,
      modelId: string,
      options: Record<string, any> = {},
      progressCallback: ((progress: any) => void) | null = null
    ) {
      const key = `${task}:${modelId}`;

      if (this.instances.has(key)) {
        log(`Reusing cached model: ${key}`);
        return this.instances.get(key);
      }

      log(`Loading new model: ${key}`);

      try {
        const model = await pipeline(task, modelId, {
          ...options,
          progress_callback: progressCallback,
        });

        this.instances.set(key, model);
        return model;
      } catch (err) {
        error(`Failed to load model ${key}:`, err);
        throw err;
      }
    }

    static unload(task: string, modelId: string) {
      const key = `${task}:${modelId}`;
      if (this.instances.has(key)) {
        const model = this.instances.get(key);
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        this.instances.delete(key);
        log(`Unloaded model: ${key}`);
      }
    }

    static clear() {
      this.instances.forEach((model, key) => {
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        log(`Disposed model: ${key}`);
      });
      this.instances.clear();
    }
  }

  // Track file download progress
  const fileProgress = new Map<string, number>();
  let totalFiles = 0;
  let completedFiles = 0;

  // Message handler
  self.addEventListener(
    "message",
    async (event: MessageEvent<IncomingAIMessage>) => {
      const message = event.data;
      try {
        switch (message.type) {
          case AI_WORKER_MESSAGE_TYPES.SET_DEBUG:
            DEBUG = message.value;
            log("Debug mode:", DEBUG);
            break;
          case AI_WORKER_MESSAGE_TYPES.LOAD_MODEL:
            await handleLoadModel(message.data);
            break;
          case AI_WORKER_MESSAGE_TYPES.RUN_INFERENCE:
            await handleInference(message.data);
            break;
          case AI_WORKER_MESSAGE_TYPES.UNLOAD_MODEL:
            handleUnloadModel(message.data);
            break;
          default:
            error("Unknown message type:", message.type);
        }
      } catch (err) {
        error("Message handler error:", err);
      }
    }
  );

  // Handle model loading
  async function handleLoadModel(config: ModelConfig) {
    const { task, modelId, options = {} } = config;

    // Reset progress tracking
    fileProgress.clear();
    totalFiles = 0;
    completedFiles = 0;

    try {
      const progressCallback = (progress: any) => {
        // console.log("Progress callback:", progress);
        if (progress.status === "initiate") {
          totalFiles++;
          fileProgress.set(progress.file, 0);

          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE,
            data: {
              modelId,
              file: progress.file,
              task,
            },
          });
        } else if (progress.status === "progress") {
          // Transformers.js sends progress as 0-100, not 0-1!
          const percent = progress.progress ? Math.round(progress.progress) : 0;
          fileProgress.set(progress.file, Math.min(percent, 100)); // Cap at 100%

          // Calculate average: sum of all file percentages divided by number of files we've seen
          const sum = Array.from(fileProgress.values()).reduce(
            (a, b) => a + b,
            0
          );
          const numFiles = fileProgress.size; // Use actual files in Map, not totalFiles
          const avgProgress =
            numFiles > 0 ? Math.min(Math.round(sum / numFiles), 100) : 0;

          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS,
            data: {
              modelId,
              file: progress.file,
              progress: avgProgress,
              loaded: progress.loaded,
              total: progress.total,
            },
          });
        } else if (progress.status === "done") {
          fileProgress.set(progress.file, 100);
          completedFiles++;

          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_DONE,
            data: {
              modelId,
              file: progress.file,
            },
          });
        }
      };

      await ModelPipeline.getInstance(task, modelId, options, progressCallback);

      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE,
        data: {
          modelId,
          task,
        },
      });
    } catch (err: any) {
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR,
        data: {
          modelId,
          error: err.message || "Unknown error",
        },
      });
    }
  }

  // Handle inference
  async function handleInference(data: any) {
    const { requestId, modelId, task, input, options = {} } = data;

    try {
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_STARTED,
        data: {
          requestId,
          task,
        },
      });

      // Get the model (will load if not cached)
      const model = await ModelPipeline.getInstance(task, modelId, {
        quantized: true,
        device: "wasm",
      });

      // Run inference
      const result = await model(input, options);

      // For TTS, convert the audio output to transferable format
      let processedResult = result;
      if (task === "text-to-speech" && result?.audio) {
        // The audio is a Float32Array - convert to regular array for postMessage
        processedResult = {
          audio: Array.from(result.audio),
          sampling_rate: result.sampling_rate,
        };
      }
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE,
        data: {
          requestId,
          result: processedResult,
        },
      });
    } catch (err: any) {
      error("Inference error:", err);
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR,
        data: {
          requestId,
          error: err.message || "Inference failed",
        },
      });
    }
  }

  // Handle model unloading
  function handleUnloadModel(data: any) {
    const { modelId } = data;
    // Extract task from modelId if needed, or unload all variants
    // For simplicity, we'll clear all instances with this modelId
    ModelPipeline.instances.forEach((_, key) => {
      if (key.includes(modelId)) {
        const [task] = key.split(":");
        ModelPipeline.unload(task, modelId);
      }
    });
  }

  // Global error handler for unhandled errors in worker
  self.addEventListener("error", (event: ErrorEvent) => {
    error("Unhandled error in worker:", event.error || event.message);

    // Try to notify the main thread about the error
    try {
      postMessage({
        type: "WORKER_ERROR",
        data: {
          message: event.message || "Unknown error",
          stack: event.error?.stack,
        },
      });
    } catch (e) {
      console.error("Failed to send error message to main thread:", e);
    }

    event.preventDefault(); // Prevent the error from bubbling to the browser
  });

  // Global handler for unhandled promise rejections
  self.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      error("Unhandled promise rejection in worker:", event.reason);

      // Try to notify the main thread
      try {
        postMessage({
          type: "WORKER_ERROR",
          data: {
            message:
              "Promise rejection: " + (event.reason?.message || event.reason),
            stack: event.reason?.stack,
          },
        });
      } catch (e) {
        console.error("Failed to send rejection message to main thread:", e);
      }

      event.preventDefault();
    }
  );

  // Notify that worker is ready
  try {
    postMessage({
      type: AI_WORKER_MESSAGE_TYPES.WORKER_READY,
    });
    log("AI Worker initialized and ready");
  } catch (err: any) {
    error("Failed to send WORKER_READY message:", err);
    throw err;
  }
} catch (initError: any) {
  // Catch any top-level initialization errors
  console.error("[AI Worker] Initialization failed:", initError);

  // Try to send error to main thread
  try {
    postMessage({
      type: "WORKER_ERROR",
      data: {
        message:
          "Worker initialization failed: " + (initError?.message || initError),
        stack: initError?.stack,
      },
    });
  } catch (e) {
    console.error("[AI Worker] Could not send init error to main thread:", e);
  }
}
