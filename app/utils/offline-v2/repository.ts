import type {
  OfflineEntity,
  OfflineMutation,
  OfflineRelatedEntityResult,
} from "@@/shared/utils/offline-sync.contract";
// Relative imports keep this repository usable by both Nuxt and the raw
// esbuild service-worker bundle (which does not know Nuxt's `~` alias).
import { DB_CONFIG } from "../constants/pwa";
import { getAllRecords, openUnifiedDB, sanitizeForIDB } from "../idb";
import type {
  OfflineEntityRecord,
  StoredOfflineConflict,
  StoredOfflineMutation,
  OfflineSyncMetadata,
} from "./types";

type StoreName = (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES];

const stores = DB_CONFIG.STORES;
const now = () => Date.now();
const scopedId = (...parts: Array<string | undefined | null>) =>
  parts.filter(Boolean).join(":");

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () =>
      reject(operation.error ?? new Error("IndexedDB request failed"));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function containsValue(value: unknown, target: string): boolean {
  if (value === target) return true;
  if (Array.isArray(value))
    return value.some((item) => containsValue(item, target));
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>).some((item) =>
      containsValue(item, target),
    );
  return false;
}

export function comparableOfflineValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(comparableOfflineValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        comparableOfflineValue(item),
      ]),
    );
  return value;
}

function snapshotMatchesPayload(
  snapshot: Record<string, unknown>,
  payload: Record<string, unknown>,
) {
  return Object.entries(payload).every(
    ([field, value]) =>
      JSON.stringify(comparableOfflineValue(snapshot[field])) ===
      JSON.stringify(comparableOfflineValue(value)),
  );
}

/**
 * Remove a cancelled create and every still-pending mutation that depends on
 * it. Dependent updates are restored to their pre-command snapshot; only
 * dependent creates disappear. Deleting every projection here used to erase
 * canonical local data when an update happened to reference a cancelled temp
 * parent.
 */
function cancelDependentMutations(
  mutationStore: IDBObjectStore,
  entityStore: IDBObjectStore,
  mutations: StoredOfflineMutation[],
  accountId: string,
  rootMutationId: string,
) {
  const cancelled = new Set([rootMutationId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of mutations) {
      if (candidate.accountId !== accountId || cancelled.has(candidate.id))
        continue;
      if (candidate.dependsOn.some((dependency) => cancelled.has(dependency))) {
        cancelled.add(candidate.id);
        changed = true;
      }
    }
  }
  for (const candidate of mutations) {
    if (!cancelled.has(candidate.id)) continue;
    mutationStore.delete(candidate.id);
    const entityKey = scopedId(accountId, candidate.entity, candidate.entityId);
    if (candidate.rollbackData) {
      entityStore.put(
        sanitizeForIDB({
          id: entityKey,
          accountId,
          entity: candidate.entity,
          entityId: candidate.entityId,
          workspaceId: candidate.workspaceId,
          version: candidate.baseVersion ?? 0,
          updatedAt: now(),
          deleted: false,
          data: candidate.rollbackData,
        }),
      );
    } else {
      entityStore.delete(entityKey);
    }
  }
}

/**
 * Account isolation lives below every feature store.  Features never query the
 * global IDB database directly for new offline-v2 data; this prevents a second
 * account on the same device from observing stale records.
 */
export async function listOfflineEntities<T extends object>(
  accountId: string,
  entity?: OfflineEntity,
  workspaceId?: string,
): Promise<Array<OfflineEntityRecord<T>>> {
  const db = await openUnifiedDB();
  const all = await getAllRecords<OfflineEntityRecord<T>>(
    db,
    stores.OFFLINE_ENTITIES as StoreName,
  );
  return all.filter(
    (record) =>
      record.accountId === accountId &&
      (!entity || record.entity === entity) &&
      (!workspaceId || record.workspaceId === workspaceId) &&
      !record.deleted,
  );
}

export async function getOfflineEntity<T extends object>(
  accountId: string,
  entity: OfflineEntity,
  entityId: string,
): Promise<OfflineEntityRecord<T> | undefined> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_ENTITIES, "readonly");
  const result = await request(
    tx
      .objectStore(stores.OFFLINE_ENTITIES)
      .get(scopedId(accountId, entity, entityId)),
  );
  await complete(tx);
  return result as OfflineEntityRecord<T> | undefined;
}

export async function putOfflineEntities(
  records: Array<OfflineEntityRecord>,
): Promise<void> {
  if (!records.length) return;
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_ENTITIES, "readwrite");
  const store = tx.objectStore(stores.OFFLINE_ENTITIES);
  for (const record of records) store.put(sanitizeForIDB(record));
  await complete(tx);
}

