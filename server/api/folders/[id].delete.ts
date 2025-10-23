import { requireRole } from "@server/middleware/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id) {
    throw Errors.badRequest("Folder id is required");
  }

  const result = await prisma.folder.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    throw Errors.notFound("Folder");
  }
  return success({ deleted: true });
});
