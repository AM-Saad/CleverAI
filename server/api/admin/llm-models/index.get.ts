// server/api/admin/llm-models/index.get.ts
import { defineEventHandler } from "h3";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";
import { getAvailableModels } from "@server/utils/llm/modelRegistry";

/**
 * List all LLM models in the registry
 * Admin endpoint for monitoring and management
 */
export default defineEventHandler(async (event) => {
  // Require admin role
  await requireRole(event, ["ADMIN"]);

  try {
    const models = await getAvailableModels();

    return success({
      models,
      count: models.length,
    });
  } catch (err) {
    console.error("[admin/llm-models] Failed to fetch models:", err);
    throw Errors.server("Failed to fetch models");
  }
});
