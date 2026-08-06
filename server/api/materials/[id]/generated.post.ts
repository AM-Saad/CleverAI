import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { saveGeneratedArtifacts } from "@server/modules/ai-generation/application/saveGeneratedArtifacts";
import {
  CommitMaterialGenerationRequestSchema,
  CommitMaterialGenerationResponseSchema,
} from "@@/shared/utils/llm-generate.contract";

const ParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Material ID must be a valid ObjectId"),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const params = ParamSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw Errors.badRequest("Invalid material ID", params.error.issues);
  }

  const body = CommitMaterialGenerationRequestSchema.safeParse(
    await readBody(event),
  );
  if (!body.success) {
    throw Errors.badRequest("Invalid generated content", body.error.issues);
  }

  const material = await prisma.material.findFirst({
    where: { id: params.data.id, workspace: { userId: user.id } },
    select: { id: true, workspaceId: true, type: true },
  });
  if (!material) {
    throw Errors.notFound("Material");
  }

  const committed = await saveGeneratedArtifacts({
    prisma,
    userId: user.id,
    task: body.data.task,
    workspaceId: material.workspaceId,
    materialId: material.id,
    replace: body.data.mode === "replace",
    loadedMaterialType: material.type,
    result: body.data.items,
  });

  const data = CommitMaterialGenerationResponseSchema.parse(committed);
  return success(data, {
    message:
      body.data.mode === "replace"
        ? "Generated content replaced and added to review"
        : "Generated content added to review",
  });
});
