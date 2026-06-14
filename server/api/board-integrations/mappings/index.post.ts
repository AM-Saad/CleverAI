import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  CreateExternalBoardMappingDTO,
  ExternalBoardMappingSchema,
} from "../../../../shared/utils/boardIntegration.contract";
import { serializeExternalBoardMapping } from "@server/modules/integrations/application/boardIntegrationSerialization";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let body: CreateExternalBoardMappingDTO;
  try {
    body = CreateExternalBoardMappingDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid mapping payload",
        error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      );
    }
    throw error;
  }

  const [account, workspace] = await Promise.all([
    integrationRepository.findAccount(prisma, {
      id: body.accountId,
      userId: user.id,
    }),
    prisma.workspace.findFirst({
      where: { id: body.workspaceId, userId: user.id },
      select: { id: true },
    }),
  ]);

  if (!account) throw Errors.notFound("Integration account");
  if (!workspace) throw Errors.notFound("Workspace");

  const mapping = await integrationRepository.upsertMapping(prisma, {
    userId: user.id,
    workspaceId: body.workspaceId,
    provider: account.provider,
    externalContainerId: body.externalContainerId,
    data: {
      accountId: integrationRepository.oid(account.id),
      externalContainerKey: body.externalContainerKey ?? null,
      name: body.name,
      syncDirection: body.syncDirection,
      fieldMapping: body.fieldMapping,
      status: "ACTIVE",
      lastError: null,
    },
  });

  return success(
    ExternalBoardMappingSchema.parse(serializeExternalBoardMapping(mapping)),
  );
});
