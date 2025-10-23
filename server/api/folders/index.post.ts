import { requireRole } from "@server/middleware/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const parsed = CreateFolderDTO.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const { llmModel, metadata } = parsed.data;
  const title = parsed.data.title.trim();
  const description = parsed.data.description?.trim() ?? null;

  if (
    llmModel &&
    !LLM_MODELS.includes(llmModel as (typeof LLM_MODELS)[number])
  ) {
    throw Errors.badRequest("Invalid LLM model");
  }
  const resolvedModel: (typeof LLM_MODELS)[number] | "gpt-3.5" =
    llmModel && LLM_MODELS.includes(llmModel as (typeof LLM_MODELS)[number])
      ? (llmModel as (typeof LLM_MODELS)[number])
      : "gpt-3.5";

  const maxOrder = await prisma.folder.aggregate({
    _max: { order: true },
    where: { userId: user.id },
  });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  const created = await prisma.folder.create({
    data: {
      title,
      description: description ?? null,
      llmModel: resolvedModel,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      order: nextOrder,
      user: { connect: { id: user.id } },
    },
  });

  if (process.env.NODE_ENV === "development") FolderSchema.parse(created);
  setResponseStatus(event, 201);
  return success(created);
});
