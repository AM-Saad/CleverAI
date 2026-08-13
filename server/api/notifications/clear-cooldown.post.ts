import { defineEventHandler } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";

/**
 * Debug helper: clears the caller's own CARD_DUE cooldown so the next cron tick
 * can notify them again. Scoped to the requesting user — it used to delete every
 * user's rows behind an unvalidated cookie-presence check.
 */
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);

  const result = await prisma.scheduledNotification.deleteMany({
    where: {
      userId: user.id,
      type: "CARD_DUE",
      scheduledFor: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });

  return success(
    { count: result.count },
    { message: `Cleared ${result.count} recent notifications` }
  );
});
