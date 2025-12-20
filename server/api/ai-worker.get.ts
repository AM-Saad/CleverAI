import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export default defineEventHandler(async (event) => {
  try {
    // Try multiple paths - Vercel serverless has different structure than local dev
    const possiblePaths = [
      join(process.cwd(), "public", "ai-worker.js"), // Local dev
      join(process.cwd(), ".output", "public", "ai-worker.js"), // Nitro build
      join(process.cwd(), ".vercel", "output", "static", "ai-worker.js"), // Vercel
      "/var/task/public/ai-worker.js", // Vercel serverless absolute
      "/var/task/.output/public/ai-worker.js", // Vercel serverless nitro output
    ];

    let workerPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        workerPath = path;
        break;
      }
    }

    if (!workerPath) {
      console.error(
        "[AI Worker API] Worker file not found in any path:",
        possiblePaths
      );
      throw createError({
        statusCode: 404,
        statusMessage: "AI worker file not found",
        message: `Worker file not found. Checked paths: ${possiblePaths.join(", ")}`,
      });
    }

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
