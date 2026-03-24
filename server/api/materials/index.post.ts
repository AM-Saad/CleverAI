import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let data;
  try {
    data = CreateMaterialDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: data.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const material = await prisma.material.create({
    data: {
      workspaceId: data.workspaceId,
      title: data.title,
      content: data.content,
      type: data.type,
      llmModel: data.llmModel,
      metadata: data.metadata
        ? JSON.parse(JSON.stringify(data.metadata))
        : null,
    },
  });

  if (process.env.NODE_ENV === "development") {
    MaterialSchema.parse(material);
  }

  return success(material, {
    message: "Material created successfully",
    materialId: material.id,
    workspaceId: data.workspaceId,
  });
});
