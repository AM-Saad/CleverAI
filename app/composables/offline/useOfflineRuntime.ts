import type {
  OfflineEntity,
  OfflineMutation,
  OfflineSyncResponse,
} from "../../../shared/utils/offline-sync.contract";
import {
  applySyncResult,
  clearOfflineAccount,
  clearOfflineSession,
  clearOfflineSessions,
  claimOfflineMutations,
  commitOfflineMutation,
  getOfflineEntity,
  listOfflineEntities,
  getOfflineSession,
  listOfflineConflicts,
  listOfflineMutations,
  getOfflineSyncMetadata,
  removeOfflinePack,
  putOfflinePack,
  replaceOfflinePackEntities,
  remapOfflineIds,
  resolveOfflineConflict,
  saveOfflineSession,
  saveOfflineBlob,
  recoverInterruptedMutations,
  setMutationStatus,
  updateOfflineSyncMetadata,
} from "../../utils/offline-v2/repository";
import type {
  OfflineEntityRecord,
  StoredOfflineMutation,
} from "../../utils/offline-v2/types";
import { DB_CONFIG, SYNC_TAGS } from "../../utils/constants/pwa";
import {
  reconcileNotesWorkspaceProjection,
  openUnifiedDB,
  putAllRecords,
} from "../../utils/idb";
import { getServiceWorkerReadyRegistration } from "../../utils/serviceWorkerRuntime";
import { orderOfflineMutations } from "../../../shared/utils/offline-mutation-order";

const clientIdKey = "cognilo-offline-client-id";
const states = new Map<string, ReturnType<typeof createRuntimeState>>();
let runtimeLifecycleInstalled = false;
const syncRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isOwnedOfflineV2Entity(entity: OfflineEntity) {
  return entity !== "note" && entity !== "noteGroup";
}

