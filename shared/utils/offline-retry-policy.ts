import type {
  OfflineMutation,
  OfflineMutationStatus,
} from "./offline-sync.contract";

/**
 * Delivery attempts that reached the server before a mutation is parked for
 * explicit user action. Connectivity failures do not consume this budget.
 */
export const MAX_OFFLINE_SYNC_ATTEMPTS = 10;

/**
 * The generic Offline V2 drain does not own Notes rows, and legacy Daily
 * occurrence rows must wait for bootstrap to migrate their revision scheme.
 */
export function isOfflineV2DrainCandidate(
  mutation: Pick<OfflineMutation, "entity" | "revisionScheme">,
): boolean {
  return (
    mutation.entity !== "note" &&
    mutation.entity !== "noteGroup" &&
    (mutation.entity !== "actionOccurrence" ||
      mutation.revisionScheme === "offline-entity-v1")
  );
}

type RetryPolicyMutation = Pick<
  OfflineMutation,
  "id" | "attempts" | "dependsOn" | "status"
>;

export type OfflineRetryQueueAnalysis = {
  /** Pending/retry mutations that reached the delivery-attempt ceiling. */
  exhaustedIds: string[];
  /**
   * Pending/retry descendants that must wait behind an exhausted, conflicted,
   * rejected, or already-waiting dependency.
   */
  waitingIds: string[];
};

const SENDABLE_STATUSES = new Set<OfflineMutationStatus>(["pending", "retry"]);
const DEPENDENCY_BLOCKING_STATUSES = new Set<OfflineMutationStatus>([
  "conflict",
  "rejected",
  "waiting",
]);

/**
 * Return every transitive descendant of the supplied mutation IDs.
 *
 * This is intentionally status-agnostic: a pending grandchild still needs to
 * wait when the direct child has already been parked.
 */
export function collectTransitiveDependentIds(
  mutations: readonly Pick<OfflineMutation, "id" | "dependsOn">[],
  rootIds: Iterable<string>,
): Set<string> {
  const blocked = new Set(rootIds);
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const mutation of mutations) {
      if (blocked.has(mutation.id)) continue;
      if (!mutation.dependsOn.some((dependency) => blocked.has(dependency)))
        continue;
      blocked.add(mutation.id);
      descendants.add(mutation.id);
      changed = true;
    }
  }

  return descendants;
}

/**
 * Analyze an account-scoped queue before either the window or service worker
 * claims work. Keeping this pure makes both sync owners share one policy.
 */
export function analyzeOfflineRetryQueue(
  mutations: readonly RetryPolicyMutation[],
  maxAttempts = MAX_OFFLINE_SYNC_ATTEMPTS,
): OfflineRetryQueueAnalysis {
  const exhaustedIds = mutations
    .filter(
      (mutation) =>
        SENDABLE_STATUSES.has(mutation.status) &&
        mutation.attempts >= maxAttempts,
    )
    .map((mutation) => mutation.id);
  const exhausted = new Set(exhaustedIds);
  const blockingRoots = new Set([
    ...exhaustedIds,
    ...mutations
      .filter((mutation) => DEPENDENCY_BLOCKING_STATUSES.has(mutation.status))
      .map((mutation) => mutation.id),
  ]);
  const descendants = collectTransitiveDependentIds(mutations, blockingRoots);
  const waitingIds = mutations
    .filter(
      (mutation) =>
        !exhausted.has(mutation.id) &&
        descendants.has(mutation.id) &&
        SENDABLE_STATUSES.has(mutation.status),
    )
    .map((mutation) => mutation.id);

  return { exhaustedIds, waitingIds };
}
