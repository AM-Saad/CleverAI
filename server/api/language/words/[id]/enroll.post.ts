import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { enrollLanguageWord } from "@server/modules/language-learning/application/enrollLanguageWord";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  return success(await enrollLanguageWord({ prisma, userId: user.id, wordId: id }));
});
