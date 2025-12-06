// server/api/subscription/status.get.ts

import { requireRole } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);

  const quotaCheck = await checkUserQuota(user.id);

  return {
    subscription: quotaCheck.subscription,
  };
});
