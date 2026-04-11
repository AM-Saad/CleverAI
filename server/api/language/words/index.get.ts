import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguageWordsQuerySchema } from "@shared/utils/language.contract";

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
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid query parameters");
  }

  const { status, limit, cursor } = query;

  const words = await prisma.languageWord.findMany({
    where: {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      stories: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, storyText: true, sentences: true },
      },
    },
  });

  return success({
    words,
    nextCursor:
      words.length === limit
        ? words[words.length - 1].createdAt.toISOString()
        : null,
  });
});
