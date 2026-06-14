import type {
  BoardIntegrationAccount,
  BoardItemExternalRef,
  ExternalBoardMapping,
} from "../../../../shared/utils/boardIntegration.contract";
import { decryptIntegrationToken } from "../infrastructure/tokenCipher";
import type { ProviderAccountContext } from "../domain/boardProvider";

export function serializeIntegrationAccount(account: any): BoardIntegrationAccount {
  return {
    id: account.id,
    provider: account.provider,
    externalAccountId: account.externalAccountId,
    displayName: account.displayName,
    accountUrl: account.accountUrl ?? null,
    scopes: account.scopes ?? [],
    metadata: account.metadata ?? {},
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function toProviderAccountContext(account: any): ProviderAccountContext {
  const accessToken = decryptIntegrationToken(account.accessTokenCiphertext);
  if (!accessToken) {
    throw new Error("Missing saved integration access token");
  }

  return {
    id: account.id,
    provider: account.provider,
    externalAccountId: account.externalAccountId,
    displayName: account.displayName,
    accountUrl: account.accountUrl ?? null,
    accessToken,
    refreshToken: decryptIntegrationToken(account.refreshTokenCiphertext),
    metadata: account.metadata ?? {},
  };
}

export function serializeExternalBoardMapping(mapping: any): ExternalBoardMapping {
  return {
    id: mapping.id,
    workspaceId: mapping.workspaceId,
    accountId: mapping.accountId,
    provider: mapping.provider,
    externalContainerId: mapping.externalContainerId,
    externalContainerKey: mapping.externalContainerKey ?? null,
    name: mapping.name,
    syncDirection: mapping.syncDirection,
    fieldMapping: mapping.fieldMapping ?? {},
    status: mapping.status,
    lastSyncedAt: mapping.lastSyncedAt ?? null,
    lastError: mapping.lastError ?? null,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}

export function serializeBoardItemExternalRef(ref: any): BoardItemExternalRef {
  return {
    id: ref.id,
    itemId: ref.itemId,
    accountId: ref.accountId,
    mappingId: ref.mappingId ?? null,
    provider: ref.provider,
    externalId: ref.externalId,
    externalKey: ref.externalKey ?? null,
    externalUrl: ref.externalUrl ?? null,
    externalUpdatedAt: ref.externalUpdatedAt ?? null,
    syncStatus: ref.syncStatus,
    lastSyncedAt: ref.lastSyncedAt ?? null,
    lastError: ref.lastError ?? null,
    raw: ref.raw ?? null,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
  };
}
