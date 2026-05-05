// server/api/subscription/status.get.ts

import { requireRole } from "~~/server/utils/auth";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";

const quotaPort = new PrismaQuotaPort();

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);

  const quotaCheck = await quotaPort.checkGenerationQuota(user.id);

  return {
    subscription: quotaCheck.subscription,
  };
});
