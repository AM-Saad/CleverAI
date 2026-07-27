import type { OfflineEntity } from "@@/shared/utils/offline-sync.contract";
import type { StoredOfflineMutation } from "./types";

const CHAINABLE_STATUSES = new Set([
  "pending",
  "syncing",
  "retry",
  "blocked",
  "waiting",
  "conflict",
]);

export function latestSequentialPredecessor(input: {
  mutations: StoredOfflineMutation[];
  entity: OfflineEntity;
  entityId: string;
}): StoredOfflineMutation | undefined {
  return input.mutations
    .filter(
      (candidate) =>
        candidate.sequence &&
        candidate.entity === input.entity &&
        candidate.entityId === input.entityId &&
        CHAINABLE_STATUSES.has(candidate.status),
    )
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )
    .at(-1);
}

export function predictedSequentialBaseVersion(input: {
  predecessor?: Pick<StoredOfflineMutation, "baseVersion">;
  inputBaseVersion?: number;
  currentVersion?: number;
}): number {
  if (!input.predecessor)
    return input.inputBaseVersion ?? input.currentVersion ?? 0;
  return (
    (input.predecessor.baseVersion ??
      input.inputBaseVersion ??
      input.currentVersion ??
      0) + 1
  );
}

export function migrateLegacySequentialChain(input: {
  mutations: StoredOfflineMutation[];
  serverVersion: number;
}): StoredOfflineMutation[] {
  const ordered = [...input.mutations].sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  );
  const chainIds = new Set(ordered.map((mutation) => mutation.id));
  let predecessorId: string | undefined;
  let baseVersion = input.serverVersion;
  return ordered.map((mutation) => {
    const dependencies = mutation.dependsOn.filter(
      (dependency) => !chainIds.has(dependency),
    );
    if (predecessorId) dependencies.push(predecessorId);
    const migrated: StoredOfflineMutation = {
      ...mutation,
      baseVersion,
      dependsOn: [...new Set(dependencies)],
      sequence: true,
      revisionScheme: "offline-entity-v1",
      updatedAt: Date.now(),
    };
    predecessorId = mutation.id;
    baseVersion += 1;
    return migrated;
  });
}
