/// <reference lib="WebWorker" />
/**
 * AI Worker for Transformers.js model inference.
 * Built to public/ai-worker.js via esbuild as IIFE (classic worker).
 *
 * Runs heavy ML computations off the main thread to keep UI responsive.
 * Loads Transformers.js lazily from CDN on first model request.
 *
 * Supports TWO model APIs:
 *  1. Pipeline API — simple task-based models (summarization, STT, TTS, OCR)
 *  2. Auto-classes API — generative LLMs (Gemma 4, etc.) with chat templates,
 *     multimodal inputs, and streaming token generation.
 *
 * IMPORTANT: This file is self-contained — NO imports from app/ or shared/.
 * Message type strings are inlined to avoid cross-boundary imports that
 * break the IIFE build. Keep them in sync with app/utils/constants/pwa.ts.
 *
 * @see docs/AI_WORKER_ARCHITECTURE.md
 */

// ── Inlined message types (must match AI_WORKER_MESSAGE_TYPES in pwa.ts) ──
const MSG = {
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
  GENERATION_ERROR: "GENERATION_ERROR",
} as const;

console.log("🚀 [AI Worker] Script loaded — VERSION 5.0 CLASSIC (pipeline + generative)");

// ── Transformers.js loaded lazily on first model request ──
let _pipeline: any = null;
let _env: any = null;
let _RawImage: any = null;
let _transformersLoaded = false;
let _transformersLoading: Promise<void> | null = null;

// Additional auto-classes API references (for generative models)
let _AutoProcessor: any = null;
let _TextStreamer: any = null;
let _load_image: any = null;
let _read_audio: any = null;
let _transformersModule: any = null; // full module for dynamic class lookup

/**
 * Lazily load Transformers.js from CDN.
 * Only called when the first LOAD_MODEL or LOAD_GENERATIVE_MODEL message arrives.
 */
async function ensureTransformers(): Promise<void> {
  if (_transformersLoaded) return;
  if (_transformersLoading) {
    await _transformersLoading;
    return;
  }

  const CDN_URL =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";

  _transformersLoading = (async () => {
    console.log("📦 [AI Worker] Loading Transformers.js from CDN via dynamic import...");
    try {
      // @ts-expect-error — CDN import has no type declarations
      const transformers = await import(/* webpackIgnore: true */ CDN_URL);

      // Pipeline API references
      _pipeline = transformers.pipeline;
      _env = transformers.env;
      _RawImage = transformers.RawImage;

      // Auto-classes API references (for generative models)
      _AutoProcessor = transformers.AutoProcessor;
      _TextStreamer = transformers.TextStreamer;
      _load_image = transformers.load_image;
      _read_audio = transformers.read_audio;
      _transformersModule = transformers; // keep full module for dynamic class lookup

      if (!_pipeline) {
        throw new Error(
          "Transformers.js loaded but `pipeline` not found. " +
          "Available exports: " + Object.keys(transformers).slice(0, 20).join(", ")
        );
      }

      console.log("📦 [AI Worker] Loaded via dynamic import()");

      // Configure Transformers.js v3
      _env.allowLocalModels = false;
      _env.useBrowserCache = true;
      _env.allowRemoteModels = true;
      _env.cacheDir = ".transformers-cache";

      _transformersLoaded = true;
      console.log("✅ [AI Worker] Transformers.js loaded & configured");
    } catch (err: any) {
      console.error("❌ [AI Worker] Failed to load Transformers.js:", err);
      self.postMessage({
        type: "WORKER_ERROR",
        data: {
          message: "Failed to load Transformers.js: " + (err.message || err),
          stack: err.stack,
        },
      });
      _transformersLoading = null; // allow retry
      throw err;
    }
  })();

  await _transformersLoading;
}

// ── Debug ──
let DEBUG = false;
const log = (...args: any[]) => {
  if (DEBUG) console.log("[AI Worker]", ...args);
};
const logError = (...args: any[]) => {
  console.error("[AI Worker]", ...args);
};

