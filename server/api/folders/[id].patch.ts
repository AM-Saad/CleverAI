import { requireRole } from "@server/middleware/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  const raw = await readBody(event);
  const ParsedUpdateDTO = UpdateFolderDTO;
  const parsed = ParsedUpdateDTO.safeParse(raw);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const body = parsed.data;

  const existing = await prisma.folder.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!existing) {
    throw Errors.notFound("Folder");
  }

  const folderData: Record<string, unknown> = {};
  if (typeof body.title === "string") folderData.title = body.title;
  if (typeof body.description === "string" || body.description === null)
    folderData.description = body.description ?? null;
  if (typeof body.order === "number") folderData.order = body.order;
  if (
    body.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata)
  ) {
    folderData.metadata = body.metadata;
  }
  if (typeof body.llmModel === "string") {
    if (!LLM_MODELS.includes(body.llmModel as (typeof LLM_MODELS)[number])) {
      throw Errors.badRequest(`Invalid llmModel: ${body.llmModel}`);
    }
    folderData.llmModel = body.llmModel;
  }
  if (typeof body.rawText === "string" || body.rawText === null) {
    folderData.rawText = body.rawText ?? null;
  }

  let materialCreated = false;
  if (body.materialContent) {
    const materialData = {
      folderId: id!,
      title: body.materialTitle || "Folder Content",
      content: body.materialContent,
      type: body.materialType || "text",
      llmModel: body.llmModel || existing.llmModel,
    };
    const existingMaterial = await prisma.material.findFirst({
      where: { folderId: id, title: materialData.title },
    });
    if (existingMaterial) {
      await prisma.material.update({
        where: { id: existingMaterial.id },
        data: {
          content: materialData.content,
          type: materialData.type,
          llmModel: materialData.llmModel,
        },
      });
    } else {
      await prisma.material.create({ data: materialData });
    }
    materialCreated = true;
  }

  let updated = existing;
  if (Object.keys(folderData).length > 0) {
    updated = await prisma.folder.update({
      where: { id: id },
      data: folderData,
      include: { materials: true, flashcards: true, questions: true },
    });
  } else {
    const freshFolder = await prisma.folder.findUnique({
      where: { id: id },
      include: { materials: true, flashcards: true, questions: true },
    });
    if (freshFolder) updated = freshFolder;
  }
  if (materialCreated && !Object.keys(folderData).length) {
    const freshFolder = await prisma.folder.findUnique({
      where: { id: id },
      include: { materials: true, flashcards: true, questions: true },
    });
    if (freshFolder) updated = freshFolder;
  }

  if (process.env.NODE_ENV === "development") {
    FolderSchema.parse(updated);
  }
  return success(updated);
});
