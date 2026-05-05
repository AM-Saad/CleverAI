import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  BoardItemsSyncRequestSchema,
  BoardItemsSyncResponseSchema,
} from "~/shared/utils/boardItem.contract";
import { syncBoardItems } from "@server/modules/board/application/syncBoardItems";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let parsed: ReturnType<typeof BoardItemsSyncRequestSchema.parse>;
  try {
    parsed = BoardItemsSyncRequestSchema.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid board items in request",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid board items");
  }

  const response = await syncBoardItems({
    prisma,
    userId: user.id,
    request: parsed,
  });

  if (process.env.NODE_ENV === "development") {
    BoardItemsSyncResponseSchema.parse(response);
  }

  const successCount = response.results.filter(
    (r) => r.status !== "error"
  ).length;
  const errorCount = response.results.filter((r) => r.status === "error").length;

  return success(response, {
    message: `Synced ${successCount} board items, ${errorCount} errors`,
    successCount,
    errorCount,
  });
});
