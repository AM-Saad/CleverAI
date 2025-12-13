import { readFile } from "fs/promises";
import { join } from "path";

export default defineEventHandler(async (event) => {
  try {
    // Read the worker file from public directory
    const workerPath = join(process.cwd(), "public", "ai-worker.js");
    const workerContent = await readFile(workerPath, "utf-8");

    // Set appropriate headers for the worker
    setHeader(event, "Content-Type", "application/javascript; charset=utf-8");
    setHeader(event, "Cross-Origin-Embedder-Policy", "credentialless");
    setHeader(event, "Cross-Origin-Opener-Policy", "same-origin");
    setHeader(event, "Cross-Origin-Resource-Policy", "same-origin");

    // Allow caching for performance
    setHeader(event, "Cache-Control", "public, max-age=3600");

    return workerContent;
  } catch (error: any) {
    console.error("[AI Worker API] Failed to serve worker file:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load AI worker",
      message: error.message,
    });
  }
});
