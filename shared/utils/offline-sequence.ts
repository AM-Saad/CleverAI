import type {
  OfflineMutation,
  OfflineSyncResult,
} from "./offline-sync.contract";

export function rebaseFromAppliedDependency(
  mutation: OfflineMutation,
  dependencies: OfflineSyncResult[],
): OfflineMutation {
  const predecessor = [...dependencies]
    .reverse()
    .find(
      (result) =>
        result.status === "applied" &&
        (result.entity ?? mutation.entity) === mutation.entity &&
        (result.entityId ?? mutation.entityId) === mutation.entityId &&
        result.version !== undefined,
    );
  return predecessor
    ? { ...mutation, baseVersion: predecessor.version }
    : mutation;
}
