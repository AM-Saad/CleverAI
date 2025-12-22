import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  // Require USER role - in production, consider restricting to ADMIN
  await requireRole(event, ["USER"]);

  const subscriptions = await prisma.notificationSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      userId: true,
      createdAt: true,
      expiresAt: true,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const maskedSubscriptions = subscriptions.map((sub) => ({
    ...sub,
    endpoint: sub.endpoint.substring(0, 50) + "...",
  }));

  return success(maskedSubscriptions, { total: subscriptions.length });
});
