/**
 * AI Worker Plugin — Client-side only
 *
 * Registers a dedicated Web Worker for ML model inference using Transformers.js.
 * This keeps heavy ONNX inference off the main thread, preventing UI blocking.
 *
 * ARCHITECTURE:
 *  - Worker source: sw-src/ai-worker.ts → built to public/ai-worker.js
 *  - Message protocol: ai-messages.ts (typed contracts)
 *  - Global access: $aiWorker injected into useNuxtApp()
 *  - Event bridge: CustomEvents dispatched on window for reactive listening
 *
 * NOTE: We fetch the worker script and create a Blob URL worker instead of
 * using `new Worker("/ai-worker.js")` directly. This avoids the service worker
 * intercepting the request (it matches `request.destination === "script"`)
 * and potentially serving a cached/stub response that breaks the worker.
 *
 * @see docs/AI_WORKER_ARCHITECTURE.md
 */

import type { IncomingAIMessage } from "@@/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";

export default defineNuxtPlugin(() => {
  // Only run client-side (guards against SSR attempts)
  if (process.server) return {};

  let worker: Worker | null = null;
  const messageQueue: IncomingAIMessage[] = [];
  let isWorkerReady = false;

  /**
   * Create the worker from a Blob URL to bypass service worker interception.
   * The SW's CacheFirst strategy for `request.destination === "script"`
   * intercepts `/ai-worker.js` and may serve stale or stub content.
   * Blob URL workers are never intercepted by the SW.
   */
  async function createWorker(): Promise<Worker> {
    console.log("[AI Worker Plugin] Fetching /ai-worker.js (bypassing SW via fetch cache)...");

    // Use cache: "no-store" to get fresh content, bypassing SW cache
    const response = await fetch("/ai-worker.js", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ai-worker.js: ${response.status} ${response.statusText}`);
    }

    const scriptText = await response.text();
    console.log(`[AI Worker Plugin] Fetched worker script (${scriptText.length} chars)`);

    const blob = new Blob([scriptText], { type: "application/javascript" });
    const blobURL = URL.createObjectURL(blob);

    const w = new Worker(blobURL);

    // Revoke blob URL after worker starts (it's already loaded)
    // Slight delay to ensure the worker has loaded the script
    setTimeout(() => URL.revokeObjectURL(blobURL), 5000);

    return w;
  }

  // Start worker creation
  createWorker()
    .then((w) => {
      worker = w;
      console.log("[AI Worker Plugin] Worker created via Blob URL");

      // ── Worker → Window message handler ──
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data;

        // Log worker-level errors (Transformers.js load failure, unhandled errors)
        if (message.type === "WORKER_ERROR") {
          console.error("[AI Worker] Worker error:", message.data?.message, message.data?.stack);
        }

        // Dispatch as CustomEvent so composables can listen via window.addEventListener
        const customEvent = new CustomEvent("ai-worker-message", {
          detail: message,
        });
        window.dispatchEvent(customEvent);

        // Mark ready when worker signals initialization complete
        if (message.type === AI_WORKER_MESSAGE_TYPES.WORKER_READY) {
          isWorkerReady = true;
          console.log("✅ [AI Worker] Ready");

          // Flush queued messages that were sent before worker was ready
          while (messageQueue.length > 0) {
            const queued = messageQueue.shift();
            if (queued && worker) {
              worker.postMessage(queued);
            }
          }
        }
      };

      // ── Worker error handler ──
      worker.onerror = (error: ErrorEvent) => {
        console.error("[AI Worker] Error event:", {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          error: error.error,
        });
        const customEvent = new CustomEvent("ai-worker-error", {
          detail: {
            error:
              error.message || error.error?.message || "Unknown worker error",
            filename: error.filename,
            lineno: error.lineno,
          },
        });
        window.dispatchEvent(customEvent);
      };
    })
    .catch((err) => {
      console.error("[AI Worker] Failed to create worker:", err);
    });

  // ── Cleanup on page unload ──
  window.addEventListener("beforeunload", () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  });

  // ── Window → Worker message wrapper with queueing ──
  const postMessageToWorker = (message: IncomingAIMessage) => {
    if (!worker) {
      // Worker may still be loading (async creation) — queue the message
      console.log("[AI Worker] Queuing message (worker loading):", message.type);
      messageQueue.push(message);
      return;
    }

    // Queue messages until worker signals ready (prevents race conditions)
    if (!isWorkerReady) {
      console.log(
        "[AI Worker] Queuing message (worker not ready yet):",
        message.type
      );
      messageQueue.push(message);
      return;
    }

    console.log("[AI Worker] Sending message:", message.type);
    worker.postMessage(message);
  };

  // ── Provide global access via $aiWorker ──
  return {
    provide: {
      aiWorker: {
        postMessage: postMessageToWorker,
        terminate: () => worker?.terminate(),
        get ready() {
          return isWorkerReady;
        },
      },
    },
  };
});
