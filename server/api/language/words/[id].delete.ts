import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { projectLanguageOfflineState } from "@server/modules/offline/application/projectLanguageOfflineState";

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

  const review = await prisma.languageCardReview.findUnique({
    where: { userId_wordId: { userId: user.id, wordId: id } },
    select: { id: true },
  });
  await prisma.languageWord.delete({ where: { id } });
  const projection = await projectLanguageOfflineState({
    prisma,
    userId: user.id,
    word: { id, changedFields: ["deleted"], deleted: true },
    review: review
      ? {
          id: review.id,
          changedFields: ["deleted"],
          deleted: true,
        }
      : undefined,
  });

  return success({ message: "Word deleted successfully", projection });
});
