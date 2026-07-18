import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  const word = await prisma.languageWord.findFirst({
    where: { id, userId: user.id },
  });
  if (!word) {
    throw Errors.notFound("Word");
  }

  await prisma.languageWord.delete({ where: { id } });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "languageWord", entityId: id, changedFields: ["deleted"], deleted: true });

  return success({ message: "Word deleted successfully" });
});
