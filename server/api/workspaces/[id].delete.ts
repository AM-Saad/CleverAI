import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id) {
    throw Errors.badRequest("Workspace id is required");
  }

  const result = await prisma.workspace.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    throw Errors.notFound("Workspace");
  }
  return success({ deleted: true });
});
