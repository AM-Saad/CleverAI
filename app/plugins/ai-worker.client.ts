// AI Worker registration plugin
// Manages AI worker lifecycle and provides global access
// Follows the same pattern as sw-register.client.ts

import { defineNuxtPlugin } from "#app";
import type { OutgoingAIMessage } from "~/shared/types/ai-messages";
import { AI_WORKER_MESSAGE_TYPES } from "~/utils/constants/pwa";

export default defineNuxtPlugin(() => {
  // Skip in SSR
  if (import.meta.server) return;

  // Check Worker support
  if (typeof Worker === "undefined") {
    console.warn("[AI Worker] Web Workers not supported in this browser");
    return;
  }

  let worker: Worker | null = null;
  let isReady = false;
  const messageQueue: unknown[] = [];

  try {
    // Create the AI worker from API endpoint (gets proper COEP headers)
    // Static files in public/ don't get headers from middleware, so we serve through API
    console.log("[AI Worker] Initializing worker from /api/ai-worker");

    // Check if worker endpoint is accessible before creating worker
    fetch("/api/ai-worker", { method: "HEAD" })
      .then((response) => {
        if (!response.ok) {
          console.error(
            `[AI Worker] Worker endpoint not found (${response.status}). Make sure to run 'yarn ai-worker:build' before starting the dev server.`
          );
        } else {
          console.log(
            `[AI Worker] Worker endpoint ready (${response.status}), COEP: ${response.headers.get("cross-origin-embedder-policy")}`
          );
        }
      })
      .catch((err) => {
        console.error("[AI Worker] Failed to check worker endpoint:", err);
      });

    worker = new Worker("/api/ai-worker", {
      name: "ai-worker",
      type: "module", // Use ES module worker to avoid Webpack bundling issues
    });
    console.log(
      "[AI Worker] Worker created (ESM), waiting for WORKER_READY message..."
    );

    // Set a timeout to detect if worker never initializes
    const initTimeout = setTimeout(() => {
      if (!isReady) {
        console.error(
          "[AI Worker] Worker initialization timeout - WORKER_READY message not received after 5 seconds.",
          "\nPossible causes:",
          "\n1. Worker script has syntax errors",
          "\n2. Worker file is too large and taking long to parse",
          "\n3. Check browser console for JavaScript errors in the worker"
        );
      }
    }, 5000);

    // Handle messages from worker
    worker.addEventListener(
      "message",
      (event: MessageEvent<OutgoingAIMessage>) => {
        const message = event.data;

        // Check for worker ready
        if (message.type === AI_WORKER_MESSAGE_TYPES.WORKER_READY) {
          console.log("[AI Worker] Ready");
          clearTimeout(initTimeout);
          isReady = true;

          // Process queued messages
          while (messageQueue.length > 0) {
            const queuedMsg = messageQueue.shift();
            worker?.postMessage(queuedMsg);
          }
          return;
        }

        // Handle worker error messages
        if (message.type === "WORKER_ERROR") {
          console.error("[AI Worker] Worker reported error:", message.data);
          clearTimeout(initTimeout);
          window.dispatchEvent(
            new CustomEvent("ai-worker-error", {
              detail: message.data,
            })
          );
          return;
        }

        // Dispatch custom event for other plugins/components to listen
        window.dispatchEvent(
          new CustomEvent("ai-worker-message", {
            detail: message,
          })
        );
      }
    );

    // Handle worker errors
    worker.addEventListener("error", (error: ErrorEvent) => {
      const errorDetails = {
        message: error.message || "Unknown error",
        filename: error.filename || "unknown",
        lineno: error.lineno || 0,
        colno: error.colno || 0,
        error: error.error,
        type: error.type,
      };

      console.error("[AI Worker] Error:", errorDetails);

      // Additional helpful message based on error type
      if (!error.message && !error.filename) {
        console.error(
          "[AI Worker] This usually means the worker file failed to load. Check:",
          "\n1. Is /ai-worker.js accessible? (check Network tab)",
          "\n2. Run 'yarn ai-worker:build' to rebuild the worker",
          "\n3. Check browser console for CORS or CSP errors"
        );
      }

      window.dispatchEvent(
        new CustomEvent("ai-worker-error", {
          detail: errorDetails,
        })
      );
    });

    // Handle unhandled promise rejections in worker
    worker.addEventListener("messageerror", (event: MessageEvent) => {
      console.error("[AI Worker] Message error:", event);
    });

    // Provide global access to worker
    const aiWorker = {
      get worker() {
        return worker;
      },
      get isReady() {
        return isReady;
      },
      postMessage(message: unknown) {
        if (!worker) {
          console.warn("[AI Worker] Worker not initialized");
          return;
        }

        if (!isReady) {
          // Queue messages until worker is ready
          messageQueue.push(message);
          return;
        }

        worker.postMessage(message);
      },
      terminate() {
        if (worker) {
          worker.terminate();
          worker = null;
          isReady = false;
          messageQueue.length = 0;
          console.log("[AI Worker] Terminated");
        }
      },
    };

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      aiWorker.terminate();
    });

    return {
      provide: {
        aiWorker,
      },
    };
  } catch (error) {
    console.error("[AI Worker] Failed to initialize:", error);
  }
});