/**
 * Reconcile a completed workspace-pack download as an authoritative snapshot.
 * Records with pending local work are retained; everything else absent from the
 * replacement pack is tombstoned so deleted server rows cannot resurrect while
 * offline after a refresh.
 */
export async function replaceOfflinePackEntities(input: {
  accountId: string;
  workspaceId?: string;
  records: OfflineEntityRecord[];
}): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readwrite",
  );
  const entities = tx.objectStore(stores.OFFLINE_ENTITIES);
  const mutations = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const [existing, pending] = await Promise.all([
    request(entities.getAll()) as Promise<OfflineEntityRecord[]>,
    request(mutations.getAll()) as Promise<StoredOfflineMutation[]>,
  ]);
  const incomingById = new Map(
    input.records.map((record) => [record.id, record]),
  );
  const protectedEntities = new Set(
    pending
      .filter(
        (mutation) =>
          mutation.accountId === input.accountId &&
          ["pending", "syncing", "retry", "blocked", "conflict"].includes(
            mutation.status,
          ),
      )
      .map((mutation) =>
        scopedId(input.accountId, mutation.entity, mutation.entityId),
      ),
  );
  for (const record of existing) {
    if (record.accountId === input.accountId && record.localDirty)
      protectedEntities.add(record.id);
  }
  for (const record of existing) {
    if (record.accountId !== input.accountId) continue;
    // An account pack is authoritative for every entity in that account; a
    // workspace pack is authoritative only for that workspace.  Treating an
    // account pack as global-only left deleted workspace rows resurrectable.
    const inPackScope = input.workspaceId
      ? record.workspaceId === input.workspaceId
      : true;
    if (
      !inPackScope ||
      incomingById.has(record.id) ||
      protectedEntities.has(record.id)
    )
      continue;
    entities.put(
      sanitizeForIDB({ ...record, deleted: true, updatedAt: now() }),
    );
  }
  for (const record of input.records) {
    if (protectedEntities.has(record.id)) continue;
    entities.put(sanitizeForIDB(record));
  }
  await complete(tx);
}

export async function putOfflinePack(
  record: Record<string, unknown>,
): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_PACKS, "readwrite");
  tx.objectStore(stores.OFFLINE_PACKS).put(sanitizeForIDB(record));
  await complete(tx);
}

