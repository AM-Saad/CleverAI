import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";
import {
  BoardIntegrationProviderSchema,
  BoardIntegrationAccountSchema,
} from "../../../../shared/utils/boardIntegration.contract";
import { serializeIntegrationAccount } from "@server/modules/integrations/application/boardIntegrationSerialization";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const query = getQuery(event);
  const provider =
    typeof query.provider === "string"
      ? BoardIntegrationProviderSchema.parse(query.provider)
      : undefined;

  const accounts = await integrationRepository.listAccounts(prisma, {
    userId: user.id,
    provider,
  });

  return success(accounts.map((account: any) =>
    BoardIntegrationAccountSchema.parse(serializeIntegrationAccount(account)),
  ));
});
