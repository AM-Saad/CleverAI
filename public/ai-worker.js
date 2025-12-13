// app/utils/constants/pwa.ts
var CACHE_CONFIG = {
  IMAGES: {
    MAX_ENTRIES: 50,
    MAX_AGE_SECONDS: 30 * 24 * 60 * 60
    // 30 days
  },
  ASSETS: {
    MAX_ENTRIES: 100,
    MAX_AGE_SECONDS: 7 * 24 * 60 * 60
    // 7 days
  },
  PAGES: {
    MAX_ENTRIES: 100
  }
};
var AI_WORKER_MESSAGE_TYPES = {
  // Model loading
  LOAD_MODEL: "LOAD_MODEL",
  MODEL_LOAD_INITIATE: "MODEL_LOAD_INITIATE",
  MODEL_LOAD_PROGRESS: "MODEL_LOAD_PROGRESS",
  MODEL_LOAD_DONE: "MODEL_LOAD_DONE",
  MODEL_LOAD_COMPLETE: "MODEL_LOAD_COMPLETE",
  MODEL_LOAD_ERROR: "MODEL_LOAD_ERROR",
  // Inference
  RUN_INFERENCE: "RUN_INFERENCE",
  INFERENCE_STARTED: "INFERENCE_STARTED",
  INFERENCE_COMPLETE: "INFERENCE_COMPLETE",
  INFERENCE_ERROR: "INFERENCE_ERROR",
  // Model management
  UNLOAD_MODEL: "UNLOAD_MODEL",
  // Worker control
  WORKER_READY: "WORKER_READY",
  SET_DEBUG: "SET_DEBUG"
};
var PERIODIC_SYNC_CONFIG = {
  CONTENT_SYNC_INTERVAL: 60 * 60 * 1e3
  // 1 hour
};

