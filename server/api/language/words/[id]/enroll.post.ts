import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { enrollLanguageWord } from "@server/modules/language-learning/application/enrollLanguageWord";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  const result = await enrollLanguageWord({ prisma, userId: user.id, wordId: id });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "languageWord", entityId: id, changedFields: ["status"] });
  return success(result);
});
