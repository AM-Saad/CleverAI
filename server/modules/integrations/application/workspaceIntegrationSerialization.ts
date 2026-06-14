import type {
  WorkspaceExternalMapping,
  WorkspaceExternalRef,
  WorkspaceImportRefResult,
} from "../../../../shared/utils/workspaceIntegration.contract";
import { serializeIntegrationAccount } from "./boardIntegrationSerialization";

export { serializeIntegrationAccount };

export function serializeWorkspaceMapping(mapping: any): WorkspaceExternalMapping {
  return {
    id: mapping.id,
    workspaceId: mapping.workspaceId,
    accountId: mapping.accountId,
    provider: mapping.provider,
    externalSourceId: mapping.externalSourceId,
    externalSourceKey: mapping.externalSourceKey ?? null,
    sourceKind: mapping.sourceKind,
    targetType: mapping.targetType,
    targetGroupId: mapping.targetGroupId ?? null,
    name: mapping.name,
    fieldMapping: mapping.fieldMapping ?? {},
    importOptions: mapping.importOptions ?? {},
    status: mapping.status ?? "ACTIVE",
    lastSyncedAt: mapping.lastSyncedAt ?? null,
    lastError: mapping.lastError ?? null,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}

export function serializeWorkspaceRef(ref: any): WorkspaceExternalRef {
  return {
    id: ref.id,
    workspaceId: ref.workspaceId,
    accountId: ref.accountId,
    mappingId: ref.mappingId ?? null,
    targetType: ref.targetType,
    targetId: ref.targetId,
    provider: ref.provider,
    externalId: ref.externalId,
    externalKey: ref.externalKey ?? null,
    externalUrl: ref.externalUrl ?? null,
    externalUpdatedAt: ref.externalUpdatedAt ?? null,
    syncStatus: ref.syncStatus ?? "SYNCED",
    lastSyncedAt: ref.lastSyncedAt ?? null,
    lastError: ref.lastError ?? null,
    raw: ref.raw ?? null,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
  };
}

export function serializeWorkspaceImportRefResult(ref: any): WorkspaceImportRefResult {
  return {
    id: ref.id,
    targetType: ref.targetType,
    targetId: ref.targetId,
    externalId: ref.externalId,
    externalKey: ref.externalKey ?? null,
    syncStatus: ref.syncStatus ?? "SYNCED",
    lastError: ref.lastError ?? null,
  };
}