export async function saveOfflineBlob(input: {
  accountId: string;
  workspaceId?: string;
  name: string;
  type: string;
  blob: Blob;
  url?: string;
}): Promise<string> {
  const id = `blob:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_BLOBS, "readwrite");
  tx.objectStore(stores.OFFLINE_BLOBS).put({
    id,
    accountId: input.accountId,
    workspaceId: input.workspaceId,
    name: input.name,
    type: input.type,
    url: input.url,
    size: input.blob.size,
    blob: input.blob,
    createdAt: now(),
    status: "draft",
  });
  await complete(tx);
  return id;
}

export async function listOfflinePacks(
  accountId: string,
): Promise<Array<Record<string, unknown>>> {
  const db = await openUnifiedDB();
  const all = await getAllRecords<Record<string, unknown>>(
    db,
    stores.OFFLINE_PACKS as StoreName,
  );
  return all.filter((pack) => pack.accountId === accountId);
}

/** Explicitly remove a downloaded pack while preserving unsynced local work. */
export async function removeOfflinePack(input: {
  accountId: string;
  workspaceId?: string;
}): Promise<string[]> {
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [
      stores.OFFLINE_PACKS,
      stores.OFFLINE_ENTITIES,
      stores.OFFLINE_MUTATIONS,
      stores.OFFLINE_BLOBS,
    ],
    "readwrite",
  );
  const packs = tx.objectStore(stores.OFFLINE_PACKS);
  const entities = tx.objectStore(stores.OFFLINE_ENTITIES);
  const mutations = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const blobs = tx.objectStore(stores.OFFLINE_BLOBS);
  const [allEntities, allMutations, allBlobs] = await Promise.all([
    request(entities.getAll()) as Promise<OfflineEntityRecord[]>,
    request(mutations.getAll()) as Promise<StoredOfflineMutation[]>,
    request(blobs.getAll()) as Promise<
      Array<{
        id: string;
        accountId?: string;
        workspaceId?: string;
        url?: string;
      }>
    >,
  ]);
  const protectedEntities = new Set(
    allMutations
      .filter(
        (mutation) =>
          mutation.accountId === input.accountId &&
          ["pending", "syncing", "retry", "blocked", "conflict"].includes(
            mutation.status,
          ),
      )
      .map((mutation) =>
        scopedId(input.accountId, mutation.entity, mutation.entityId),
      ),
  );
  for (const record of allEntities) {
    if (record.accountId === input.accountId && record.localDirty)
      protectedEntities.add(record.id);
  }
  for (const record of allEntities) {
    const inScope = input.workspaceId
      ? record.workspaceId === input.workspaceId
      : true;
    if (
      record.accountId === input.accountId &&
      inScope &&
      !protectedEntities.has(record.id)
    )
      entities.delete(record.id);
  }
  const urls: string[] = [];
  for (const blob of allBlobs) {
    const inScope = input.workspaceId
      ? blob.workspaceId === input.workspaceId
      : true;
    if (blob.accountId === input.accountId && inScope) {
      blobs.delete(blob.id);
      if (blob.url) urls.push(blob.url);
    }
  }
  packs.delete(`${input.accountId}:${input.workspaceId ?? "account"}`);
  await complete(tx);
  return urls;
}

export async function listOfflineMutations(
  accountId: string,
): Promise<StoredOfflineMutation[]> {
  const db = await openUnifiedDB();
  const all = await getAllRecords<StoredOfflineMutation>(
    db,
    stores.OFFLINE_MUTATIONS as StoreName,
  );
  return all
    .filter((mutation) => mutation.accountId === accountId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listOfflineConflicts(
  accountId: string,
): Promise<StoredOfflineConflict[]> {
  const db = await openUnifiedDB();
  const all = await getAllRecords<StoredOfflineConflict>(
    db,
    stores.OFFLINE_CONFLICTS as StoreName,
  );
  return all.filter((conflict) => conflict.accountId === accountId);
}

/** Applies the visible local write and queues its mutation atomically. */
export async function commitOfflineMutation(input: {
  accountId: string;
  mutation: OfflineMutation;
  localRecord?: Omit<OfflineEntityRecord, "id" | "accountId" | "updatedAt">;
}): Promise<StoredOfflineMutation> {
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readwrite",
  );
  const mutationStore = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const entityStore = tx.objectStore(stores.OFFLINE_ENTITIES);
  const mutation: StoredOfflineMutation = {
    ...input.mutation,
    accountId: input.accountId,
    updatedAt: now(),
    localRevision: (input.mutation as StoredOfflineMutation).localRevision ?? 1,
  };

  // Updates are coalesced by entity. Ordered events such as grades are never
  // coalesced, and a local create followed by delete disappears entirely.
  if (!mutation.sequence) {
    const all = (await request(
      mutationStore.getAll(),
    )) as StoredOfflineMutation[];
    const existing = all.find(
      (candidate) =>
        candidate.accountId === input.accountId &&
        candidate.entity === mutation.entity &&
        candidate.entityId === mutation.entityId &&
        ["pending", "retry"].includes(candidate.status) &&
        !candidate.sequence,
    );
    if (existing) {
      if (
        mutation.operation.endsWith(".delete") &&
        existing.operation.endsWith(".create")
      ) {
        cancelDependentMutations(
          mutationStore,
          entityStore,
          all,
          input.accountId,
          existing.id,
        );
      } else {
        const rollbackData = existing.operation.endsWith(".create")
          ? existing.rollbackData
          : (existing.rollbackData ?? mutation.rollbackData);
        mutation.id = existing.id;
        mutation.createdAt = existing.createdAt;
        mutation.localRevision = (existing.localRevision ?? 1) + 1;
        mutation.operation = mutation.operation.endsWith(".delete")
          ? mutation.operation
          : existing.operation.endsWith(".create")
            ? existing.operation
            : mutation.operation;
        mutation.payload = mutation.operation.endsWith(".delete")
          ? mutation.payload
          : { ...existing.payload, ...mutation.payload };
        mutation.changedFields = [
          ...new Set([...existing.changedFields, ...mutation.changedFields]),
        ];
        mutation.dependsOn = [
          ...new Set([...existing.dependsOn, ...mutation.dependsOn]),
        ];
        mutation.attempts = existing.attempts;
        mutation.rollbackData = rollbackData;
        mutationStore.put(sanitizeForIDB(mutation));
      }
    } else {
      mutationStore.put(sanitizeForIDB(mutation));
    }
  } else {
    mutationStore.put(sanitizeForIDB(mutation));
  }

  // Deleting a workspace explicitly discards still-local children. Keeping a
  // material/note mutation after its parent was intentionally removed only
  // turns a correct local decision into an opaque server rejection later.
  if (
    mutation.entity === "workspace" &&
    mutation.operation.endsWith(".delete")
  ) {
    const all = (await request(
      mutationStore.getAll(),
    )) as StoredOfflineMutation[];
    for (const candidate of all) {
      if (
        candidate.accountId !== input.accountId ||
        candidate.id === mutation.id ||
        candidate.workspaceId !== mutation.entityId
      )
        continue;
      mutationStore.delete(candidate.id);
      entityStore.delete(
        scopedId(input.accountId, candidate.entity, candidate.entityId),
      );
    }
  }

  if (input.localRecord) {
    const record: OfflineEntityRecord = {
      ...input.localRecord,
      id: scopedId(
        input.accountId,
        input.localRecord.entity,
        input.localRecord.entityId,
      ),
      accountId: input.accountId,
      updatedAt: now(),
      localDirty: false,
    };
    entityStore.put(sanitizeForIDB(record));
  } else if (mutation.operation.endsWith(".delete")) {
    const key = scopedId(input.accountId, mutation.entity, mutation.entityId);
    const existing = (await request(entityStore.get(key))) as
      | OfflineEntityRecord
      | undefined;
    if (existing)
      entityStore.put({ ...existing, deleted: true, updatedAt: now() });
  }
  await complete(tx);
  return mutation;
}

export async function setMutationStatus(
  accountId: string,
  ids: string[],
  status: StoredOfflineMutation["status"],
  lastError?: string,
  expectedClaimToken?: string,
): Promise<void> {
  if (!ids.length) return;
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_MUTATIONS, "readwrite");
  const store = tx.objectStore(stores.OFFLINE_MUTATIONS);
  for (const id of ids) {
    const existing = (await request(store.get(id))) as
      | StoredOfflineMutation
      | undefined;
    if (
      existing?.accountId === accountId &&
      (!expectedClaimToken || existing.claimToken === expectedClaimToken)
    ) {
      store.put(
        sanitizeForIDB({
          ...existing,
          status,
          lastError,
          updatedAt: now(),
          attempts:
            status === "retry" ? existing.attempts + 1 : existing.attempts,
          ...(status === "syncing"
            ? {}
            : { claimToken: undefined, claimedAt: undefined }),
        }),
      );
    }
  }
  await complete(tx);
}

/**
 * Atomically claims and returns the exact payload revision that may be sent.
 * A dependency outside this claim, or an in-flight write to the same entity,
 * keeps the candidate queued. This is the cross-tab/service-worker sync lock.
 */
export async function claimOfflineMutations(input: {
  accountId: string;
  ids: string[];
  claimToken: string;
  claimedAt?: number;
}): Promise<StoredOfflineMutation[]> {
  if (!input.ids.length) return [];
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_MUTATIONS, "readwrite");
  const store = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const all = (await request(store.getAll())) as StoredOfflineMutation[];
  const byId = new Map(all.map((mutation) => [mutation.id, mutation]));
  const requested = new Set(input.ids);
  const claimable = new Map<string, StoredOfflineMutation>();

  for (const id of input.ids) {
    const mutation = byId.get(id);
    if (
      !mutation ||
      mutation.accountId !== input.accountId ||
      !["pending", "retry"].includes(mutation.status)
    )
      continue;
    const predecessorInFlight = all.some(
      (candidate) =>
        candidate.accountId === input.accountId &&
        candidate.id !== mutation.id &&
        candidate.entity === mutation.entity &&
        candidate.entityId === mutation.entityId &&
        candidate.status === "syncing",
    );
    if (!predecessorInFlight) claimable.set(id, mutation);
  }

  // Removing an unready predecessor must also remove every child selected in
  // this transaction. Repeat until the claim set is stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, mutation] of claimable) {
      const hasUnresolvedDependency = mutation.dependsOn.some(
        (dependencyId) => {
          const dependency = byId.get(dependencyId);
          if (!dependency || dependency.accountId !== input.accountId)
            return false;
          return !requested.has(dependencyId) || !claimable.has(dependencyId);
        },
      );
      if (hasUnresolvedDependency) {
        claimable.delete(id);
        changed = true;
      }
    }
  }

  const claimedAt = input.claimedAt ?? now();
  const claimed: StoredOfflineMutation[] = [];
  for (const id of input.ids) {
    const mutation = claimable.get(id);
    if (!mutation) continue;
    const next: StoredOfflineMutation = {
      ...mutation,
      status: "syncing",
      claimToken: input.claimToken,
      claimedAt,
      localRevision: mutation.localRevision ?? 1,
      updatedAt: claimedAt,
    };
    store.put(sanitizeForIDB(next));
    claimed.push(next);
  }
  await complete(tx);
  return claimed;
}

/**
 * A browser can close after marking work `syncing` but before receiving a
 * result.  Receipts make a retry safe, so recover those records rather than
 * leaving them stranded forever after reload.
 */
export async function recoverInterruptedMutations(
  accountId: string,
): Promise<number> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_MUTATIONS, "readwrite");
  const store = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const mutations = (await request(store.getAll())) as StoredOfflineMutation[];
  const staleBefore = now() - 2 * 60 * 1000;
  let recovered = 0;
  for (const mutation of mutations) {
    if (mutation.accountId !== accountId || mutation.status !== "syncing")
      continue;
    // A newly opened tab must not steal a live service-worker or sibling-tab
    // request. Rows from older builds have no claimedAt and are safe to retry.
    if (mutation.claimedAt && mutation.claimedAt > staleBefore) continue;
    store.put(
      sanitizeForIDB({
        ...mutation,
        status: "retry",
        claimToken: undefined,
        claimedAt: undefined,
        lastError: "The previous sync was interrupted. Retrying safely.",
        updatedAt: now(),
        attempts: mutation.attempts + 1,
      }),
    );
    recovered += 1;
  }
  await complete(tx);
  return recovered;
}

export async function getOfflineSyncMetadata(
  accountId: string,
): Promise<OfflineSyncMetadata | undefined> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SYNC_META, "readonly");
  const record = await request(
    tx.objectStore(stores.OFFLINE_SYNC_META).get(accountId),
  );
  await complete(tx);
  return record as OfflineSyncMetadata | undefined;
}

export async function updateOfflineSyncMetadata(
  accountId: string,
  patch: Omit<Partial<OfflineSyncMetadata>, "id" | "accountId" | "updatedAt">,
): Promise<OfflineSyncMetadata> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SYNC_META, "readwrite");
  const store = tx.objectStore(stores.OFFLINE_SYNC_META);
  const current = (await request(store.get(accountId))) as
    | OfflineSyncMetadata
    | undefined;
  const next: OfflineSyncMetadata = {
    id: accountId,
    accountId,
    ...current,
    ...patch,
    updatedAt: now(),
  };
  store.put(sanitizeForIDB(next));
  await complete(tx);
  return next;
}

export type OfflineSyncProjectionResult = {
  entityId: string;
  hasPendingSuccessor: boolean;
  relatedPendingSuccessors: Record<string, boolean>;
};

export async function applySyncResult(input: {
  accountId: string;
  mutation: StoredOfflineMutation;
  result: {
    status: "applied" | "retry" | "rejected" | "conflict";
    entity?: OfflineEntity;
    entityId?: string;
    version?: number;
    canonical?: Record<string, unknown> | null;
    related?: OfflineRelatedEntityResult[];
    conflict?: Record<string, unknown>;
    message?: string;
  };
}): Promise<OfflineSyncProjectionResult> {
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [
      stores.OFFLINE_ENTITIES,
      stores.OFFLINE_MUTATIONS,
      stores.OFFLINE_CONFLICTS,
    ],
    "readwrite",
  );
  const mutations = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const entities = tx.objectStore(stores.OFFLINE_ENTITIES);
  const conflicts = tx.objectStore(stores.OFFLINE_CONFLICTS);
  const result = input.result;
  const projection: OfflineSyncProjectionResult = {
    entityId: result.entityId ?? input.mutation.entityId,
    hasPendingSuccessor: false,
    relatedPendingSuccessors: {},
  };
  const current = (await request(mutations.get(input.mutation.id))) as
    | StoredOfflineMutation
    | undefined;
  const hasLeaseIdentity = Boolean(
    input.mutation.claimToken || input.mutation.localRevision,
  );
  const ownsCurrentRevision =
    Boolean(current) &&
    (!hasLeaseIdentity ||
      (current!.claimToken === input.mutation.claimToken &&
        (current!.localRevision ?? 1) === (input.mutation.localRevision ?? 1)));
  if (result.status === "applied") {
    if (ownsCurrentRevision) mutations.delete(input.mutation.id);
    const allMutations = (await request(
      mutations.getAll(),
    )) as StoredOfflineMutation[];
    const allConflicts = (await request(
      conflicts.getAll(),
    )) as StoredOfflineConflict[];
    const canonicalEntityId =
      result.entityId ?? current?.entityId ?? input.mutation.entityId;
    const canonicalEntity = result.entity ?? input.mutation.entity;
    projection.entityId = canonicalEntityId;
    const successors = allMutations.filter(
      (candidate) =>
        candidate.accountId === input.accountId &&
        candidate.id !== input.mutation.id &&
        candidate.entity === input.mutation.entity &&
        candidate.entityId === canonicalEntityId &&
        ["pending", "retry", "blocked"].includes(candidate.status),
    );
    if (!ownsCurrentRevision && current) successors.push(current);
    const entityKey = scopedId(
      input.accountId,
      canonicalEntity,
      canonicalEntityId,
    );
    const localEntity = (await request(entities.get(entityKey))) as
      | OfflineEntityRecord
      | undefined;
    const hasNewerDraft = Boolean(
      localEntity?.localDirty &&
      !snapshotMatchesPayload(localEntity.data, input.mutation.payload),
    );
    projection.hasPendingSuccessor = successors.length > 0 || hasNewerDraft;
    if (result.version !== undefined) {
      for (const successor of successors) {
        if (successor.operation.endsWith(".create")) continue;
        mutations.put(
          sanitizeForIDB({
            ...successor,
            baseVersion: result.version,
            updatedAt: now(),
          }),
        );
      }
    }
    if (result.canonical) {
      const preserveNewerLocalState =
        Boolean(localEntity) && (successors.length > 0 || hasNewerDraft);
      entities.put(
        sanitizeForIDB({
          id: entityKey,
          accountId: input.accountId,
          entity: canonicalEntity,
          entityId: canonicalEntityId,
          workspaceId: preserveNewerLocalState
            ? localEntity!.workspaceId
            : ((result.canonical.workspaceId as string | undefined) ??
              input.mutation.workspaceId),
          version: result.version ?? 0,
          updatedAt: now(),
          localDirty: preserveNewerLocalState ? localEntity!.localDirty : false,
          deleted: preserveNewerLocalState
            ? localEntity!.deleted
            : input.mutation.operation.endsWith(".delete"),
          data: preserveNewerLocalState ? localEntity!.data : result.canonical,
        }),
      );
    }
    for (const related of result.related ?? []) {
      const relatedKey = scopedId(
        input.accountId,
        related.entity,
        related.entityId,
      );
      const relatedEntity = (await request(entities.get(relatedKey))) as
        | OfflineEntityRecord
        | undefined;
      const relatedSuccessors = allMutations.filter(
        (candidate) =>
          candidate.accountId === input.accountId &&
          candidate.entity === related.entity &&
          candidate.entityId === related.entityId &&
          ["pending", "retry", "blocked"].includes(candidate.status),
      );
      const hasRelatedDraft = Boolean(
        relatedEntity?.localDirty &&
        related.canonical &&
        !snapshotMatchesPayload(
          relatedEntity.data,
          Object.fromEntries(
            Object.entries(related.canonical).filter(
              ([field]) =>
                field in relatedEntity.data &&
                ![
                  "id",
                  "userId",
                  "createdAt",
                  "updatedAt",
                  "offlineRevision",
                ].includes(field),
            ),
          ),
        ),
      );
      projection.relatedPendingSuccessors[
        `${related.entity}:${related.entityId}`
      ] = relatedSuccessors.length > 0 || hasRelatedDraft;
      const relatedConflict = allConflicts.find(
        (conflict) =>
          conflict.accountId === input.accountId &&
          conflict.entity === related.entity &&
          conflict.entityId === related.entityId,
      );
      if (relatedConflict) {
        conflicts.put(
          sanitizeForIDB({
            ...relatedConflict,
            serverVersion: related.version,
            serverSnapshot: related.canonical ?? relatedConflict.serverSnapshot,
          }),
        );
      }
      for (const successor of relatedSuccessors) {
        if (successor.operation.endsWith(".create")) continue;
        mutations.put(
          sanitizeForIDB({
            ...successor,
            baseVersion: related.version,
            updatedAt: now(),
          }),
        );
      }
      if (related.canonical) {
        const preserveNewerLocalState =
          Boolean(relatedEntity) &&
          (relatedSuccessors.length > 0 || hasRelatedDraft);
        entities.put(
          sanitizeForIDB({
            id: relatedKey,
            accountId: input.accountId,
            entity: related.entity,
            entityId: related.entityId,
            workspaceId: preserveNewerLocalState
              ? relatedEntity!.workspaceId
              : (related.canonical.workspaceId as string | undefined),
            version: related.version,
            updatedAt: now(),
            localDirty: preserveNewerLocalState
              ? relatedEntity!.localDirty
              : false,
            deleted: preserveNewerLocalState
              ? relatedEntity!.deleted
              : related.canonical.deleted === true,
            data: preserveNewerLocalState
              ? relatedEntity!.data
              : related.canonical,
          }),
        );
      }
    }
  } else if (result.status === "conflict") {
    if (!ownsCurrentRevision) {
      await complete(tx);
      return projection;
    }
    mutations.put(
      sanitizeForIDB({
        ...current!,
        status: "conflict",
        claimToken: undefined,
        claimedAt: undefined,
        lastError: result.message,
        updatedAt: now(),
      }),
    );
    conflicts.put(
      sanitizeForIDB({
        id: scopedId(input.accountId, input.mutation.id),
        accountId: input.accountId,
        mutationId: input.mutation.id,
        entity: input.mutation.entity,
        entityId: input.mutation.entityId,
        serverVersion: Number(result.conflict?.serverVersion ?? 0),
        overlappingFields: Array.isArray(result.conflict?.overlappingFields)
          ? result.conflict?.overlappingFields
          : [],
        serverSnapshot:
          (result.conflict?.serverSnapshot as
            | Record<string, unknown>
            | undefined) ?? null,
        reason: String(
          result.conflict?.reason ??
            "The same fields changed on another device.",
        ),
        createdAt: now(),
      }),
    );
  } else if (result.status === "rejected") {
    if (!ownsCurrentRevision) {
      await complete(tx);
      return projection;
    }
    const rejected = current!;
    mutations.put(
      sanitizeForIDB({
        ...rejected,
        status: "rejected",
        claimToken: undefined,
        claimedAt: undefined,
        lastError: result.message,
        updatedAt: now(),
      }),
    );
    const entityKey = scopedId(
      input.accountId,
      rejected.entity,
      rejected.entityId,
    );
    if (rejected.rollbackData) {
      entities.put(
        sanitizeForIDB({
          id: entityKey,
          accountId: input.accountId,
          entity: rejected.entity,
          entityId: rejected.entityId,
          workspaceId: rejected.workspaceId,
          version: rejected.baseVersion ?? 0,
          updatedAt: now(),
          localDirty: false,
          deleted: false,
          data: rejected.rollbackData,
        }),
      );
    } else if (rejected.operation.endsWith(".create")) {
      entities.delete(entityKey);
    }
  } else {
    if (!ownsCurrentRevision) {
      await complete(tx);
      return projection;
    }
    mutations.put(
      sanitizeForIDB({
        ...current!,
        status: result.status,
        claimToken: undefined,
        claimedAt: undefined,
        attempts:
          result.status === "retry" ? current!.attempts + 1 : current!.attempts,
        lastError: result.message,
        updatedAt: now(),
      }),
    );
  }
  await complete(tx);
  return projection;
}

function remapValue(value: unknown, idMap: Record<string, string>): unknown {
  if (typeof value === "string") return idMap[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => remapValue(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        remapValue(item, idMap),
      ]),
    );
  }
  return value;
}

/** Replace temporary IDs in local snapshots and still-pending dependent writes. */
export async function remapOfflineIds(
  accountId: string,
  idMap: Record<string, string>,
  acknowledgement?: { serverVersion?: number; mutationId?: string },
): Promise<void> {
  if (!Object.keys(idMap).length) return;
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readwrite",
  );
  const entities = tx.objectStore(stores.OFFLINE_ENTITIES);
  const mutations = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const allEntities = (await request(
    entities.getAll(),
  )) as OfflineEntityRecord[];
  for (const record of allEntities) {
    if (record.accountId !== accountId) continue;
    const entityId = idMap[record.entityId] ?? record.entityId;
    const workspaceId = record.workspaceId
      ? (idMap[record.workspaceId] ?? record.workspaceId)
      : undefined;
    const next = {
      ...record,
      entityId,
      workspaceId,
      id: scopedId(accountId, record.entity, entityId),
      data: remapValue(record.data, idMap) as Record<string, unknown>,
    };
    if (next.id !== record.id) entities.delete(record.id);
    entities.put(sanitizeForIDB(next));
  }
  const allMutations = (await request(
    mutations.getAll(),
  )) as StoredOfflineMutation[];
  for (const record of allMutations) {
    if (record.accountId !== accountId) continue;
    const remappedEntityId = idMap[record.entityId];
    const convertQueuedCreate =
      Boolean(remappedEntityId) &&
      record.id !== acknowledgement?.mutationId &&
      record.operation.endsWith(".create");
    mutations.put(
      sanitizeForIDB({
        ...record,
        entityId: remappedEntityId ?? record.entityId,
        workspaceId: record.workspaceId
          ? (idMap[record.workspaceId] ?? record.workspaceId)
          : undefined,
        payload: remapValue(record.payload, idMap) as Record<string, unknown>,
        rollbackData: record.rollbackData
          ? (remapValue(record.rollbackData, idMap) as Record<string, unknown>)
          : record.rollbackData,
        ...(convertQueuedCreate && {
          operation: `${record.entity}.update`,
          baseVersion: acknowledgement?.serverVersion ?? 1,
        }),
      }),
    );
  }
  await complete(tx);
}

export async function clearOfflineAccount(accountId: string): Promise<void> {
  const db = await openUnifiedDB();
  const scopedStores: StoreName[] = [
    stores.OFFLINE_ENTITIES,
    stores.OFFLINE_MUTATIONS,
    stores.OFFLINE_CONFLICTS,
    stores.OFFLINE_PACKS,
    stores.OFFLINE_BLOBS,
    stores.OFFLINE_SYNC_META,
    stores.OFFLINE_LEGACY_RECOVERY,
  ] as StoreName[];
  // v1 stores never consistently carried account IDs. On logout/account swap,
  // clearing them is the only safe choice and intentionally discards their
  // legacy pending work after it has been surfaced in the Sync Center.
  const legacyStores: StoreName[] = [
    stores.FORMS,
    stores.NOTES,
    stores.NOTE_GROUPS,
    stores.PENDING_NOTES,
    stores.PENDING_NOTE_GROUP_CHANGES,
    stores.PENDING_NOTE_LAYOUTS,
    stores.NOTE_SYNC_CONFLICTS,
    stores.BOARD_ITEMS,
    stores.PENDING_BOARD_ITEMS,
    stores.BOARD_COLUMNS,
    stores.USER_TAGS,
  ] as StoreName[];
  const tx = db.transaction([...scopedStores, ...legacyStores], "readwrite");
  for (const storeName of scopedStores) {
    const store = tx.objectStore(storeName);
    const all = (await request(store.getAll())) as Array<{
      id: string;
      accountId?: string;
    }>;
    for (const item of all)
      if (item.accountId === accountId) store.delete(item.id);
  }
  for (const storeName of legacyStores) tx.objectStore(storeName).clear();
  await complete(tx);
}

export async function resolveOfflineConflict(input: {
  accountId: string;
  mutationId: string;
  strategy: "keep-local" | "keep-server";
}): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(
    [
      stores.OFFLINE_ENTITIES,
      stores.OFFLINE_MUTATIONS,
      stores.OFFLINE_CONFLICTS,
    ],
    "readwrite",
  );
  const entityStore = tx.objectStore(stores.OFFLINE_ENTITIES);
  const mutationStore = tx.objectStore(stores.OFFLINE_MUTATIONS);
  const conflictStore = tx.objectStore(stores.OFFLINE_CONFLICTS);
  const mutation = (await request(mutationStore.get(input.mutationId))) as
    | StoredOfflineMutation
    | undefined;
  const conflict = (await request(
    conflictStore.get(scopedId(input.accountId, input.mutationId)),
  )) as StoredOfflineConflict | undefined;
  if (mutation?.accountId === input.accountId) {
    if (input.strategy === "keep-server") {
      mutationStore.delete(mutation.id);
      const snapshot = conflict?.serverSnapshot;
      const key = scopedId(input.accountId, mutation.entity, mutation.entityId);
      if (snapshot) {
        entityStore.put(
          sanitizeForIDB({
            id: key,
            accountId: input.accountId,
            entity: mutation.entity,
            entityId: mutation.entityId,
            workspaceId:
              typeof snapshot.workspaceId === "string"
                ? snapshot.workspaceId
                : mutation.workspaceId,
            version: conflict?.serverVersion ?? 0,
            updatedAt: now(),
            localDirty: false,
            data: snapshot,
          }),
        );
      } else {
        const existing = (await request(entityStore.get(key))) as
          | OfflineEntityRecord
          | undefined;
        if (existing)
          entityStore.put({
            ...existing,
            deleted: true,
            localDirty: false,
            version: conflict?.serverVersion ?? existing.version,
            updatedAt: now(),
          });
      }
    } else {
      mutationStore.put({
        ...mutation,
        status: "pending",
        baseVersion: conflict?.serverVersion,
        lastError: undefined,
        updatedAt: now(),
      });
      const key = scopedId(input.accountId, mutation.entity, mutation.entityId);
      const existing = (await request(entityStore.get(key))) as
        | OfflineEntityRecord
        | undefined;
      if (existing)
        entityStore.put({ ...existing, localDirty: false, updatedAt: now() });
    }
  }
  conflictStore.delete(scopedId(input.accountId, input.mutationId));
  await complete(tx);
}

export async function saveOfflineSession(
  accountId: string,
  user: Record<string, unknown>,
): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SESSIONS, "readwrite");
  tx.objectStore(stores.OFFLINE_SESSIONS).put({
    id: accountId,
    accountId,
    user: sanitizeForIDB(user),
    verifiedAt: now(),
  });
  await complete(tx);
}

export async function getOfflineSession(): Promise<
  | { accountId: string; user: Record<string, unknown>; verifiedAt: number }
  | undefined
> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SESSIONS, "readonly");
  const sessions = (await request(
    tx.objectStore(stores.OFFLINE_SESSIONS).getAll(),
  )) as Array<{
    accountId: string;
    user: Record<string, unknown>;
    verifiedAt: number;
  }>;
  await complete(tx);
  return sessions.sort((a, b) => b.verifiedAt - a.verifiedAt)[0];
}

export async function clearOfflineSessions(): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SESSIONS, "readwrite");
  tx.objectStore(stores.OFFLINE_SESSIONS).clear();
  await complete(tx);
}

export async function clearOfflineSession(accountId: string): Promise<void> {
  const db = await openUnifiedDB();
  const tx = db.transaction(stores.OFFLINE_SESSIONS, "readwrite");
  tx.objectStore(stores.OFFLINE_SESSIONS).delete(accountId);
  await complete(tx);
}
