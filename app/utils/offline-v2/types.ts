import type {
  OfflineConflict,
  OfflineEntity,
  OfflineMutation,
  OfflineMutationStatus,
  OfflinePack,
} from "@@/shared/utils/offline-sync.contract";

export type OfflineEntityRecord<T extends object = Record<string, unknown>> = {
  id: string;
  accountId: string;
  entity: OfflineEntity;
  entityId: string;
  workspaceId?: string;
  version: number;
  updatedAt: number;
  deleted?: boolean;
  /** Durable local draft not yet represented by an outbox mutation. */
  localDirty?: boolean;
  data: T;
};

export type StoredOfflineMutation = OfflineMutation & {
  accountId: string;
  workspaceId?: string;
  updatedAt: number;
  /** Monotonic local payload revision used to reject stale acknowledgements. */
  localRevision?: number;
  /** Cross-context lease. Only the owner may acknowledge or release this row. */
  claimToken?: string;
  claimedAt?: number;
};

export type StoredOfflineConflict = OfflineConflict & {
  id: string;
  accountId: string;
  mutationId: string;
  createdAt: number;
};

export type OfflineRuntimeState = {
  accountId: string;
  pending: number;
  retrying: number;
  blocked: number;
  rejected: number;
  conflicts: number;
  lastSyncAt?: number;
  isSyncing: boolean;
};

export type OfflineSyncMetadata = {
  id: string;
  accountId: string;
  lastAttemptAt?: number;
  lastSuccessfulSyncAt?: number;
  lastError?: string;
  updatedAt: number;
};

export type { OfflinePack, OfflineMutationStatus };
