import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { saveGeneratedArtifacts } from "@server/modules/ai-generation/application/saveGeneratedArtifacts";
import {
  CommitMaterialGenerationRequestSchema,
  CommitMaterialGenerationResponseSchema,
} from "@@/shared/utils/llm-generate.contract";

const ParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Workspace ID must be valid"),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const params = ParamSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw Errors.badRequest("Invalid workspace ID", params.error.issues);
  }
  const body = CommitMaterialGenerationRequestSchema.safeParse(
    await readBody(event),
  );
  if (!body.success) {
    throw Errors.badRequest("Invalid generated content", body.error.issues);
  }
  const workspace = await prisma.workspace.findFirst({
    where: { id: params.data.id, userId: user.id },
    select: { id: true },
  });
  if (!workspace) throw Errors.notFound("Workspace");

  const committed = await saveGeneratedArtifacts({
    prisma,
    userId: user.id,
    task: body.data.task,
    workspaceId: workspace.id,
    replace: false,
    result: body.data.items,
  });
  return success(CommitMaterialGenerationResponseSchema.parse(committed), {
    message: "Generated content added to review",
  });
});
