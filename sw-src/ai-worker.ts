/// <reference lib="WebWorker" />
/**
 * AI Worker for Transformers.js model inference.
 * Built to public/ai-worker.js via esbuild as IIFE (classic worker).
 *
 * Runs heavy ML computations off the main thread to keep UI responsive.
 * Loads Transformers.js lazily from CDN on first model request.
 *
 * IMPORTANT: This file is self-contained — NO imports from app/ or shared/.
 * Message type strings are inlined to avoid cross-boundary imports that
 * break the IIFE build. Keep them in sync with app/utils/constants/pwa.ts.
 *
 * @see docs/AI_WORKER_ARCHITECTURE.md
 */

// ── Inlined message types (must match AI_WORKER_MESSAGE_TYPES in pwa.ts) ──
const MSG = {
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
} as const;

console.log("🚀 [AI Worker] Script loaded — VERSION 4.0 CLASSIC");

// ── Transformers.js loaded lazily on first model request ──
let _pipeline: any = null;
let _env: any = null;
let _RawImage: any = null;
let _transformersLoaded = false;
let _transformersLoading: Promise<void> | null = null;

/**
 * Lazily load Transformers.js from CDN.
 * Only called when the first LOAD_MODEL message arrives.
 *
 * Uses dynamic import() which works in modern classic workers (Chrome 80+,
 * Firefox 114+, Safari 15+) and handles the ESM build of Transformers.js.
 * Blob URL workers can't use importScripts() cross-origin, and eval() can't
 * handle ESM (`export` keyword), so dynamic import() is the correct approach.
 */
