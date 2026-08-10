import { z } from "zod";
import { LearningHomeQuerySchema } from "@shared/utils/learning-home.contract";
import { buildLearningHomeSnapshot } from "@server/modules/learning-home/application/buildLearningHomeSnapshot";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);

  let query: z.infer<typeof LearningHomeQuerySchema>;
  try {
    query = LearningHomeQuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid learning home query",
        error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      );
    }
    throw Errors.badRequest("Invalid learning home query");
  }

  try {
    const snapshot = await buildLearningHomeSnapshot({
      prisma: event.context.prisma,
      userId: user.id,
      timezoneOffsetMinutes: query.timezoneOffsetMinutes,
    });
    return success(snapshot);
  } catch (error) {
    console.error("[learn/home] Failed to build learning snapshot", error);
    throw Errors.server("Failed to load learning home");
  }
});
