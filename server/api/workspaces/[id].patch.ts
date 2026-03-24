import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  const raw = await readBody(event);
  const ParsedUpdateDTO = UpdateWorkspaceDTO;
  const parsed = ParsedUpdateDTO.safeParse(raw);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const body = parsed.data;

  const existing = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!existing) {
    throw Errors.notFound("Workspace");
  }

  const workspaceData: Record<string, unknown> = {};
  if (typeof body.title === "string") workspaceData.title = body.title;
  if (typeof body.description === "string" || body.description === null)
    workspaceData.description = body.description ?? null;
  if (typeof body.order === "number") workspaceData.order = body.order;
  if (
    body.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata)
  ) {
    workspaceData.metadata = body.metadata;
  }

  if (typeof body.rawText === "string" || body.rawText === null) {
    workspaceData.rawText = body.rawText ?? null;
  }

  let materialCreated = false;
  if (body.materialContent) {
    const materialData = {
      workspaceId: id!,
      title: body.materialTitle || "Workspace Content",
      content: body.materialContent,
      type: body.materialType || "text",
    };
    const existingMaterial = await prisma.material.findFirst({
      where: { workspaceId: id, title: materialData.title },
    });
    if (existingMaterial) {
      await prisma.material.update({
        where: { id: existingMaterial.id },
        data: {
          content: materialData.content,
          type: materialData.type,
        },
      });
    } else {
      await prisma.material.create({ data: materialData });
    }
    materialCreated = true;
  }

  let updated = existing;
  if (Object.keys(workspaceData).length > 0) {
    updated = await prisma.workspace.update({
      where: { id: id },
      data: workspaceData,
      include: { materials: true, flashcards: true, questions: true },
    });
  } else {
    const freshWorkspace = await prisma.workspace.findUnique({
      where: { id: id },
      include: { materials: true, flashcards: true, questions: true },
    });
    if (freshWorkspace) updated = freshWorkspace;
  }
  if (materialCreated && !Object.keys(workspaceData).length) {
    const freshWorkspace = await prisma.workspace.findUnique({
      where: { id: id },
      include: { materials: true, flashcards: true, questions: true },
    });
    if (freshWorkspace) updated = freshWorkspace;
  }

  if (process.env.NODE_ENV === "development") {
    WorkspaceSchema.parse(updated);
  }
  return success(updated);
});
