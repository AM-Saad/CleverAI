import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const parsed = CreateFolderDTO.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const { metadata } = parsed.data;
  const title = parsed.data.title.trim();
  const description = parsed.data.description?.trim() ?? null;


  const maxOrder = await prisma.folder.aggregate({
    _max: { order: true },
    where: { userId: user.id },
  });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  const created = await prisma.folder.create({
    data: {
      title,
      description: description ?? null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      order: nextOrder,
      user: { connect: { id: user.id } },
    },
  });

  if (process.env.NODE_ENV === "development") FolderSchema.parse(created);
  setResponseStatus(event, 201);
  return success(created);
});
