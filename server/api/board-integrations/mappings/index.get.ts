import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";
import {
  ExternalBoardMappingSchema,
} from "../../../../shared/utils/boardIntegration.contract";
import { serializeExternalBoardMapping } from "@server/modules/integrations/application/boardIntegrationSerialization";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

const QuerySchema = z.object({
  workspaceId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const query = QuerySchema.parse(getQuery(event));

  const mappings = await integrationRepository.listMappings(prisma, {
    userId: user.id,
    workspaceId: query.workspaceId,
  });

  return success(mappings.map((mapping: any) =>
    ExternalBoardMappingSchema.parse(serializeExternalBoardMapping(mapping)),
  ));
});
