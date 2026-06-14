import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { WorkspaceImportMappingSummarySchema } from "../../../../shared/utils/workspaceIntegration.contract";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";
import { serializeWorkspaceMapping } from "@server/modules/integrations/application/workspaceIntegrationSerialization";

const QuerySchema = z.object({
  workspaceId: z.string().optional(),
});

function countRefs(refs: any[]) {
  return refs.reduce(
    (acc, ref) => {
      acc.total += 1;
      if (ref.syncStatus === "CONFLICT") acc.conflicted += 1;
      else if (ref.syncStatus === "ERROR") acc.error += 1;
      else if (ref.syncStatus === "LOCAL_CHANGED") acc.localChanged += 1;
      else if (ref.syncStatus === "SYNCED") acc.synced += 1;
      return acc;
    },
    { total: 0, synced: 0, localChanged: 0, conflicted: 0, error: 0 },
  );
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof ZodError) throw Errors.badRequest("Invalid mappings query");
    throw error;
  }

  const mappings = await integrationRepository.listWorkspaceMappings(prisma, {
    userId: user.id,
    workspaceId: query.workspaceId,
  });

  const summaries = await Promise.all(mappings.map(async (mapping: any) => {
    const refs = await integrationRepository.listWorkspaceRefs(prisma, {
      userId: user.id,
      workspaceId: mapping.workspaceId,
      accountId: mapping.accountId,
      mappingId: mapping.id,
    });
    return WorkspaceImportMappingSummarySchema.parse({
      ...serializeWorkspaceMapping(mapping),
      refCounts: countRefs(refs),
    });
  }));

  return success(summaries);
});