async function ensureTransformers(): Promise<void> {
  if (_transformersLoaded) return;
  if (_transformersLoading) {
    await _transformersLoading;
    return;
  }

  const CDN_URL =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

  _transformersLoading = (async () => {
    console.log("📦 [AI Worker] Loading Transformers.js from CDN via dynamic import...");
    try {
      // Dynamic import() works in classic workers in modern browsers and
      // correctly handles ESM modules (which transformers.js is).
      // @ts-expect-error — CDN import has no type declarations
      const transformers = await import(/* webpackIgnore: true */ CDN_URL);
      _pipeline = transformers.pipeline;
      _env = transformers.env;
      _RawImage = transformers.RawImage;

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

      // Transformers.js v3 bundles its own ONNX Runtime Web — no manual WASM paths needed.

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

// ── Model singleton cache ──
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
  modelInstances.forEach((model, key) => {
    if (key.includes(modelId)) {
      if (typeof model.dispose === "function") model.dispose();
      modelInstances.delete(key);
      log("Unloaded:", key);
    }
  });
}

// ── Progress tracking ──
const fileProgress = new Map<string, number>();
let completedFiles = 0;

// ── Message handler ──
self.addEventListener("message", async (event: MessageEvent) => {
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

async function handleLoadModel(config: any): Promise<void> {
  const { task, modelId, options = {} } = config;
  fileProgress.clear();
  completedFiles = 0;

  try {
    const progressCallback = (progress: any) => {
      if (progress.status === "initiate") {
        fileProgress.set(progress.file, 0);
        self.postMessage({
          type: MSG.MODEL_LOAD_INITIATE,
          data: { modelId, file: progress.file, task },
        });
      } else if (progress.status === "progress") {
        const percent = progress.progress ? Math.round(progress.progress) : 0;
        fileProgress.set(progress.file, Math.min(percent, 100));

        const sum = Array.from(fileProgress.values()).reduce((a, b) => a + b, 0);
        const avg =
          fileProgress.size > 0
            ? Math.min(Math.round(sum / fileProgress.size), 100)
            : 0;

        self.postMessage({
          type: MSG.MODEL_LOAD_PROGRESS,
          data: {
            modelId,
            file: progress.file,
            progress: avg,
            loaded: progress.loaded,
            total: progress.total,
          },
        });
      } else if (progress.status === "done") {
        fileProgress.set(progress.file, 100);
        completedFiles++;
        self.postMessage({
          type: MSG.MODEL_LOAD_DONE,
          data: { modelId, file: progress.file },
        });
      }
    };

    // VisionEncoderDecoder models (latex OCR) need full-precision fp32
    const isLatexModel = modelId.includes('latex') || modelId.includes('nougat') || modelId.includes('TexTeller') || modelId.includes('chandra');
    const modelOptions = {
      ...options,
      quantized: isLatexModel ? false : (options.quantized ?? true),
      dtype: isLatexModel ? 'fp32' : (options.dtype ?? undefined),
      device: options.device ?? "wasm",
    };
    await getModel(task, modelId, modelOptions, progressCallback);

    self.postMessage({
      type: MSG.MODEL_LOAD_COMPLETE,
      data: { modelId, task },
    });
  } catch (err: any) {
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
      // Input arrives as a Uint8Array via structured clone from postMessage.
      // Cross-realm instanceof checks (e.g. `input instanceof Uint8Array`,
      // `input instanceof Blob`) FAIL in Blob URL workers because each
      // realm has its own constructor identity.
      //
      // Transformers.js RawImage.read() only accepts:
      //   string | URL | Blob | HTMLCanvasElement | OffscreenCanvas | RawImage
      // and its own `instanceof Blob` check also fails cross-realm.
      //
      // SOLUTION: Convert raw bytes → Blob → Object URL (a plain string).
      // Transformers.js reliably handles strings via fromURL → fetch → blob,
      // all within its own realm, so no cross-realm instanceof issues.
      if (typeof input === "string") {
        // Already a URL string — pass through
        processedInput = input;
      } else {
        // Convert whatever byte-like input we received into a Uint8Array
        let bytes: Uint8Array;
        if (ArrayBuffer.isView(input)) {
          bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        } else if (input instanceof ArrayBuffer) {
          bytes = new Uint8Array(input);
        } else if (input?.buffer || input?.byteLength !== undefined) {
          // Duck-typed cross-realm typed array
          bytes = new Uint8Array(input.buffer || input);
        } else if (input && typeof input === "object") {
          // Last resort: plain object with numeric indices (structured clone artefact)
          const values = Object.values(input) as number[];
          bytes = new Uint8Array(values);
        } else {
          throw new Error(
            `Cannot convert input to image. Type: ${typeof input}, ` +
            `constructor: ${input?.constructor?.name}, ` +
            `keys: ${Object.keys(input || {}).slice(0, 5).join(",")}`
          );
        }
        // Create an Object URL — a plain string that Transformers.js can fetch
        const blob = new Blob([bytes], { type: "image/png" });
        const objectUrl = URL.createObjectURL(blob);
        log("Created Object URL for image input:", objectUrl, "from", bytes.length, "bytes");

        // TexTeller3 expects grayscale (1 channel) but canvas exports RGBA (4 channels).
        // Use RawImage to load, convert to grayscale, and boost contrast so thin
        // handwriting strokes are high-contrast against the white background.
        if (_RawImage) {
          const rawImg = await _RawImage.fromURL(objectUrl);
          URL.revokeObjectURL(objectUrl);
          const grayImg = rawImg.grayscale();

          // ── Contrast normalization (min-max stretch to 0-255) ──
          // This ensures thin pen strokes (faint gray) are pushed to solid
          // black, while the white background stays white.
          const pixelData = grayImg.data; // Uint8Array of pixel values
          let pMin = 255;
          let pMax = 0;
          for (let i = 0; i < pixelData.length; i++) {
            if (pixelData[i] < pMin) pMin = pixelData[i];
            if (pixelData[i] > pMax) pMax = pixelData[i];
          }
          const range = pMax - pMin || 1; // avoid division by zero
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
      // Handle various output formats from different models
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
