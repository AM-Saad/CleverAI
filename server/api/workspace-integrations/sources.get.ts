import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ExternalSourceSchema } from "../../../shared/utils/workspaceIntegration.contract";
import { getProviderAccountContext } from "@server/modules/integrations/application/providerAccountContext";
import { throwActionableIntegrationError } from "@server/modules/integrations/application/integrationRouteErrors";
import { getWorkspaceProvider } from "@server/modules/integrations/infrastructure/providers";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

const QuerySchema = z.object({
  accountId: z.string(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof ZodError) throw Errors.badRequest("Invalid sources query");
    throw error;
  }

  const account = await integrationRepository.findAccount(prisma, {
    id: query.accountId,
    userId: user.id,
  });
  if (!account) throw Errors.notFound("Integration account");

  try {
    const provider = getWorkspaceProvider(account.provider);
    const providerAccount = await getProviderAccountContext({
      prisma,
      userId: user.id,
      account,
    });
    const sources = await provider.listSources(providerAccount);
    return success(sources.map((source) => ExternalSourceSchema.parse(source)));
  } catch (error) {
    throwActionableIntegrationError(error, account.provider, "load integration sources");
  }
});
