import { z } from "zod";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id || !z.string().uuid().safeParse(id).success) {
    throw Errors.badRequest("Invalid material id");
  }

  const body = await readBody(event);
  const parsed = UpdateMaterialDTO.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.flatten());
  }
  const data = parsed.data;

  const material = await prisma.material.findFirst({
    where: { id, folder: { userId: user.id } },
  });
  if (!material) {
    throw Errors.notFound("material");
  }

  const updateData: Record<string, unknown> = {};
  if (typeof data.title === "string") updateData.title = data.title;
  if (typeof data.content === "string") updateData.content = data.content;
  if (typeof data.type === "string") updateData.type = data.type;
  if (typeof data.llmModel === "string") updateData.llmModel = data.llmModel;
  if (typeof data.llmPrompt === "string" || data.llmPrompt === null)
    updateData.llmPrompt = data.llmPrompt;
  if (data.metadata !== undefined)
    updateData.metadata = data.metadata
      ? JSON.parse(JSON.stringify(data.metadata))
      : null;

  if (Object.keys(updateData).length === 0) {
    throw Errors.badRequest("No valid fields to update");
  }

  const updated = await prisma.material.update({
    where: { id },
    data: updateData,
  });

  if (process.env.NODE_ENV === "development") {
    MaterialSchema.parse(updated);
  }

  return success(updated, { message: "Material updated" });
});
