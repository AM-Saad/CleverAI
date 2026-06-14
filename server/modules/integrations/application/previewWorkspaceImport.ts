import type { PreviewWorkspaceImportDTO } from "../../../../shared/utils/workspaceIntegration.contract";
import { PreviewWorkspaceImportResponseSchema } from "../../../../shared/utils/workspaceIntegration.contract";
import { getWorkspaceProvider } from "../infrastructure/providers";
import { integrationRepository } from "../infrastructure/integrationRepository";
import { getProviderAccountContext } from "./providerAccountContext";

export async function previewWorkspaceImport(input: {
  prisma: any;
  userId: string;
  request: PreviewWorkspaceImportDTO;
}) {
  const { prisma, request, userId } = input;

  const [workspace, account] = await Promise.all([
    prisma.workspace.findFirst({
      where: { id: request.workspaceId, userId },
      select: { id: true },
    }),
    integrationRepository.findAccount(prisma, {
      id: request.accountId,
      userId,
    }),
  ]);

  if (!workspace) throw new Error("Workspace not found");
  if (!account) throw new Error("Integration account not found");

  const provider = getWorkspaceProvider(account.provider);
  const providerAccount = await getProviderAccountContext({ prisma, userId, account });
  const sources = await provider.listSources(providerAccount);
  const source = sources.find((candidate) => candidate.id === request.sourceId);
  const preview = await provider.previewSource({
    account: providerAccount,
    sourceId: request.sourceId,
    sourceKey: request.sourceKey,
    limit: request.limit,
    targetType: request.targetType,
    contentKinds: request.contentKinds,
    fieldMapping: request.fieldMapping,
    importOptions: request.importOptions,
  });

  return PreviewWorkspaceImportResponseSchema.parse({
    source,
    ...preview,
  });
}
