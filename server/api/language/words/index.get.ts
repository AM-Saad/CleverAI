import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguageWordsQuerySchema } from "@shared/utils/language.contract";
import { listLanguageWords } from "@server/modules/language-learning/application/listLanguageWords";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let query;
  try {
    query = LanguageWordsQuerySchema.parse(getQuery(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  return success(
    await listLanguageWords({
      prisma,
      userId: user.id,
      ...query,
    }),
  );
});
