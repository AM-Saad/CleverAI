(() => {
  // sw-src/ai-worker.ts
  var MSG = {
    // Pipeline API (existing)
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
    SET_DEBUG: "SET_DEBUG",
    // Generative API (new)
    LOAD_GENERATIVE_MODEL: "LOAD_GENERATIVE_MODEL",
    RUN_GENERATION: "RUN_GENERATION",
    GENERATION_TOKEN: "GENERATION_TOKEN",
    GENERATION_COMPLETE: "GENERATION_COMPLETE",
    GENERATION_ERROR: "GENERATION_ERROR"
  };
  console.log("\u{1F680} [AI Worker] Script loaded \u2014 VERSION 5.0 CLASSIC (pipeline + generative)");
  var _pipeline = null;
  var _env = null;
  var _RawImage = null;
  var _transformersLoaded = false;
  var _transformersLoading = null;
  var _AutoProcessor = null;
  var _TextStreamer = null;
  var _load_image = null;
  var _read_audio = null;
  var _transformersModule = null;
  async function ensureTransformers() {
    if (_transformersLoaded) return;
    if (_transformersLoading) {
      await _transformersLoading;
      return;
    }
    const CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";
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
        _AutoProcessor = transformers.AutoProcessor;
        _TextStreamer = transformers.TextStreamer;
        _load_image = transformers.load_image;
        _read_audio = transformers.read_audio;
        _transformersModule = transformers;
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
        log("Unloaded pipeline model:", key);
      }
    });
    if (generativeInstances.has(modelId)) {
      const instance = generativeInstances.get(modelId);
      if (typeof instance.model?.dispose === "function") instance.model.dispose();
      generativeInstances.delete(modelId);
      log("Unloaded generative model:", modelId);
    }
  }
  var generativeInstances = /* @__PURE__ */ new Map();
  var modelFileProgress = /* @__PURE__ */ new Map();
  function createProgressCallback(modelId, task) {
    modelFileProgress.set(modelId, /* @__PURE__ */ new Map());
    return (progress) => {
      const fileMap = modelFileProgress.get(modelId);
      if (progress.status === "initiate") {
        fileMap.set(progress.file, { loaded: 0, total: 0 });
        self.postMessage({
          type: MSG.MODEL_LOAD_INITIATE,
          data: { modelId, file: progress.file, task }
        });
      } else if (progress.status === "progress") {
        const loaded = progress.loaded ?? 0;
        const total = progress.total ?? 0;
        fileMap.set(progress.file, { loaded, total });
        let totalLoaded = 0;
        let totalSize = 0;
        for (const [, f] of fileMap) {
          totalLoaded += f.loaded;
          totalSize += f.total;
        }
        const overallProgress = totalSize > 0 ? Math.min(Math.round(totalLoaded / totalSize * 100), 100) : 0;
        self.postMessage({
          type: MSG.MODEL_LOAD_PROGRESS,
          data: {
            modelId,
            file: progress.file,
            progress: overallProgress,
            loaded: totalLoaded,
            total: totalSize
          }
        });
      } else if (progress.status === "done") {
        const existing = fileMap.get(progress.file);
        if (existing) {
          existing.loaded = existing.total;
        }
        self.postMessage({
          type: MSG.MODEL_LOAD_DONE,
          data: { modelId, file: progress.file }
        });
      }
    };
  }
  self.addEventListener("message", async (event) => {
    const message = event.data;
    try {
      switch (message.type) {
        case MSG.SET_DEBUG:
          DEBUG = message.value;
          log("Debug mode:", DEBUG);
          break;
        // Pipeline API
        case MSG.LOAD_MODEL:
          await handleLoadModel(message.data);
          break;
        case MSG.RUN_INFERENCE:
          await handleInference(message.data);
          break;
        // Generative API
        case MSG.LOAD_GENERATIVE_MODEL:
          await handleLoadGenerativeModel(message.data);
          break;
        case MSG.RUN_GENERATION:
          await handleRunGeneration(message.data);
          break;
        // Shared
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
    try {
      const progressCallback = createProgressCallback(modelId, task);
      const isLatexModel = modelId.includes("latex") || modelId.includes("nougat") || modelId.includes("TexTeller") || modelId.includes("chandra");
      const modelOptions = {
        ...options,
        quantized: isLatexModel ? false : options.quantized ?? true,
        dtype: isLatexModel ? "fp32" : options.dtype ?? void 0,
        device: options.device ?? "webgpu"
      };
      await getModel(task, modelId, modelOptions, progressCallback);
      modelFileProgress.delete(modelId);
      self.postMessage({
        type: MSG.MODEL_LOAD_COMPLETE,
        data: { modelId, task }
      });
    } catch (err) {
      modelFileProgress.delete(modelId);
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
  var MODEL_CLASS_HINTS = {
    "gemma-4": "Gemma4ForConditionalGeneration",
    "gemma4": "Gemma4ForConditionalGeneration",
    "gemma3": "Gemma3ForConditionalGeneration",
    "gemma-3": "Gemma3ForConditionalGeneration",
    "llama": "LlamaForCausalLM",
    "phi": "PhiForCausalLM",
    "phi-4": "Phi4ForCausalLM",
    "qwen": "Qwen2ForCausalLM",
    "qwen3": "Qwen3ForCausalLM",
    "smollm": "LlamaForCausalLM"
  };
  async function resolveModelClass(modelId, modelClass) {
    await ensureTransformers();
    if (modelClass && _transformersModule[modelClass]) {
      log("Using explicit model class:", modelClass);
      return _transformersModule[modelClass];
    }
    const lowerModelId = modelId.toLowerCase();
    for (const [hint, className] of Object.entries(MODEL_CLASS_HINTS)) {
      if (lowerModelId.includes(hint) && _transformersModule[className]) {
        log("Resolved model class from hint:", hint, "\u2192", className);
        return _transformersModule[className];
      }
    }
    try {
      const configUrl = `https://huggingface.co/${modelId}/resolve/main/config.json`;
      const resp = await fetch(configUrl);
      if (resp.ok) {
        const config = await resp.json();
        const architectures = config.architectures || [];
        for (const arch of architectures) {
          if (_transformersModule[arch]) {
            log("Resolved model class from config.json:", arch);
            return _transformersModule[arch];
          }
        }
        log("config.json architectures not found in Transformers.js exports:", architectures);
      }
    } catch (e) {
      log("Could not fetch config.json for model class resolution:", e);
    }
    throw new Error(
      `Cannot resolve model class for "${modelId}". Please provide an explicit modelClass parameter. Available classes: ${Object.keys(_transformersModule).filter((k) => k.includes("ForC")).slice(0, 15).join(", ")}...`
    );
  }
  async function handleLoadGenerativeModel(config) {
    const {
      modelId,
      modelClass,
      dtype = "q4f16",
      device = "webgpu"
    } = config;
    if (generativeInstances.has(modelId)) {
      log("Generative model already loaded:", modelId);
      self.postMessage({
        type: MSG.MODEL_LOAD_COMPLETE,
        data: { modelId, task: "generative" }
      });
      return;
    }
    try {
      await ensureTransformers();
      const progressCallback = createProgressCallback(modelId, "generative");
      const ModelClass = await resolveModelClass(modelId, modelClass);
      log("Loading generative model:", modelId, "class:", ModelClass.name, "dtype:", dtype, "device:", device);
      const [processor, model] = await Promise.all([
        _AutoProcessor.from_pretrained(modelId, {
          progress_callback: progressCallback
        }),
        ModelClass.from_pretrained(modelId, {
          dtype,
          device,
          progress_callback: progressCallback
        })
      ]);
      generativeInstances.set(modelId, { processor, model });
      modelFileProgress.delete(modelId);
      self.postMessage({
        type: MSG.MODEL_LOAD_COMPLETE,
        data: { modelId, task: "generative" }
      });
      log("\u2705 Generative model loaded:", modelId);
    } catch (err) {
      modelFileProgress.delete(modelId);
      logError("Generative model load error:", err);
      self.postMessage({
        type: MSG.MODEL_LOAD_ERROR,
        data: { modelId, error: err.message || "Failed to load generative model" }
      });
    }
  }
  async function handleRunGeneration(data) {
    const {
      requestId,
      modelId,
      messages,
      imageUrl,
      audioUrl,
      options = {}
    } = data;
    try {
      const instance = generativeInstances.get(modelId);
      if (!instance) {
        throw new Error(`Generative model "${modelId}" not loaded. Call LOAD_GENERATIVE_MODEL first.`);
      }
      const { processor, model } = instance;
      const prompt = processor.apply_chat_template(messages, {
        enable_thinking: options.enableThinking ?? false,
        add_generation_prompt: true
      });
      log("Chat template applied, prompt length:", prompt.length);
      let image = null;
      let audio = null;
      if (imageUrl && _RawImage) {
        log("Loading image:", imageUrl);
        image = await _RawImage.fromURL(imageUrl);
      }
      if (audioUrl && _read_audio) {
        log("Loading audio:", audioUrl);
        audio = await _read_audio(audioUrl);
      }
      let inputs;
      if (image && audio) {
        inputs = await processor(prompt, image, audio);
      } else if (image) {
        inputs = await processor(prompt, image);
      } else if (audio) {
        inputs = await processor(prompt, null, audio);
      } else {
        inputs = await processor(prompt);
      }
      log("Inputs processed, running generation...");
      let fullText = "";
      const streamer = new _TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: false,
        callback_function: (token) => {
          fullText += token;
          self.postMessage({
            type: MSG.GENERATION_TOKEN,
            data: { requestId, token }
          });
        }
      });
      const generateOptions = {
        ...inputs,
        max_new_tokens: options.maxNewTokens ?? 512,
        do_sample: options.doSample ?? false,
        streamer
      };
      if (options.temperature !== void 0) generateOptions.temperature = options.temperature;
      if (options.topP !== void 0) generateOptions.top_p = options.topP;
      if (options.topK !== void 0) generateOptions.top_k = options.topK;
      const outputs = await model.generate(generateOptions);
      const decoded = processor.batch_decode(
        outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true }
      );
      const finalText = decoded[0] || fullText;
      log("Generation complete, output length:", finalText.length);
      self.postMessage({
        type: MSG.GENERATION_COMPLETE,
        data: { requestId, text: finalText }
      });
    } catch (err) {
      logError("Generation error:", err);
      self.postMessage({
        type: MSG.GENERATION_ERROR,
        data: { requestId, error: err.message || "Generation failed" }
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
