// server/api/subscription/status.get.ts

import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);

  const quotaCheck = await checkUserQuota(user.id);

  return {
    subscription: quotaCheck.subscription,
  };
});
