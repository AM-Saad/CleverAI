import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { GenerateStoryDTO } from "@shared/utils/language.contract";
import { generateLanguageStory } from "@server/modules/language-learning/application/generateLanguageStory";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import { projectLanguageOfflineState } from "@server/modules/offline/application/projectLanguageOfflineState";

const quotaPort = new PrismaQuotaPort();

export default defineEventHandler(async (event) => {
  let data: GenerateStoryDTO;
  try {
    data = GenerateStoryDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const user = await requireRole(event, ["USER"]);
  const result = await generateLanguageStory({ event, user, data, quotaPort });
  const prisma = event.context.prisma;
  const review = await prisma.languageCardReview.findUnique({
    where: {
      userId_wordId: { userId: user.id, wordId: result.wordId },
    },
  });
  const projection = await projectLanguageOfflineState({
    prisma,
    userId: user.id,
    word: { id: result.wordId, changedFields: ["stories", "status"] },
    review: review
      ? { id: review.id, changedFields: ["storyId", "reviewState"] }
      : undefined,
  });
  return success({ ...result, projection });
});
