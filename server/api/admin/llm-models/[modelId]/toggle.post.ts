// server/api/admin/llm-models/[modelId]/toggle.post.ts
import { defineEventHandler, getRouterParam, readBody } from "h3";
import { Errors, success } from "@server/utils/error";
import { toggleModelEnabled } from "@server/utils/llm/modelRegistry";
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";

const ToggleSchema = z.object({
  enabled: z.boolean(),
});

/**
 * Toggle model enabled/disabled state
 * Admin endpoint for enabling/disabling models
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

  const modelId = getRouterParam(event, "modelId");
  if (!modelId) {
    throw Errors.badRequest("modelId is required");
  }

  const body = await readBody(event);
  const parseResult = ToggleSchema.safeParse(body);

  if (!parseResult.success) {
    throw Errors.badRequest(
      "Invalid request body",
      parseResult.error.flatten()
    );
  }

  const { enabled } = parseResult.data;

  try {
    const updated = await toggleModelEnabled(modelId, enabled);

    console.info("[admin/llm-models] Toggled model:", {
      modelId,
      enabled: updated.enabled,
    });

    return success({
      model: updated,
      message: `Model ${updated.enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (err) {
    console.error("[admin/llm-models] Failed to toggle model:", {
      modelId,
      error: err,
    });
    throw Errors.server("Failed to toggle model");
  }
});
