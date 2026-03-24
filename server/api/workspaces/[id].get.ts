import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]); // throws if unauthorized
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id) {
    throw Errors.badRequest("Workspace ID is required");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id, userId: user.id },
    include: { materials: true, flashcards: true, questions: true },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }
  return success(workspace);
});
