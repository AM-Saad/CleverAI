import { defineEventHandler } from "h3";

export default defineEventHandler(async (event) => {
  const cronToken = getHeader(event, "x-cron-secret");
  const isInternalCronCall = cronToken === process.env.CRON_SECRET_TOKEN;
  const sessionCookie =
    getCookie(event, "next-auth.session-token") ||
    getCookie(event, "__Secure-next-auth.session-token");
  const isAuthenticatedUser = !!sessionCookie;

  if (
    process.env.NODE_ENV === "production" &&
    !isInternalCronCall &&
    !isAuthenticatedUser
  ) {
    throw Errors.unauthorized("Authorization required");
  }

  const result = await prisma.scheduledNotification.deleteMany({
    where: {
      type: "CARD_DUE",
      scheduledFor: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });

  return success(
    { count: result.count },
    { message: `Cleared ${result.count} recent notifications` }
  );
});
