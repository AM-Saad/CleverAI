import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { enrollLanguageWord } from "@server/modules/language-learning/application/enrollLanguageWord";
import { projectLanguageOfflineState } from "@server/modules/offline/application/projectLanguageOfflineState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  const result = await enrollLanguageWord({
    prisma,
    userId: user.id,
    wordId: id,
  });
  const projection = await projectLanguageOfflineState({
    prisma,
    userId: user.id,
    word: { id, changedFields: ["status"] },
    review: result.reviewId
      ? {
          id: result.reviewId,
          changedFields: ["reviewState", "storyId"],
        }
      : undefined,
  });
  return success({ ...result, projection });
});
