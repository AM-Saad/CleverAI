import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const query = getQuery(event);
  const workspaceId = typeof query.workspaceId === "string" ? query.workspaceId : undefined;

  const [accounts, mappings] = await Promise.all([
    integrationRepository.listAccounts(prisma, { userId: user.id }),
    integrationRepository.listWorkspaceMappings(prisma, {
      userId: user.id,
      workspaceId,
    }),
  ]);

  return success({
    accounts: accounts.map((account: any) => ({
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      accountUrl: account.accountUrl ?? null,
      tokenExpiresAt: account.tokenExpiresAt ?? null,
    })),
    mappings: mappings.map((mapping: any) => ({
      id: mapping.id,
      provider: mapping.provider,
      source: mapping.name,
      targetType: mapping.targetType,
      status: mapping.status,
      lastSyncedAt: mapping.lastSyncedAt ?? null,
      lastError: mapping.lastError ?? null,
    })),
  });
});
