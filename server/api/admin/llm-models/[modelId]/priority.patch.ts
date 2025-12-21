// server/api/admin/llm-models/[modelId]/priority.patch.ts
import { defineEventHandler, getRouterParam, readBody } from "h3";
import { Errors, success } from "@server/utils/error";
import { prisma } from "@server/utils/prisma";
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";

const PrioritySchema = z.object({
  priority: z.number().int().min(1).max(100),
});

/**
 * Update model priority
 * Lower priority = preferred (e.g., 1 is highest priority)
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

  const modelId = getRouterParam(event, "modelId");
  if (!modelId) {
    throw Errors.badRequest("modelId is required");
  }

  const body = await readBody(event);
  const parseResult = PrioritySchema.safeParse(body);

  if (!parseResult.success) {
    throw Errors.badRequest(
      "Invalid request body",
      parseResult.error.flatten()
    );
  }

  const { priority } = parseResult.data;

  try {
    const updated = await prisma.llmModelRegistry.update({
      where: { modelId },
      data: { priority },
    });

    console.info("[admin/llm-models] Updated priority:", {
      modelId,
      priority: updated.priority,
    });

    return success({
      model: updated,
      message: `Model priority updated to ${priority}`,
    });
  } catch (err) {
    console.error("[admin/llm-models] Failed to update priority:", {
      modelId,
      error: err,
    });
    throw Errors.server("Failed to update priority");
  }
});
