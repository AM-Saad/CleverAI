import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { SupportedLanguageCodeSchema } from "@shared/utils/language.contract";
import { getLanguageStats } from "@server/modules/language-learning/application/getLanguageStats";

const querySchema = z.object({
  targetLanguage: SupportedLanguageCodeSchema.optional(),
  nativeLanguage: SupportedLanguageCodeSchema.optional(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(getQuery(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  return success(await getLanguageStats({ prisma, userId: user.id, ...query }));
});