// sw-src/ai-worker.ts
console.log(
  "\u{1F680} [AI Worker] TOP OF FILE - Worker script loading... VERSION 2.0 - FIXED DIVISION"
);
var pipeline;
var env;
try {
  console.log("\u{1F4E6} [AI Worker] Loading Transformers.js from CDN...");
  const transformers = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
  pipeline = transformers.pipeline;
  env = transformers.env;
  console.log("\u2705 [AI Worker] Transformers.js loaded successfully");
} catch (error) {
  console.error("\u274C [AI Worker] Failed to load Transformers.js:", error);
  self.postMessage({
    type: "WORKER_ERROR",
    data: {
      message: "Failed to load Transformers.js from CDN: " + error.message,
      stack: error.stack
    }
  });
  throw error;
}
try {
  let handleUnloadModel = function(data) {
    const { modelId } = data;
    ModelPipeline.instances.forEach((_, key) => {
      if (key.includes(modelId)) {
        const [task] = key.split(":");
        ModelPipeline.unload(task, modelId);
      }
    });
  };
  console.log("\u2699\uFE0F [AI Worker] Starting configuration...");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  env.cacheDir = ".transformers-cache";
  env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";
  env.backends.onnx.wasm.numThreads = 1;
  console.log("[AI Worker] Transformers.js configured");
  let DEBUG = false;
  const log = (...args) => {
    if (DEBUG) console.log("[AI Worker]", ...args);
  };
  const error = (...args) => {
    console.error("[AI Worker]", ...args);
  };
  class ModelPipeline {
    static instances = /* @__PURE__ */ new Map();
    static async getInstance(task, modelId, options = {}, progressCallback = null) {
      const key = `${task}:${modelId}`;
      if (this.instances.has(key)) {
        log(`Reusing cached model: ${key}`);
        return this.instances.get(key);
      }
      log(`Loading new model: ${key}`);
      try {
        const model = await pipeline(task, modelId, {
          ...options,
          progress_callback: progressCallback
        });
        this.instances.set(key, model);
        return model;
      } catch (err) {
        error(`Failed to load model ${key}:`, err);
        throw err;
      }
    }
    static unload(task, modelId) {
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
  const fileProgress = /* @__PURE__ */ new Map();
  let totalFiles = 0;
  let completedFiles = 0;
  self.addEventListener(
    "message",
    async (event) => {
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
  async function handleLoadModel(config) {
    const { task, modelId, options = {} } = config;
    fileProgress.clear();
    totalFiles = 0;
    completedFiles = 0;
    try {
      const progressCallback = (progress) => {
        if (progress.status === "initiate") {
          totalFiles++;
          fileProgress.set(progress.file, 0);
          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE,
            data: {
              modelId,
              file: progress.file,
              task
            }
          });
        } else if (progress.status === "progress") {
          const percent = progress.progress ? Math.round(progress.progress) : 0;
          fileProgress.set(progress.file, Math.min(percent, 100));
          const sum = Array.from(fileProgress.values()).reduce(
            (a, b) => a + b,
            0
          );
          const numFiles = fileProgress.size;
          const avgProgress = numFiles > 0 ? Math.min(Math.round(sum / numFiles), 100) : 0;
          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS,
            data: {
              modelId,
              file: progress.file,
              progress: avgProgress,
              loaded: progress.loaded,
              total: progress.total
            }
          });
        } else if (progress.status === "done") {
          fileProgress.set(progress.file, 100);
          completedFiles++;
          postMessage({
            type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_DONE,
            data: {
              modelId,
              file: progress.file
            }
          });
        }
      };
      await ModelPipeline.getInstance(task, modelId, options, progressCallback);
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE,
        data: {
          modelId,
          task
        }
      });
    } catch (err) {
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR,
        data: {
          modelId,
          error: err.message || "Unknown error"
        }
      });
    }
  }
  async function handleInference(data) {
    const { requestId, modelId, task, input, options = {} } = data;
    try {
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_STARTED,
        data: {
          requestId,
          task
        }
      });
      const model = await ModelPipeline.getInstance(task, modelId, {
        quantized: true,
        device: "wasm"
      });
      const result = await model(input, options);
      let processedResult = result;
      if (task === "text-to-speech" && result?.audio) {
        processedResult = {
          audio: Array.from(result.audio),
          sampling_rate: result.sampling_rate
        };
      }
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE,
        data: {
          requestId,
          result: processedResult
        }
      });
    } catch (err) {
      error("Inference error:", err);
      postMessage({
        type: AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR,
        data: {
          requestId,
          error: err.message || "Inference failed"
        }
      });
    }
  }
  self.addEventListener("error", (event) => {
    error("Unhandled error in worker:", event.error || event.message);
    try {
      postMessage({
        type: "WORKER_ERROR",
        data: {
          message: event.message || "Unknown error",
          stack: event.error?.stack
        }
      });
    } catch (e) {
      console.error("Failed to send error message to main thread:", e);
    }
    event.preventDefault();
  });
  self.addEventListener(
    "unhandledrejection",
    (event) => {
      error("Unhandled promise rejection in worker:", event.reason);
      try {
        postMessage({
          type: "WORKER_ERROR",
          data: {
            message: "Promise rejection: " + (event.reason?.message || event.reason),
            stack: event.reason?.stack
          }
        });
      } catch (e) {
        console.error("Failed to send rejection message to main thread:", e);
      }
      event.preventDefault();
    }
  );
  try {
    postMessage({
      type: AI_WORKER_MESSAGE_TYPES.WORKER_READY
    });
    log("AI Worker initialized and ready");
  } catch (err) {
    error("Failed to send WORKER_READY message:", err);
    throw err;
  }
} catch (initError) {
  console.error("[AI Worker] Initialization failed:", initError);
  try {
    postMessage({
      type: "WORKER_ERROR",
      data: {
        message: "Worker initialization failed: " + (initError?.message || initError),
        stack: initError?.stack
      }
    });
  } catch (e) {
    console.error("[AI Worker] Could not send init error to main thread:", e);
  }
}
