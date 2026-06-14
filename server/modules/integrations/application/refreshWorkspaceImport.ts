import type { RefreshWorkspaceImportDTO } from "../../../../shared/utils/workspaceIntegration.contract";
import { importWorkspaceContent } from "./importWorkspaceContent";
import { integrationRepository } from "../infrastructure/integrationRepository";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function refreshWorkspaceImport(input: {
  prisma: any;
  userId: string;
  request: RefreshWorkspaceImportDTO;
}) {
  const mapping = await integrationRepository.findWorkspaceMapping(input.prisma, {
    id: input.request.mappingId,
    userId: input.userId,
  });
  if (!mapping) throw new Error("Workspace integration mapping not found");

  const importOptions = asRecord(mapping.importOptions);
  const contentKinds = Array.isArray(importOptions.contentKinds)
    ? importOptions.contentKinds.filter((kind): kind is "TASK" | "DOCUMENT" =>
      kind === "TASK" || kind === "DOCUMENT",
    )
    : mapping.targetType === "NOTE"
      ? ["DOCUMENT" as const]
      : ["TASK" as const];

  return importWorkspaceContent({
    prisma: input.prisma,
    userId: input.userId,
    request: {
      workspaceId: mapping.workspaceId,
      accountId: mapping.accountId,
      mappingId: mapping.id,
      sourceId: mapping.externalSourceId,
      sourceKey: mapping.externalSourceKey ?? null,
      sourceName: mapping.name,
      targetType: mapping.targetType,
      contentKinds,
      noteGroupId: mapping.targetGroupId ?? null,
      noteGroupTitle: typeof importOptions.noteGroupTitle === "string"
        ? importOptions.noteGroupTitle
        : undefined,
      limit: typeof importOptions.limit === "number" ? importOptions.limit : 50,
      fieldMapping: asRecord(mapping.fieldMapping),
      importOptions,
    },
  });
}
