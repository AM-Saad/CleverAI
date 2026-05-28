import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { SupportedLanguageCodeSchema } from "@shared/utils/language.contract";
import { getLanguageReviewQueue } from "@server/modules/language-learning/application/getLanguageReviewQueue";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  targetLanguage: SupportedLanguageCodeSchema.optional(),
  nativeLanguage: SupportedLanguageCodeSchema.optional(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let parsedQuery: z.infer<typeof querySchema>;
  try {
    parsedQuery = querySchema.parse(getQuery(event));
  } catch (e) {
    if (e instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid query parameters",
        e.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  return success(
    await getLanguageReviewQueue({
      prisma,
      userId: user.id,
      ...parsedQuery,
    }),
  );
});
