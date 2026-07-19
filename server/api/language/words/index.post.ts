import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { SaveLanguageWordDTO } from "@shared/utils/language.contract";
import { saveLanguageWord } from "@server/modules/language-learning/application/saveLanguageWord";
import { projectLanguageOfflineState } from "@server/modules/offline/application/projectLanguageOfflineState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  let data;
  try {
    data = SaveLanguageWordDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid request body", error.issues);
    }
    throw Errors.badRequest("Invalid request body");
  }

  const prisma = event.context.prisma;
  const result = await saveLanguageWord({ prisma, userId: user.id, data });
  const review = await prisma.languageCardReview.findUnique({
    where: {
      userId_wordId: {
        userId: user.id,
        wordId: result.wordId!,
      },
    },
  });
  const projection = await projectLanguageOfflineState({
    prisma,
    userId: user.id,
    word: { id: result.wordId!, changedFields: ["status"] },
    review: review
      ? { id: review.id, changedFields: ["reviewState"] }
      : undefined,
  });

  return success({ ...result, projection });
});