// ══════════════════════════════════════════════════════════════
// ── Pipeline API: Model singleton cache (existing) ──
// ══════════════════════════════════════════════════════════════
const modelInstances = new Map<string, any>();

async function getModel(
  task: string,
  modelId: string,
  options: Record<string, any> = {},
  progressCb: ((p: any) => void) | null = null
): Promise<any> {
  const key = `${task}:${modelId}`;
  if (modelInstances.has(key)) {
    log("Reusing cached model:", key);
    return modelInstances.get(key);
  }
  log("Loading new model:", key);

  await ensureTransformers();

  const model = await _pipeline(task, modelId, {
    ...options,
    progress_callback: progressCb,
  });
  modelInstances.set(key, model);
  return model;
}

function unloadModel(modelId: string): void {
  // Unload from pipeline cache
  modelInstances.forEach((model, key) => {
    if (key.includes(modelId)) {
      if (typeof model.dispose === "function") model.dispose();
      modelInstances.delete(key);
      log("Unloaded pipeline model:", key);
    }
  });
  // Unload from generative cache
  if (generativeInstances.has(modelId)) {
    const instance = generativeInstances.get(modelId)!;
    if (typeof instance.model?.dispose === "function") instance.model.dispose();
    generativeInstances.delete(modelId);
    log("Unloaded generative model:", modelId);
  }
}

// ══════════════════════════════════════════════════════════════
// ── Generative API: Model cache (new) ──
// ══════════════════════════════════════════════════════════════
const generativeInstances = new Map<string, { processor: any; model: any }>();

// ── Progress tracking (per-model to avoid cross-contamination) ──
const modelFileProgress = new Map<string, Map<string, { loaded: number; total: number }>>();

/**
 * Create a Transformers.js progress_callback bound to a specific modelId.
 * Tracks per-file byte progress and emits byte-weighted overall progress.
 */
function createProgressCallback(modelId: string, task: string) {
  // Ensure a fresh file map for this model
  modelFileProgress.set(modelId, new Map());

  return (progress: any) => {
    const fileMap = modelFileProgress.get(modelId)!;

    if (progress.status === "initiate") {
      fileMap.set(progress.file, { loaded: 0, total: 0 });
      self.postMessage({
        type: MSG.MODEL_LOAD_INITIATE,
        data: { modelId, file: progress.file, task },
      });
    } else if (progress.status === "progress") {
      // Update this file's byte-level progress
      const loaded = progress.loaded ?? 0;
      const total = progress.total ?? 0;
      fileMap.set(progress.file, { loaded, total });

      // Calculate byte-weighted overall progress across ALL files for this model
      let totalLoaded = 0;
      let totalSize = 0;
      for (const [, f] of fileMap) {
        totalLoaded += f.loaded;
        totalSize += f.total;
      }
      const overallProgress = totalSize > 0
        ? Math.min(Math.round((totalLoaded / totalSize) * 100), 100)
        : 0;

      self.postMessage({
        type: MSG.MODEL_LOAD_PROGRESS,
        data: {
          modelId,
          file: progress.file,
          progress: overallProgress,
          loaded: totalLoaded,
          total: totalSize,
        },
      });
    } else if (progress.status === "done") {
      // Mark file as complete (keep byte info for total calculation)
      const existing = fileMap.get(progress.file);
      if (existing) {
        existing.loaded = existing.total; // ensure loaded === total
      }
      self.postMessage({
        type: MSG.MODEL_LOAD_DONE,
        data: { modelId, file: progress.file },
      });
    }
  };
}

