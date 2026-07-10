import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

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
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "workspace", entityId: id, changedFields: ["deleted"], deleted: true });
  return success({ deleted: true });
});
