(() => {
  // sw-src/ai-worker.ts
  var MSG = {
    LOAD_MODEL: "LOAD_MODEL",
    MODEL_LOAD_INITIATE: "MODEL_LOAD_INITIATE",
    MODEL_LOAD_PROGRESS: "MODEL_LOAD_PROGRESS",
    MODEL_LOAD_DONE: "MODEL_LOAD_DONE",
    MODEL_LOAD_COMPLETE: "MODEL_LOAD_COMPLETE",
    MODEL_LOAD_ERROR: "MODEL_LOAD_ERROR",
    RUN_INFERENCE: "RUN_INFERENCE",
    INFERENCE_STARTED: "INFERENCE_STARTED",
    INFERENCE_COMPLETE: "INFERENCE_COMPLETE",
    INFERENCE_ERROR: "INFERENCE_ERROR",
    UNLOAD_MODEL: "UNLOAD_MODEL",
    WORKER_READY: "WORKER_READY",
    SET_DEBUG: "SET_DEBUG"
  };
  console.log("\u{1F680} [AI Worker] Script loaded \u2014 VERSION 4.0 CLASSIC");
  var _pipeline = null;
  var _env = null;
  var _RawImage = null;
  var _transformersLoaded = false;
  var _transformersLoading = null;
  async function ensureTransformers() {
    if (_transformersLoaded) return;
    if (_transformersLoading) {
      await _transformersLoading;
      return;
    }
    const CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
    _transformersLoading = (async () => {
      console.log("\u{1F4E6} [AI Worker] Loading Transformers.js from CDN via dynamic import...");
      try {
        const transformers = await import(
          /* webpackIgnore: true */
          CDN_URL
        );
        _pipeline = transformers.pipeline;
        _env = transformers.env;
        _RawImage = transformers.RawImage;
        if (!_pipeline) {
          throw new Error(
            "Transformers.js loaded but `pipeline` not found. Available exports: " + Object.keys(transformers).slice(0, 20).join(", ")
          );
        }
        console.log("\u{1F4E6} [AI Worker] Loaded via dynamic import()");
        _env.allowLocalModels = false;
        _env.useBrowserCache = true;
        _env.allowRemoteModels = true;
        _env.cacheDir = ".transformers-cache";
        _transformersLoaded = true;
        console.log("\u2705 [AI Worker] Transformers.js loaded & configured");
      } catch (err) {
        console.error("\u274C [AI Worker] Failed to load Transformers.js:", err);
        self.postMessage({
          type: "WORKER_ERROR",
          data: {
            message: "Failed to load Transformers.js: " + (err.message || err),
            stack: err.stack
          }
        });
        _transformersLoading = null;
        throw err;
      }
    })();
    await _transformersLoading;
  }
  var DEBUG = false;
  var log = (...args) => {
    if (DEBUG) console.log("[AI Worker]", ...args);
  };
  var logError = (...args) => {
    console.error("[AI Worker]", ...args);
  };
  var modelInstances = /* @__PURE__ */ new Map();
  async function getModel(task, modelId, options = {}, progressCb = null) {
    const key = `${task}:${modelId}`;
    if (modelInstances.has(key)) {
      log("Reusing cached model:", key);
      return modelInstances.get(key);
    }
    log("Loading new model:", key);
    await ensureTransformers();
    const model = await _pipeline(task, modelId, {
      ...options,
      progress_callback: progressCb
    });
    modelInstances.set(key, model);
    return model;
  }
  function unloadModel(modelId) {
    modelInstances.forEach((model, key) => {
      if (key.includes(modelId)) {
        if (typeof model.dispose === "function") model.dispose();
        modelInstances.delete(key);
        log("Unloaded:", key);
      }
    });
  }
  var fileProgress = /* @__PURE__ */ new Map();
  var completedFiles = 0;
  self.addEventListener("message", async (event) => {
    const message = event.data;
    try {
      switch (message.type) {
        case MSG.SET_DEBUG:
          DEBUG = message.value;
          log("Debug mode:", DEBUG);
          break;
        case MSG.LOAD_MODEL:
          await handleLoadModel(message.data);
          break;
        case MSG.RUN_INFERENCE:
          await handleInference(message.data);
          break;
        case MSG.UNLOAD_MODEL:
          unloadModel(message.data.modelId);
          break;
        default:
          logError("Unknown message type:", message.type);
      }
    } catch (err) {
      logError("Message handler error:", err);
    }
  });
  async function handleLoadModel(config) {
    const { task, modelId, options = {} } = config;
    fileProgress.clear();
    completedFiles = 0;
    try {
      const progressCallback = (progress) => {
        if (progress.status === "initiate") {
          fileProgress.set(progress.file, 0);
          self.postMessage({
            type: MSG.MODEL_LOAD_INITIATE,
            data: { modelId, file: progress.file, task }
          });
        } else if (progress.status === "progress") {
          const percent = progress.progress ? Math.round(progress.progress) : 0;
          fileProgress.set(progress.file, Math.min(percent, 100));
          const sum = Array.from(fileProgress.values()).reduce((a, b) => a + b, 0);
          const avg = fileProgress.size > 0 ? Math.min(Math.round(sum / fileProgress.size), 100) : 0;
          self.postMessage({
            type: MSG.MODEL_LOAD_PROGRESS,
            data: {
              modelId,
              file: progress.file,
              progress: avg,
              loaded: progress.loaded,
              total: progress.total
            }
          });
        } else if (progress.status === "done") {
          fileProgress.set(progress.file, 100);
          completedFiles++;
          self.postMessage({
            type: MSG.MODEL_LOAD_DONE,
            data: { modelId, file: progress.file }
          });
        }
      };
      const isLatexModel = modelId.includes("latex") || modelId.includes("nougat") || modelId.includes("TexTeller") || modelId.includes("chandra");
      const modelOptions = {
        ...options,
        quantized: isLatexModel ? false : options.quantized ?? true,
        dtype: isLatexModel ? "fp32" : options.dtype ?? void 0,
        device: options.device ?? "webgpu"
      };
      await getModel(task, modelId, modelOptions, progressCallback);
      self.postMessage({
        type: MSG.MODEL_LOAD_COMPLETE,
        data: { modelId, task }
      });
    } catch (err) {
      self.postMessage({
        type: MSG.MODEL_LOAD_ERROR,
        data: { modelId, error: err.message || "Unknown error" }
      });
    }
  }
  async function handleInference(data) {
    const { requestId, modelId, task, input, options = {} } = data;
    try {
      self.postMessage({
        type: MSG.INFERENCE_STARTED,
        data: { requestId, task }
      });
      const isLatexModel = modelId.includes("latex") || modelId.includes("nougat") || modelId.includes("TexTeller") || modelId.includes("chandra");
      const model = await getModel(task, modelId, {
        quantized: isLatexModel ? false : true,
        dtype: isLatexModel ? "fp32" : void 0
      });
      let processedInput = input;
      if (task === "image-to-text") {
        if (typeof input === "string") {
          processedInput = input;
        } else {
          let bytes;
          if (ArrayBuffer.isView(input)) {
            bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
          } else if (input instanceof ArrayBuffer) {
            bytes = new Uint8Array(input);
          } else if (input?.buffer || input?.byteLength !== void 0) {
            bytes = new Uint8Array(input.buffer || input);
          } else if (input && typeof input === "object") {
            const values = Object.values(input);
            bytes = new Uint8Array(values);
          } else {
            throw new Error(
              `Cannot convert input to image. Type: ${typeof input}, constructor: ${input?.constructor?.name}, keys: ${Object.keys(input || {}).slice(0, 5).join(",")}`
            );
          }
          const blob = new Blob([bytes], { type: "image/png" });
          const objectUrl = URL.createObjectURL(blob);
          log("Created Object URL for image input:", objectUrl, "from", bytes.length, "bytes");
          if (_RawImage) {
            const rawImg = await _RawImage.fromURL(objectUrl);
            URL.revokeObjectURL(objectUrl);
            const grayImg = rawImg.grayscale();
            const pixelData = grayImg.data;
            let pMin = 255;
            let pMax = 0;
            for (let i = 0; i < pixelData.length; i++) {
              if (pixelData[i] < pMin) pMin = pixelData[i];
              if (pixelData[i] > pMax) pMax = pixelData[i];
            }
            const range = pMax - pMin || 1;
            for (let i = 0; i < pixelData.length; i++) {
              pixelData[i] = Math.round((pixelData[i] - pMin) / range * 255);
            }
            log("Contrast normalized: min=", pMin, "max=", pMax, "range=", range);
            processedInput = grayImg;
            log("Converted image to grayscale:", processedInput.width, "x", processedInput.height, "channels:", processedInput.channels);
          } else {
            processedInput = objectUrl;
          }
        }
      }
      const result = await model(processedInput, options);
      log("Raw inference result:", JSON.stringify(result, null, 2).slice(0, 500));
      if (typeof processedInput === "string" && processedInput.startsWith("blob:")) {
        URL.revokeObjectURL(processedInput);
      }
      let processedResult = result;
      if (task === "text-to-speech" && result?.audio) {
        processedResult = {
          audio: Array.from(result.audio),
          sampling_rate: result.sampling_rate
        };
      } else if (task === "image-to-text") {
        let text = "";
        if (Array.isArray(result) && result.length > 0) {
          const first = result[0];
          text = typeof first === "string" ? first : first?.generated_text ?? "";
        } else if (typeof result === "string") {
          text = result;
        } else if (result?.generated_text) {
          text = typeof result.generated_text === "string" ? result.generated_text : JSON.stringify(result.generated_text);
        }
        log("Extracted text:", text.slice(0, 200));
        processedResult = { generated_text: text };
      }
      self.postMessage({
        type: MSG.INFERENCE_COMPLETE,
        data: { requestId, result: processedResult }
      });
    } catch (err) {
      logError("Inference error:", err);
      self.postMessage({
        type: MSG.INFERENCE_ERROR,
        data: { requestId, error: err.message || "Inference failed" }
      });
    }
  }
  self.addEventListener("error", (event) => {
    logError("Unhandled error:", event.error || event.message);
    try {
      self.postMessage({
        type: "WORKER_ERROR",
        data: {
          message: event.message || "Unknown error",
          stack: event.error?.stack
        }
      });
    } catch (_) {
    }
    event.preventDefault();
  });
  self.addEventListener("unhandledrejection", (event) => {
    logError("Unhandled rejection:", event.reason);
    try {
      self.postMessage({
        type: "WORKER_ERROR",
        data: {
          message: "Promise rejection: " + (event.reason?.message || event.reason),
          stack: event.reason?.stack
        }
      });
    } catch (_) {
    }
    event.preventDefault();
  });
  self.postMessage({ type: MSG.WORKER_READY });
  console.log("\u2705 [AI Worker] Ready (Transformers.js will load on first model request)");
})();