async function clearRuntimeCaches() {
  if (!import.meta.client || !("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

function createRuntimeState() {
  return {
    pending: ref(0),
    retrying: ref(0),
    blocked: ref(0),
    rejected: ref(0),
    conflicts: ref(0),
    lastSyncAt: ref<number | undefined>(),
    isSyncing: ref(false),
    initialized: ref(false),
  };
}

function localId() {
  if (!import.meta.client) return "server";
  const existing = localStorage.getItem(clientIdKey);
  if (existing) return existing;
  const created =
    globalThis.crypto?.randomUUID?.() ??
    `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(clientIdKey, created);
  return created;
}

function mutationId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local:${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function registerOfflineV2BackgroundSync() {
  if (!import.meta.client) return;
  try {
    const registration = await getServiceWorkerReadyRegistration(1500);
    if (registration && "sync" in registration) {
      // @ts-expect-error SyncManager is absent from some DOM type libraries.
      await registration.sync.register(SYNC_TAGS.OFFLINE_V2);
    }
  } catch {
    // Online/visibility/app-start sync remains the required fallback.
  }
}

function packRecords(
  accountId: string,
  workspaceId: string | undefined,
  data: Record<string, unknown>,
): OfflineEntityRecord[] {
  const mapping: Array<[string, OfflineEntity]> = [
    ["workspaces", "workspace"],
    ["notes", "note"],
    ["noteGroups", "noteGroup"],
    ["materials", "material"],
    ["boardColumns", "boardColumn"],
    ["boardItems", "boardItem"],
    ["boardComments", "boardComment"],
    ["boardLinks", "boardLink"],
    ["userTags", "userTag"],
    ["cardReviews", "review"],
    ["languageWords", "languageWord"],
    ["languageReviews", "languageReview"],
    ["flashcards", "studyContent"],
    ["questions", "studyContent"],
  ];
  const records: OfflineEntityRecord[] = [];
  for (const [key, entity] of mapping) {
    const values = data[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (
        !value ||
        typeof value !== "object" ||
        typeof (value as { id?: unknown }).id !== "string"
      )
        continue;
      const item = value as Record<string, unknown>;
      const entityId = item.id as string;
      records.push({
        id: `${accountId}:${entity}:${entityId}`,
        accountId,
        entity,
        entityId,
        // Global Board entities have an explicit null workspace; do not bind
        // them to the most recently downloaded workspace pack.
        workspaceId:
          typeof item.workspaceId === "string"
            ? item.workspaceId
            : item.workspaceId === null &&
                (entity === "boardItem" || entity === "boardColumn")
              ? undefined
              : workspaceId,
        version: Number(item.offlineRevision ?? item.version ?? 0),
        updatedAt: Date.now(),
        data: item,
      });
    }
  }
  for (const [key, entity] of [
    ["languagePreferences", "languagePreference"],
    ["notificationPreferences", "notificationPreference"],
  ] as Array<[string, OfflineEntity]>) {
    const item = data[key];
    if (!item || typeof item !== "object") continue;
    const id = String((item as Record<string, unknown>).id ?? entity);
    records.push({
      id: `${accountId}:${entity}:${id}`,
      accountId,
      entity,
      entityId: id,
      version: Number((item as Record<string, unknown>).offlineRevision ?? 0),
      updatedAt: Date.now(),
      data: item as Record<string, unknown>,
    });
  }
  return records;
}

async function hydrateFeatureOwnedCaches(
  data: Record<string, unknown>,
) {
  const db = await openUnifiedDB();
  const copy = async (
    key: string,
    store: (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
  ) => {
    const records = data[key];
    if (Array.isArray(records) && records.length)
      await putAllRecords(db, store as any, records);
  };
  const notesByWorkspace = new Map<string, any[]>();
  const notes = Array.isArray(data.notes) ? data.notes : [];
  for (const note of notes) {
    if (!note || typeof note !== "object") continue;
    const workspaceId = (note as Record<string, unknown>).workspaceId;
    if (typeof workspaceId !== "string") continue;
    const list = notesByWorkspace.get(workspaceId) ?? [];
    list.push(note);
    notesByWorkspace.set(workspaceId, list);
  }
  await Promise.all([
    ...Array.from(notesByWorkspace, ([workspaceId, workspaceNotes]) =>
      // Notes own their V1 outbox. Offline-pack hydration must therefore use
      // the same pending-aware replacement as an ordinary Notes refresh; a
      // blind put can resurrect deletes or overwrite a local create.
      reconcileNotesWorkspaceProjection(workspaceId, workspaceNotes),
    ),
    copy("noteGroups", DB_CONFIG.STORES.NOTE_GROUPS),
    copy("userTags", DB_CONFIG.STORES.USER_TAGS),
  ]);
}

async function downloadPackFiles(
  accountId: string,
  workspaceId: string | undefined,
  data: Record<string, unknown>,
) {
  if (!import.meta.client) return [] as string[];
  const urls = new Set<string>();
  const inaccessibleUrls = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (typeof item.url === "string") {
      try {
        const url = new URL(item.url, window.location.origin);
        if (url.origin === window.location.origin) urls.add(url.toString());
        else inaccessibleUrls.add(item.url);
      } catch {
        inaccessibleUrls.add(item.url);
      }
    }
    if (Array.isArray(item.attachments)) visit(item.attachments);
    if (item.metadata && typeof item.metadata === "object")
      visit(item.metadata);
  };
  visit(data.materials);
  visit(data.boardItems);
  const failures: string[] = Array.from(
    inaccessibleUrls,
    (url) => `${url}: unavailable offline (external file)`,
  );
  const estimate = await navigator.storage?.estimate?.();
  const ceiling = estimate?.quota
    ? estimate.quota * 0.5
    : Number.POSITIVE_INFINITY;
  let projected = estimate?.usage ?? 0;
  for (const url of urls) {
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`${response.status}`);
      const cacheCopy = response.clone();
      const blob = await response.blob();
      if (projected + blob.size > ceiling) {
        const continueDownload = window.confirm(
          `This file would take the offline pack above 50% of available browser storage. Download it anyway?`,
        );
        if (!continueDownload) {
          failures.push(`${url}: skipped to stay within the storage limit`);
          continue;
        }
      }
      await saveOfflineBlob({
        accountId,
        workspaceId,
        name: url.split("/").pop() || "attachment",
        type: blob.type,
        blob,
        url,
      });
      // Explicit packed files may be served by the service worker at their
      // original URL. API responses are never added to this cache.
      const cache = await caches.open("offline-files");
      await cache.put(url, cacheCopy);
      projected += blob.size;
    } catch {
      failures.push(`${url}: unavailable offline`);
    }
  }
  return failures;
}

export function useOfflineRuntime() {
  const { data: authData, status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const runtimeConfig = useRuntimeConfig();
  const enabled = computed(() => runtimeConfig.public.offlineV2 !== false);
  const accountId = computed(() =>
    String((authData.value?.user as { id?: string } | undefined)?.id ?? ""),
  );
  const activeState = computed(() => {
    const id = accountId.value || "anonymous";
    if (!states.has(id)) states.set(id, createRuntimeState());
    return states.get(id)!;
  });

  const refreshStatus = async () => {
    if (!accountId.value) return;
    const [mutations, conflicts] = await Promise.all([
      listOfflineMutations(accountId.value),
      listOfflineConflicts(accountId.value),
    ]);
    const ownedMutations = mutations.filter((mutation) =>
      isOwnedOfflineV2Entity(mutation.entity),
    );
    const ownedConflicts = conflicts.filter((conflict) =>
      isOwnedOfflineV2Entity(conflict.entity),
    );
    const state = activeState.value;
    state.pending.value = ownedMutations.filter(
      (mutation) =>
        mutation.status === "pending" || mutation.status === "syncing",
    ).length;
    state.retrying.value = ownedMutations.filter(
      (mutation) => mutation.status === "retry",
    ).length;
    state.blocked.value = ownedMutations.filter(
      (mutation) => mutation.status === "blocked",
    ).length;
    state.rejected.value = ownedMutations.filter(
      (mutation) => mutation.status === "rejected",
    ).length;
    state.conflicts.value = ownedConflicts.length;
  };

  const initialize = async () => {
    if (!import.meta.client || !enabled.value) return;
    const state = activeState.value;
    if (status.value === "authenticated" && accountId.value) {
      // A browser-reported offline session is never enough to establish a new
      // offline identity. It must have been observed during a live session.
      if (isOnline.value) {
        await saveOfflineSession(
          accountId.value,
          (authData.value?.user ?? {}) as Record<string, unknown>,
        );
        const blocked = (await listOfflineMutations(accountId.value)).filter(
          (mutation) =>
            isOwnedOfflineV2Entity(mutation.entity) &&
            mutation.status === "blocked",
        );
        if (blocked.length)
          await setMutationStatus(
            accountId.value,
            blocked.map((mutation) => mutation.id),
            "pending",
          );
      }
      if (!state.initialized.value) {
        await recoverInterruptedMutations(accountId.value);
      }
      const metadata = await getOfflineSyncMetadata(accountId.value);
      state.lastSyncAt.value = metadata?.lastSuccessfulSyncAt;
      await refreshStatus();
      state.initialized.value = true;
      if (isOnline.value) void sync();
    }
  };

  const queue = async (input: {
    entity: OfflineEntity;
    operation: string;
    entityId?: string;
    workspaceId?: string;
    baseVersion?: number;
    changedFields: string[];
    payload: Record<string, unknown>;
    dependsOn?: string[];
    sequence?: boolean;
    localData?: Record<string, unknown>;
    rollbackData?: Record<string, unknown> | null;
    /** Queue several related commands before starting one network drain. */
    deferSync?: boolean;
  }) => {
    if (!enabled.value)
      throw new Error(
        "Offline saving is temporarily unavailable on this build.",
      );
    if (!isOwnedOfflineV2Entity(input.entity)) {
      throw new Error(
        "Notes use the feature-owned Notes outbox, not Offline V2.",
      );
    }
    if (!accountId.value)
      throw new Error("Sign in once before saving content offline.");
    let entityId = input.entityId ?? `local:${mutationId()}`;
    // Preferences are one-per-account but their server IDs are generated. The
    // UI uses stable aliases, so resolve those aliases to the cached entity ID
    // before assigning a revision or emitting a mutation.
    if (
      (input.entity === "languagePreference" ||
        input.entity === "notificationPreference") &&
      !/^(temp-|local:)/.test(entityId)
    ) {
      const singleton = (
        await listOfflineEntities<Record<string, unknown>>(
          accountId.value,
          input.entity,
        )
      )[0];
      if (singleton) entityId = singleton.entityId;
    }
    const isCreate = input.operation.endsWith(".create");
    const [current, existingMutations] = await Promise.all([
      getOfflineEntity<Record<string, unknown>>(
        accountId.value,
        input.entity,
        entityId,
      ),
      listOfflineMutations(accountId.value),
    ]);
    const dependencyIds = existingMutations
      .filter((candidate) =>
        ["pending", "retry", "blocked"].includes(candidate.status),
      )
      .filter((candidate) => /^(temp-|local:)/.test(candidate.entityId))
      .filter((candidate) => {
        const referencesParent = (value: unknown): boolean => {
          if (value === candidate.entityId) return true;
          if (Array.isArray(value)) return value.some(referencesParent);
          if (value && typeof value === "object")
            return Object.values(value as Record<string, unknown>).some(
              referencesParent,
            );
          return false;
        };
        return (
          referencesParent(input.payload) ||
          input.workspaceId === candidate.entityId
        );
      })
      .map((candidate) => candidate.id);
    // Audit events must remain in their original order.  Their local snapshot
    // already contains the provisional result of earlier events, so advance
    // the base revision and add a receipt dependency for each predecessor.
    // Without this, two offline grades for the same card would make the second
    // grade look like a remote same-field collision after the first is applied.
    const sequentialPredecessors = input.sequence
      ? existingMutations
          .filter(
            (candidate) =>
              candidate.entity === input.entity &&
              candidate.entityId === entityId,
          )
          .filter(
            (candidate) =>
              candidate.sequence &&
              ["pending", "retry", "blocked"].includes(candidate.status),
          )
          .sort((left, right) => left.createdAt - right.createdAt)
      : [];
    const localData =
      input.localData ??
      (!input.operation.endsWith(".delete")
        ? { ...(current?.data ?? {}), ...input.payload }
        : undefined);
    const mutation: OfflineMutation = {
      id: mutationId(),
      entity: input.entity,
      operation: input.operation,
      entityId,
      workspaceId: input.workspaceId ?? current?.workspaceId,
      // Updates/deletes always carry the revision that was read from the local
      // snapshot. A missing snapshot means the initial server revision is 0.
      baseVersion: isCreate
        ? undefined
        : (input.baseVersion ?? current?.version ?? 0) +
          sequentialPredecessors.length,
      changedFields: input.changedFields,
      payload: input.payload,
      rollbackData: isCreate
        ? undefined
        : (input.rollbackData ?? current?.data ?? undefined),
      dependsOn: [
        ...new Set([
          ...(input.dependsOn ?? []),
          ...dependencyIds,
          ...sequentialPredecessors.map((mutation) => mutation.id),
        ]),
      ],
      occurredAt: new Date().toISOString(),
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
      sequence: Boolean(input.sequence),
    };
    await commitOfflineMutation({
      accountId: accountId.value,
      mutation,
      localRecord: localData
        ? {
            entity: input.entity,
            entityId,
            workspaceId: input.workspaceId ?? current?.workspaceId,
            version: current?.version ?? input.baseVersion ?? 0,
            data: { ...localData, id: entityId },
          }
        : undefined,
    });
    if (import.meta.client) {
      window.dispatchEvent(
        new CustomEvent("offline-v2-mutation-queued", {
          detail: {
            entity: input.entity,
            entityId,
            workspaceId: input.workspaceId ?? current?.workspaceId,
          },
        }),
      );
    }
    await refreshStatus();
    void registerOfflineV2BackgroundSync();
    if (isOnline.value && !input.deferSync) void sync();
    return { mutation, entityId };
  };

  const sync = async (): Promise<boolean> => {
    if (!enabled.value || !accountId.value || !isOnline.value) return false;
    const syncAccountId = accountId.value;
    const scheduleRetry = () => {
      if (syncRetryTimers.has(syncAccountId)) return;
      syncRetryTimers.set(
        syncAccountId,
        setTimeout(() => {
          syncRetryTimers.delete(syncAccountId);
          void sync();
        }, 500),
      );
    };
    if (activeState.value.isSyncing.value) {
      scheduleRetry();
      return false;
    }
    const state = activeState.value;
    const queued = (await listOfflineMutations(accountId.value))
      // Notes and note groups are owned by the feature-specific V1 outbox.
      // Keeping them out of the generic drain prevents a second sync owner.
      .filter((mutation) => isOwnedOfflineV2Entity(mutation.entity))
      .filter(
        (mutation) =>
          mutation.status === "pending" || mutation.status === "retry",
      );
    const { ordered, cyclic } = orderOfflineMutations(queued);
    if (cyclic.length)
      await setMutationStatus(
        accountId.value,
        cyclic.map((mutation) => mutation.id),
        "rejected",
        "Cyclic offline dependency",
      );
    const pending = ordered;
    if (!pending.length) return cyclic.length === 0;
    state.isSyncing.value = true;
    let reachedSyncService = false;
    let failureMessage: string | undefined;
    let fullyApplied = cyclic.length === 0;
    try {
      for (let offset = 0; offset < pending.length; offset += 50) {
        const candidates = pending.slice(offset, offset + 50);
        const claimToken = `${localId()}:${mutationId()}`;
        const batch = await claimOfflineMutations({
          accountId: accountId.value,
          ids: candidates.map((mutation) => mutation.id),
          claimToken,
        });
        if (!batch.length) {
          fullyApplied = false;
          scheduleRetry();
          continue;
        }
        try {
          const response = await $fetch<{
            success?: boolean;
            data?: OfflineSyncResponse;
          }>("/api/offline/sync", {
            method: "POST",
            body: { clientId: localId(), mutations: batch },
          });
          if (!response?.data)
            throw new Error("Offline sync returned no result");
          reachedSyncService = true;
          const byId = new Map(
            batch.map((mutation) => [mutation.id, mutation]),
          );
          const returned = new Set<string>();
          for (const result of response.data.results) {
            const mutation = byId.get(result.id);
            if (!mutation) continue;
            returned.add(result.id);
            if (result.idMap) {
              await remapOfflineIds(accountId.value, result.idMap, {
                serverVersion: result.version,
                mutationId: mutation.id,
              });
            }
            const projectionResult = await applySyncResult({
              accountId: accountId.value,
              mutation,
              result,
            });
            const entity = result.entity ?? mutation.entity;
            const canonicalEntityId =
              result.entityId ??
              result.idMap?.[mutation.entityId] ??
              mutation.entityId;
            const hasPendingSuccessor = projectionResult.hasPendingSuccessor;
            if (result.idMap) {
              if (entity === "boardItem") {
                window.dispatchEvent(
                  new CustomEvent("offline-v2-board-item-id-remapped", {
                    detail: {
                      idMap: result.idMap,
                      syncedPayload: mutation.payload,
                      version: result.version,
                      forceDirty: hasPendingSuccessor,
                    },
                  }),
                );
              } else if (entity === "boardColumn") {
                window.dispatchEvent(
                  new CustomEvent("offline-v2-board-column-id-remapped", {
                    detail: {
                      idMap: result.idMap,
                      syncedPayload: mutation.payload,
                      version: result.version,
                      forceDirty: hasPendingSuccessor,
                    },
                  }),
                );
              }
              window.dispatchEvent(
                new CustomEvent("offline-v2-entity-id-remapped", {
                  detail: {
                    entity,
                    idMap: result.idMap,
                    version: result.version,
                    canonical: result.canonical,
                  },
                }),
              );
            }
            if (entity === "boardItem" && result.status === "applied" && !result.idMap) {
              window.dispatchEvent(
                new CustomEvent("offline-v2-board-item-applied", {
                  detail: {
                    itemId: canonicalEntityId,
                    operation: mutation.operation,
                    syncedPayload: mutation.payload,
                    canonical: result.canonical,
                    version: result.version,
                    forceDirty: hasPendingSuccessor,
                  },
                }),
              );
            }
            if (entity === "boardColumn" && result.status === "applied" && !result.idMap) {
              window.dispatchEvent(
                new CustomEvent("offline-v2-board-column-applied", {
                  detail: {
                    columnId: canonicalEntityId,
                    operation: mutation.operation,
                    syncedPayload: mutation.payload,
                    canonical: result.canonical,
                    version: result.version,
                    forceDirty: hasPendingSuccessor,
                  },
                }),
              );
            }
            if (result.status === "applied") {
              for (const related of result.related ?? []) {
                if (related.entity !== "boardItem" || !related.canonical) continue;
                const relatedHasSuccessor = Boolean(
                  projectionResult.relatedPendingSuccessors[
                    `${related.entity}:${related.entityId}`
                  ],
                );
                window.dispatchEvent(
                  new CustomEvent("offline-v2-board-item-applied", {
                    detail: {
                      itemId: related.entityId,
                      syncedPayload: related.canonical,
                      canonical: related.canonical,
                      version: related.version,
                      forceDirty: relatedHasSuccessor,
                    },
                  }),
                );
              }
            }
            window.dispatchEvent(
              new CustomEvent("offline-v2-sync-result", {
                detail: {
                  entity,
                  entityId: canonicalEntityId,
                  status: result.status,
                  message: result.message,
                  operation: mutation.operation,
                  rollbackData: mutation.rollbackData,
                  syncedPayload: mutation.payload,
                  canonical: result.canonical,
                  version: result.version,
                  related: result.related,
                },
              }),
            );
            if (result.status !== "applied") fullyApplied = false;
          }
          const missing = batch.filter(
            (mutation) => !returned.has(mutation.id),
          );
          if (missing.length) {
            fullyApplied = false;
            await setMutationStatus(
              accountId.value,
              missing.map((mutation) => mutation.id),
              "retry",
              "The sync service did not acknowledge this mutation.",
              claimToken,
            );
          }
        } catch (error: any) {
          const statusCode = Number(
            error?.response?.status ?? error?.statusCode ?? 0,
          );
          const isAuthFailure = statusCode === 401 || statusCode === 403;
          await setMutationStatus(
            accountId.value,
            batch.map((mutation) => mutation.id),
            isAuthFailure ? "blocked" : "retry",
            isAuthFailure
              ? "Sign in to sync your saved local changes."
              : error instanceof Error
                ? error.message
                : "Unable to reach the sync service",
            claimToken,
          );
          failureMessage = isAuthFailure
            ? "Sign in to sync your saved local changes."
            : error instanceof Error
              ? error.message
              : "Unable to reach the sync service";
          fullyApplied = false;
          break;
        }
      }
      const timestamp = Date.now();
      const metadata = await updateOfflineSyncMetadata(accountId.value, {
        lastAttemptAt: timestamp,
        ...(reachedSyncService
          ? { lastSuccessfulSyncAt: timestamp, lastError: undefined }
          : { lastError: failureMessage }),
      });
      state.lastSyncAt.value = metadata.lastSuccessfulSyncAt;
      return fullyApplied;
    } finally {
      state.isSyncing.value = false;
      await refreshStatus();
    }
  };

  const downloadWorkspace = async (workspaceId?: string) => {
    if (!accountId.value || !isOnline.value)
      throw new Error("Connect to download a workspace for offline use.");
    const packId = `${accountId.value}:${workspaceId ?? "account"}`;
    await putOfflinePack({
      id: packId,
      accountId: accountId.value,
      workspaceId: workspaceId ?? null,
      revision: "",
      downloadedAt: Date.now(),
      updatedAt: Date.now(),
      status: "downloading",
      bytes: 0,
      failures: [],
    });
    try {
      const query = workspaceId
        ? `?workspaceId=${encodeURIComponent(workspaceId)}`
        : "";
      const response = await $fetch<{
        success?: boolean;
        data?: { revision: string; data: Record<string, unknown> };
      }>(`/api/offline/pack${query}`);
      if (!response?.data) throw new Error("Offline pack was not available");
      const records = packRecords(
        accountId.value,
        workspaceId,
        response.data.data,
      );
      await replaceOfflinePackEntities({
        accountId: accountId.value,
        workspaceId,
        records,
      });
      // Notes and tags still own feature stores. Board hydrates directly from
      // the generic records written by replaceOfflinePackEntities above.
      await hydrateFeatureOwnedCaches(response.data.data);
      const failures = await downloadPackFiles(
        accountId.value,
        workspaceId,
        response.data.data,
      );
      const bytes = new Blob([JSON.stringify(response.data.data)]).size;
      await putOfflinePack({
        id: packId,
        accountId: accountId.value,
        workspaceId: workspaceId ?? null,
        revision: response.data.revision,
        downloadedAt: Date.now(),
        updatedAt: Date.now(),
        status: "ready",
        bytes,
        failures,
      });
      return records.length;
    } catch (error) {
      await putOfflinePack({
        id: packId,
        accountId: accountId.value,
        workspaceId: workspaceId ?? null,
        revision: "",
        downloadedAt: Date.now(),
        updatedAt: Date.now(),
        status: "failed",
        bytes: 0,
        failures: [error instanceof Error ? error.message : "Download failed"],
      });
      throw error;
    }
  };

  const clearCurrentAccount = async () => {
    if (accountId.value) await clearOfflineAccount(accountId.value);
    await clearOfflineSessions();
    if (import.meta.client) {
      const indexedDbWithList = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
      };
      if (typeof indexedDbWithList.databases === "function") {
        // y-indexeddb uses dedicated databases outside our unified DB. Clear all
        // collaboration persistence on logout so local CRDT state cannot survive
        // an account boundary.
        const databases = await indexedDbWithList.databases();
        await Promise.all(
          databases
            .map((database) => database.name)
            .filter((name): name is string =>
              Boolean(
                name && (name.startsWith("yjs-") || name.startsWith("notes:")),
              ),
            )
            .map(
              (name) =>
                new Promise<void>((resolve) => {
                  const request = indexedDB.deleteDatabase(name);
                  request.onsuccess = () => resolve();
                  request.onerror = () => resolve();
                  request.onblocked = () => resolve();
                }),
            ),
        );
      }
    }
    // Page responses and runtime assets can contain an authenticated SSR shell,
    // so logout clears Cache Storage as well as IndexedDB.
    await clearRuntimeCaches();
  };

  const removeDownloadedWorkspace = async (workspaceId?: string) => {
    if (!accountId.value) return;
    const urls = await removeOfflinePack({
      accountId: accountId.value,
      workspaceId,
    });
    if (import.meta.client && "caches" in window) {
      const cache = await caches.open("offline-files");
      await Promise.all(urls.map((url) => cache.delete(url)));
    }
    await refreshStatus();
  };

  const offlineSession = async () => getOfflineSession();
  const conflictsList = async () =>
    accountId.value ? listOfflineConflicts(accountId.value) : [];
  const mutationsList = async () =>
    accountId.value ? listOfflineMutations(accountId.value) : [];
  const retryMutation = async (id: string) => {
    if (!accountId.value) return;
    await setMutationStatus(accountId.value, [id], "pending");
    await refreshStatus();
    if (isOnline.value) await sync();
  };
  const exportRecovery = async () => {
    if (!accountId.value || !import.meta.client) return;
    const [mutations, conflicts] = await Promise.all([
      listOfflineMutations(accountId.value),
      listOfflineConflicts(accountId.value),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            accountId: accountId.value,
            mutations,
            conflicts,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "offline-recovery.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const resolveConflict = async (
    mutationId: string,
    strategy: "keep-local" | "keep-server",
  ) => {
    if (!accountId.value) return;
    const [mutation, conflict] = await Promise.all([
      listOfflineMutations(accountId.value).then((rows) =>
        rows.find((row) => row.id === mutationId),
      ),
      listOfflineConflicts(accountId.value).then((rows) =>
        rows.find((row) => row.mutationId === mutationId),
      ),
    ]);
    await resolveOfflineConflict({
      accountId: accountId.value,
      mutationId,
      strategy,
    });
    if (
      mutation &&
      conflict &&
      (
        mutation.entity === "boardItem" ||
        mutation.entity === "boardColumn" ||
        mutation.entity === "boardLink" ||
        mutation.entity === "boardComment"
      )
    ) {
      window.dispatchEvent(
        new CustomEvent("offline-v2-board-conflict-resolved", {
          detail: {
            entity: mutation.entity,
            entityId: mutation.entityId,
            strategy,
            serverVersion: conflict.serverVersion,
            serverSnapshot: conflict.serverSnapshot,
          },
        }),
      );
    }
    await refreshStatus();
    if (strategy === "keep-local" && isOnline.value) void sync();
  };

  if (import.meta.client && !runtimeLifecycleInstalled) {
    runtimeLifecycleInstalled = true;
    watch(
      [accountId, status],
      () => {
        void initialize();
      },
      { immediate: true },
    );
    watch(accountId, (next, previous) => {
      if (previous && next && previous !== next) {
        void clearOfflineAccount(previous);
        void clearOfflineSession(previous);
        void clearRuntimeCaches();
      }
    });
    window.addEventListener("online", () => {
      void sync();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void sync();
    });
  }

  return {
    accountId,
    enabled,
    isOnline,
    initialize,
    queue,
    sync,
    downloadWorkspace,
    refreshStatus,
    clearCurrentAccount,
    removeDownloadedWorkspace,
    offlineSession,
    conflictsList,
    mutationsList,
    retryMutation,
    exportRecovery,
    resolveConflict,
    pending: computed(() => activeState.value.pending.value),
    retrying: computed(() => activeState.value.retrying.value),
    blocked: computed(() => activeState.value.blocked.value),
    rejected: computed(() => activeState.value.rejected.value),
    conflicts: computed(() => activeState.value.conflicts.value),
    isSyncing: computed(() => activeState.value.isSyncing.value),
    lastSyncAt: computed(() => activeState.value.lastSyncAt.value),
  };
}
