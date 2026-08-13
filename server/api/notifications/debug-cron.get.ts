import { checkDueCards } from "@server/tasks/check-due-cards";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

/**
 * Debug trigger for the full card sweep. It processes every user, so it cannot
 * be scoped to the caller — dev-only, and authenticated even there. Production
 * uses /api/notifications/cron/check-due-cards with the cron token.
 */
export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV !== "development") {
    throw Errors.notFound("endpoint");
  }
  await requireRole(event, ["USER"]);

  const result = await checkDueCards();
  return success(result, {
    message: "Card due notifications check completed (debug)",
  });
});