// ── Message handler ──
self.addEventListener("message", async (event: MessageEvent) => {
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

// ══════════════════════════════════════════════════════════════
// ── Pipeline API handlers (existing — unchanged) ──
// ══════════════════════════════════════════════════════════════
async function handleLoadModel(config: any): Promise<void> {
  const { task, modelId, options = {} } = config;

  try {
    const progressCallback = createProgressCallback(modelId, task);

    // VisionEncoderDecoder models (latex OCR) need full-precision fp32
    const isLatexModel = modelId.includes('latex') || modelId.includes('nougat') || modelId.includes('TexTeller') || modelId.includes('chandra');
    const modelOptions = {
      ...options,
      quantized: isLatexModel ? false : (options.quantized ?? true),
      dtype: isLatexModel ? 'fp32' : (options.dtype ?? undefined),
      device: options.device ?? "webgpu",
    };
    await getModel(task, modelId, modelOptions, progressCallback);

    // Clean up progress tracking
    modelFileProgress.delete(modelId);

    self.postMessage({
      type: MSG.MODEL_LOAD_COMPLETE,
      data: { modelId, task },
    });
  } catch (err: any) {
    modelFileProgress.delete(modelId);
    self.postMessage({
      type: MSG.MODEL_LOAD_ERROR,
      data: { modelId, error: err.message || "Unknown error" },
    });
  }
}

async function handleInference(data: any): Promise<void> {
  const { requestId, modelId, task, input, options = {} } = data;

  try {
    self.postMessage({
      type: MSG.INFERENCE_STARTED,
      data: { requestId, task },
    });

    // VisionEncoderDecoder models (latex OCR) need full-precision fp32
    const isLatexModel = modelId.includes('latex') || modelId.includes('nougat') || modelId.includes('TexTeller') || modelId.includes('chandra');
    const model = await getModel(task, modelId, {
      quantized: isLatexModel ? false : true,
      dtype: isLatexModel ? 'fp32' : undefined,
    });

    // Pre-process input based on task
    let processedInput = input;
    if (task === "image-to-text") {
      if (typeof input === "string") {
        processedInput = input;
      } else {
        let bytes: Uint8Array;
        if (ArrayBuffer.isView(input)) {
          bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        } else if (input instanceof ArrayBuffer) {
          bytes = new Uint8Array(input);
        } else if (input?.buffer || input?.byteLength !== undefined) {
          bytes = new Uint8Array(input.buffer || input);
        } else if (input && typeof input === "object") {
          const values = Object.values(input) as number[];
          bytes = new Uint8Array(values);
        } else {
          throw new Error(
            `Cannot convert input to image. Type: ${typeof input}, ` +
            `constructor: ${input?.constructor?.name}, ` +
            `keys: ${Object.keys(input || {}).slice(0, 5).join(",")}`
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
            pixelData[i] = Math.round(((pixelData[i] - pMin) / range) * 255);
          }
          log("Contrast normalized: min=", pMin, "max=", pMax, "range=", range);

          processedInput = grayImg;
          log("Converted image to grayscale:", processedInput.width, "x", processedInput.height, "channels:", processedInput.channels);
        } else {
          processedInput = objectUrl;
        }
      }
    }

    // Run inference
    const result = await model(processedInput, options);
    log("Raw inference result:", JSON.stringify(result, null, 2).slice(0, 500));

    // Clean up Object URL to prevent memory leaks
    if (typeof processedInput === "string" && processedInput.startsWith("blob:")) {
      URL.revokeObjectURL(processedInput);
    }

    // Post-process output based on task
    let processedResult = result;
    if (task === "text-to-speech" && result?.audio) {
      processedResult = {
        audio: Array.from(result.audio),
        sampling_rate: result.sampling_rate,
      };
    } else if (task === "image-to-text") {
      let text: string = "";
      if (Array.isArray(result) && result.length > 0) {
        const first = result[0];
        text = typeof first === "string" ? first : (first?.generated_text ?? "");
      } else if (typeof result === "string") {
        text = result;
      } else if (result?.generated_text) {
        text = typeof result.generated_text === "string"
          ? result.generated_text
          : JSON.stringify(result.generated_text);
      }
      log("Extracted text:", text.slice(0, 200));
      processedResult = { generated_text: text };
    }

    self.postMessage({
      type: MSG.INFERENCE_COMPLETE,
      data: { requestId, result: processedResult },
    });
  } catch (err: any) {
    logError("Inference error:", err);
    self.postMessage({
      type: MSG.INFERENCE_ERROR,
      data: { requestId, error: err.message || "Inference failed" },
    });
  }
}

// ══════════════════════════════════════════════════════════════
// ── Generative API handlers (new) ──
// ══════════════════════════════════════════════════════════════

/**
 * Well-known model class mappings for common generative models.
 * The worker tries these in order when no explicit modelClass is provided.
 * Falls back to checking the model's config.json for architectures.
 */
const MODEL_CLASS_HINTS: Record<string, string> = {
  "gemma-4": "Gemma4ForConditionalGeneration",
  "gemma4": "Gemma4ForConditionalGeneration",
  "gemma3": "Gemma3ForConditionalGeneration",
  "gemma-3": "Gemma3ForConditionalGeneration",
  "llama": "LlamaForCausalLM",
  "phi": "PhiForCausalLM",
  "phi-4": "Phi4ForCausalLM",
  "qwen": "Qwen2ForCausalLM",
  "qwen3": "Qwen3ForCausalLM",
  "smollm": "LlamaForCausalLM",
};

/**
 * Try to resolve the correct model class from Transformers.js exports.
 * 1. If modelClass is explicitly provided, use it
 * 2. Check the modelId against well-known hints
 * 3. Attempt to fetch config.json from the model repo to read architectures
 */
async function resolveModelClass(modelId: string, modelClass?: string): Promise<any> {
  await ensureTransformers();

  // 1. Explicit class name
  if (modelClass && _transformersModule[modelClass]) {
    log("Using explicit model class:", modelClass);
    return _transformersModule[modelClass];
  }

  // 2. Well-known hints
  const lowerModelId = modelId.toLowerCase();
  for (const [hint, className] of Object.entries(MODEL_CLASS_HINTS)) {
    if (lowerModelId.includes(hint) && _transformersModule[className]) {
      log("Resolved model class from hint:", hint, "→", className);
      return _transformersModule[className];
    }
  }

  // 3. Try to fetch config.json from HuggingFace
  try {
    const configUrl = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    const resp = await fetch(configUrl);
    if (resp.ok) {
      const config = await resp.json();
      const architectures: string[] = config.architectures || [];
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
    `Cannot resolve model class for "${modelId}". ` +
    `Please provide an explicit modelClass parameter. ` +
    `Available classes: ${Object.keys(_transformersModule)
      .filter(k => k.includes("ForC"))
      .slice(0, 15)
      .join(", ")}...`
  );
}

async function handleLoadGenerativeModel(config: any): Promise<void> {
  const {
    modelId,
    modelClass,
    dtype = "q4f16",
    device = "webgpu",
  } = config;

  // Already loaded?
  if (generativeInstances.has(modelId)) {
    log("Generative model already loaded:", modelId);
    self.postMessage({
      type: MSG.MODEL_LOAD_COMPLETE,
      data: { modelId, task: "generative" },
    });
    return;
  }

  try {
    await ensureTransformers();

    const progressCallback = createProgressCallback(modelId, "generative");

    // Resolve the model class dynamically
    const ModelClass = await resolveModelClass(modelId, modelClass);

    log("Loading generative model:", modelId, "class:", ModelClass.name, "dtype:", dtype, "device:", device);

    // Load processor and model in parallel
    const [processor, model] = await Promise.all([
      _AutoProcessor.from_pretrained(modelId, {
        progress_callback: progressCallback,
      }),
      ModelClass.from_pretrained(modelId, {
        dtype,
        device,
        progress_callback: progressCallback,
      }),
    ]);

    generativeInstances.set(modelId, { processor, model });

    // Clean up progress tracking
    modelFileProgress.delete(modelId);

    self.postMessage({
      type: MSG.MODEL_LOAD_COMPLETE,
      data: { modelId, task: "generative" },
    });

    log("✅ Generative model loaded:", modelId);
  } catch (err: any) {
    modelFileProgress.delete(modelId);
    logError("Generative model load error:", err);
    self.postMessage({
      type: MSG.MODEL_LOAD_ERROR,
      data: { modelId, error: err.message || "Failed to load generative model" },
    });
  }
}

async function handleRunGeneration(data: any): Promise<void> {
  const {
    requestId,
    modelId,
    messages,
    imageUrl,
    audioUrl,
    options = {},
  } = data;

  try {
    const instance = generativeInstances.get(modelId);
    if (!instance) {
      throw new Error(`Generative model "${modelId}" not loaded. Call LOAD_GENERATIVE_MODEL first.`);
    }
    const { processor, model } = instance;

    // 1. Apply chat template to format the messages
    const prompt = processor.apply_chat_template(messages, {
      enable_thinking: options.enableThinking ?? false,
      add_generation_prompt: true,
    });

    log("Chat template applied, prompt length:", prompt.length);

    // 2. Load multimodal inputs if provided
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

    // 3. Process inputs through the processor
    let inputs;
    if (image && audio) {
      inputs = await processor(prompt, image, audio);
    } else if (image) {
      inputs = await processor(prompt, image);
    } else if (audio) {
      // Pass null for images if only audio is provided
      inputs = await processor(prompt, null, audio);
    } else {
      inputs = await processor(prompt);
    }

    log("Inputs processed, running generation...");

    // 4. Set up TextStreamer for token-by-token output
    let fullText = "";
    const streamer = new _TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function: (token: string) => {
        fullText += token;
        self.postMessage({
          type: MSG.GENERATION_TOKEN,
          data: { requestId, token },
        });
      },
    });

    // 5. Run generation
    const generateOptions: any = {
      ...inputs,
      max_new_tokens: options.maxNewTokens ?? 512,
      do_sample: options.doSample ?? false,
      streamer,
    };

    if (options.temperature !== undefined) generateOptions.temperature = options.temperature;
    if (options.topP !== undefined) generateOptions.top_p = options.topP;
    if (options.topK !== undefined) generateOptions.top_k = options.topK;

    const outputs = await model.generate(generateOptions);

    // 6. Decode the full output (excluding the input prompt tokens)
    const decoded = processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true },
    );

    const finalText = decoded[0] || fullText;
    log("Generation complete, output length:", finalText.length);

    self.postMessage({
      type: MSG.GENERATION_COMPLETE,
      data: { requestId, text: finalText },
    });
  } catch (err: any) {
    logError("Generation error:", err);
    self.postMessage({
      type: MSG.GENERATION_ERROR,
      data: { requestId, error: err.message || "Generation failed" },
    });
  }
}

// ── Global error handlers ──
self.addEventListener("error", (event: ErrorEvent) => {
  logError("Unhandled error:", event.error || event.message);
  try {
    self.postMessage({
      type: "WORKER_ERROR",
      data: {
        message: event.message || "Unknown error",
        stack: event.error?.stack,
      },
    });
  } catch (_) {
    // Swallow — can't communicate with main thread
  }
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  logError("Unhandled rejection:", event.reason);
  try {
    self.postMessage({
      type: "WORKER_ERROR",
      data: {
        message: "Promise rejection: " + (event.reason?.message || event.reason),
        stack: event.reason?.stack,
      },
    });
  } catch (_) {
    // Swallow
  }
  event.preventDefault();
});

// ── Signal ready immediately — Transformers.js loads lazily on first use ──
self.postMessage({ type: MSG.WORKER_READY });
console.log("✅ [AI Worker] Ready (Transformers.js will load on first model request)");
