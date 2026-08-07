import type {
  ActionItemDTO,
  ActionOccurrenceDTO,
  ActionPlacementDTO,
  DailyBootstrapDTO,
  DailyNoteDTO,
  DayProjectionDTO,
} from "@shared/utils/daily.contract";
import type { OfflineEntity } from "@shared/utils/offline-sync.contract";
import {
  comparableOfflineValue,
  listOfflineConflicts,
  listOfflineEntities,
  listOfflineMutations,
  migrateLegacyDailyOccurrenceMutations,
  putOfflineEntities,
  resolveOfflineConflict,
} from "../../../utils/offline-v2/repository";
import type { OfflineEntityRecord } from "../../../utils/offline-v2/types";

export type DailyLocalSnapshot = {
  notes: DailyNoteDTO[];
  actionItems: ActionItemDTO[];
  occurrences: ActionOccurrenceDTO[];
  placements: ActionPlacementDTO[];
};

const ACTIVE_MUTATION_STATUSES = new Set([
  "pending",
  "syncing",
  "retry",
  "blocked",
  "waiting",
  "conflict",
]);
const DAILY_MUTATION_OPERATIONS = new Set([
  "dailyNote.upsert",
  "actionItem.create",
  "actionItem.update",
  "actionItem.archive",
  "occurrence.reschedule",
  "occurrence.complete",
  "occurrence.reopen",
]);

/** Build a generic offline-v2 entity record for one of Daily's DTOs. */
export function dailyEntityRecord(
  accountId: string,
  entity: OfflineEntity,
  value: { id: string } & Record<string, unknown>,
  version = 0,
): OfflineEntityRecord {
  return {
    id: `${accountId}:${entity}:${value.id}`,
    accountId,
    entity,
    entityId: value.id,
    version,
    updatedAt: Date.now(),
    localDirty: false,
    deleted: false,
    data: value,
  };
}

async function activeDailyMutations(accountId: string) {
  const mutations = await listOfflineMutations(accountId);
  return mutations.filter(
    (mutation) =>
      DAILY_MUTATION_OPERATIONS.has(mutation.operation) &&
      ACTIVE_MUTATION_STATUSES.has(mutation.status),
  );
}

/** Read every Daily entity in one pass and partition in memory.
 *
 * `listOfflineEntities` has no per-entity index — it reads the whole
 * offline-entities store and filters in JS — so asking for the four Daily
 * entities separately scanned that store four times. This runs on every
 * re-projection (each mutation, each visible date), so the single scan is the
 * difference between a snappy list update and a stutter. */
export async function getDailyLocalSnapshot(
  accountId: string,
): Promise<DailyLocalSnapshot> {
  const records = await listOfflineEntities<Record<string, unknown>>(accountId);
  const snapshot: DailyLocalSnapshot = {
    notes: [],
    actionItems: [],
    occurrences: [],
    placements: [],
  };
  for (const record of records) {
    // Action items and occurrences carry the record revision into the DTO —
    // conflict detection and mutation baseVersion both read it from there.
    const versioned = () =>
      ({ ...record.data, version: record.version }) as unknown;
    switch (record.entity) {
      case "dailyNote":
        snapshot.notes.push(record.data as unknown as DailyNoteDTO);
        break;
      case "actionItem":
        snapshot.actionItems.push(versioned() as ActionItemDTO);
        break;
      case "actionOccurrence":
        snapshot.occurrences.push(versioned() as ActionOccurrenceDTO);
        break;
      case "actionPlacement":
        snapshot.placements.push(record.data as unknown as ActionPlacementDTO);
        break;
    }
  }
  return snapshot;
}

/** Merge a fetched day projection into the local cache without clobbering
 * any entity that still has an unsynced local mutation pending against it. */
export async function mergeServerDay(
  accountId: string,
  projection: DayProjectionDTO,
): Promise<void> {
  const active = await activeDailyMutations(accountId);
  const pendingNoteDates = new Set<string>();
  const pendingItemIds = new Set<string>();
  const pendingOccurrences = new Set<string>();
  const pendingPlacements = new Set<string>();
  for (const mutation of active) {
    const payload = mutation.payload as Record<string, unknown>;
    if (mutation.operation === "dailyNote.upsert")
      pendingNoteDates.add(String(payload.dateKey));
    else if (mutation.operation === "actionItem.create")
      pendingItemIds.add(String(payload.id));
    else if (
      mutation.operation === "actionItem.update" ||
      mutation.operation === "actionItem.archive"
    ) {
      pendingItemIds.add(mutation.entityId);
      if (mutation.operation === "actionItem.update" && payload.placementId)
        pendingPlacements.add(String(payload.placementId));
    } else if (
      mutation.operation === "occurrence.reschedule" ||
      mutation.operation === "occurrence.complete" ||
      mutation.operation === "occurrence.reopen"
    )
      pendingOccurrences.add(String(payload.occurrenceKey));
  }

  const records: OfflineEntityRecord[] = [];
  if (projection.note && !pendingNoteDates.has(projection.dateKey)) {
    records.push(
      dailyEntityRecord(
        accountId,
        "dailyNote",
        projection.note,
        projection.note.version,
      ),
    );
  }
  for (const item of projection.actionItems) {
    if (!pendingItemIds.has(item.id)) {
      records.push(
        dailyEntityRecord(accountId, "actionItem", item, item.version),
      );
    }
  }
  for (const row of projection.items) {
    if (row.occurrence && !pendingOccurrences.has(row.occurrenceKey)) {
      records.push(
        dailyEntityRecord(
          accountId,
          "actionOccurrence",
          row.occurrence,
          row.occurrence.version,
        ),
      );
      for (const placement of [row.activePlacement, row.historyPlacement]) {
        if (placement && !pendingPlacements.has(placement.id))
          records.push(
            dailyEntityRecord(accountId, "actionPlacement", placement),
          );
      }
    }
  }
  await putOfflineEntities(records);
}

export async function mergeServerBootstrap(
  accountId: string,
  bootstrap: DailyBootstrapDTO,
): Promise<void> {
  await migrateLegacyDailyOccurrenceMutations(
    accountId,
    new Map(
      bootstrap.occurrences.map(({ occurrence }) => [
        occurrence.id,
        occurrence.version,
      ]),
    ),
  );
  const active = await activeDailyMutations(accountId);
  const pendingItems = new Set<string>();
  const pendingOccurrences = new Set<string>();
  const pendingPlacements = new Set<string>();
  for (const mutation of active) {
    const payload = mutation.payload as Record<string, unknown>;
    if (mutation.operation === "actionItem.create")
      pendingItems.add(String(payload.id));
    else if (
      mutation.operation === "actionItem.update" ||
      mutation.operation === "actionItem.archive"
    ) {
      pendingItems.add(mutation.entityId);
      if (mutation.operation === "actionItem.update" && payload.placementId)
        pendingPlacements.add(String(payload.placementId));
    } else if (
      mutation.operation === "occurrence.reschedule" ||
      mutation.operation === "occurrence.complete" ||
      mutation.operation === "occurrence.reopen"
    )
      pendingOccurrences.add(String(payload.occurrenceKey));
  }

  const records: OfflineEntityRecord[] = [];
  for (const item of bootstrap.actionItems) {
    if (!pendingItems.has(item.id))
      records.push(
        dailyEntityRecord(accountId, "actionItem", item, item.version),
      );
  }
  for (const row of bootstrap.occurrences) {
    if (pendingOccurrences.has(row.occurrence.occurrenceKey)) continue;
    records.push(
      dailyEntityRecord(
        accountId,
        "actionOccurrence",
        row.occurrence,
        row.occurrence.version,
      ),
    );
    for (const placement of row.placements) {
      if (!pendingPlacements.has(placement.id))
        records.push(
          dailyEntityRecord(accountId, "actionPlacement", placement),
        );
    }
  }
  await putOfflineEntities(records);
}

/**
 * A dailyNote conflict is real work-loss risk only when the content actually
 * differs. Two devices independently saving the identical content (or a
 * retried save racing a slow first attempt) should never interrupt the user —
 * silently accept the server's copy once its content matches what we tried to
 * send. Mirrors Notes' own converged-conflict auto-settle, without adopting
 * Notes' workspace/group-shaped conflict machinery.
 */
export async function autoResolveEquivalentNoteConflicts(
  accountId: string,
): Promise<void> {
  const conflicts = await listOfflineConflicts(accountId);
  const noteConflicts = conflicts.filter(
    (conflict) => conflict.entity === "dailyNote",
  );
  if (!noteConflicts.length) return;
  const mutations = await listOfflineMutations(accountId);
  for (const conflict of noteConflicts) {
    const mutation = mutations.find(
      (row) =>
        row.entity === "dailyNote" &&
        row.entityId === conflict.entityId &&
        row.status === "conflict",
    );
    const localContent = (
      mutation?.payload as Record<string, unknown> | undefined
    )?.content;
    if (localContent === undefined) continue;
    const serverContent = (
      conflict.serverSnapshot as Record<string, unknown> | null | undefined
    )?.content;
    const matches =
      JSON.stringify(comparableOfflineValue(localContent)) ===
      JSON.stringify(comparableOfflineValue(serverContent));
    if (!matches) continue;
    await resolveOfflineConflict({
      accountId,
      mutationId: conflict.mutationId,
      strategy: "keep-server",
    });
  }
}

export interface DailyNoteConflict {
  mutationId: string;
  localContent: unknown;
  serverContent: unknown;
  serverVersion: number;
}

const ACTION_ITEM_UPDATE_FIELDS = [
  "title",
  "description",
  "timingMode",
  "localTime",
  "timezone",
  "recurrence",
] as const;
const ACTION_ITEM_PLACEMENT_FIELDS = new Set([
  "timingMode",
  "localTime",
  "timezone",
]);

export interface DailyActionConflict {
  mutationId: string;
  actionItemId: string;
  localItem: Record<string, unknown>;
  serverItem: Record<string, unknown>;
  serverVersion: number;
  changedFields: string[];
  overlappingFields: string[];
}

export interface DailyOccurrenceConflict {
  mutationId: string;
  occurrenceId: string;
  occurrenceKey: string;
  actionItemId: string;
  actionTitle: string;
  localOccurrence: Record<string, unknown>;
  serverOccurrence: Record<string, unknown>;
  localPlacement: Record<string, unknown> | null;
  serverPlacement: Record<string, unknown> | null;
  serverVersion: number;
  changedFields: string[];
  overlappingFields: string[];
}

export interface DailyActionConflictRebase {
  payload: Record<string, unknown>;
  changedFields: string[];
  localData: Record<string, unknown>;
}

function sameOfflineValue(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(comparableOfflineValue(left)) ===
    JSON.stringify(comparableOfflineValue(right))
  );
}

/**
 * Rebase only fields the user truly changed onto the latest server snapshot.
 * Daily's form sends a full editable payload, so mutation.changedFields alone
 * cannot distinguish user intent from unchanged form values.
 */
export function buildDailyActionConflictRebase(input: {
  payload: Record<string, unknown>;
  rollbackData?: Record<string, unknown> | null;
  serverSnapshot?: Record<string, unknown> | null;
  currentLocal?: Record<string, unknown> | null;
  fallbackChangedFields?: string[];
}): DailyActionConflictRebase {
  const hasRollback = Boolean(input.rollbackData);
  const changedFields = ACTION_ITEM_UPDATE_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(input.payload, field))
      return false;
    if (!hasRollback)
      return input.fallbackChangedFields?.includes(field) ?? true;
    return !sameOfflineValue(input.payload[field], input.rollbackData?.[field]);
  });
  const payload = Object.fromEntries(
    changedFields.map((field) => [field, input.payload[field]]),
  );
  if (
    changedFields.some((field) => ACTION_ITEM_PLACEMENT_FIELDS.has(field)) &&
    typeof input.payload.placementId === "string"
  ) {
    payload.placementId = input.payload.placementId;
  }
  const localData = {
    ...(input.currentLocal ?? {}),
    ...(input.serverSnapshot ?? {}),
    ...Object.fromEntries(
      changedFields.map((field) => [field, input.payload[field]]),
    ),
  };
  if (input.currentLocal?.updatedAt)
    localData.updatedAt = input.currentLocal.updatedAt;
  return { payload, changedFields: [...changedFields], localData };
}

export async function getDailyActionConflicts(
  accountId: string,
): Promise<DailyActionConflict[]> {
  const [conflicts, mutations, snapshot] = await Promise.all([
    listOfflineConflicts(accountId),
    listOfflineMutations(accountId),
    getDailyLocalSnapshot(accountId),
  ]);
  return conflicts
    .filter((conflict) => conflict.entity === "actionItem")
    .flatMap((conflict) => {
      const mutation = mutations.find(
        (row) =>
          row.id === conflict.mutationId &&
          row.entity === "actionItem" &&
          row.status === "conflict",
      );
      if (!mutation) return [];
      const localItem =
        snapshot.actionItems.find((item) => item.id === conflict.entityId) ??
        mutation.payload;
      const serverItem =
        (conflict.serverSnapshot as Record<string, unknown> | null) ?? {};
      const rebase = buildDailyActionConflictRebase({
        payload: mutation.payload,
        rollbackData: mutation.rollbackData,
        serverSnapshot: serverItem,
        currentLocal: localItem,
        fallbackChangedFields: mutation.changedFields,
      });
      return [
        {
          mutationId: mutation.id,
          actionItemId: conflict.entityId,
          localItem,
          serverItem,
          serverVersion: conflict.serverVersion,
          changedFields: rebase.changedFields,
          overlappingFields: conflict.overlappingFields,
        },
      ];
    });
}

export async function getDailyOccurrenceConflicts(
  accountId: string,
): Promise<DailyOccurrenceConflict[]> {
  const [conflicts, mutations, snapshot] = await Promise.all([
    listOfflineConflicts(accountId),
    listOfflineMutations(accountId),
    getDailyLocalSnapshot(accountId),
  ]);
  return conflicts
    .filter((conflict) => conflict.entity === "actionOccurrence")
    .flatMap((conflict) => {
      const mutation = mutations.find(
        (row) =>
          row.id === conflict.mutationId &&
          row.entity === "actionOccurrence" &&
          row.status === "conflict",
      );
      if (!mutation) return [];
      const localOccurrence =
        (snapshot.occurrences.find(
          (row) => row.id === conflict.entityId,
        ) as unknown as Record<string, unknown> | undefined) ??
        mutation.payload;
      const serverOccurrence =
        (conflict.serverSnapshot as Record<string, unknown> | null) ?? {};
      const actionItemId = String(
        localOccurrence.actionItemId ??
          serverOccurrence.actionItemId ??
          mutation.payload.actionItemId ??
          "",
      );
      const occurrenceKey = String(
        localOccurrence.occurrenceKey ??
          serverOccurrence.occurrenceKey ??
          mutation.payload.occurrenceKey ??
          "",
      );
      const localPlacementId = String(localOccurrence.currentPlacementId ?? "");
      const serverPlacementId = String(
        serverOccurrence.currentPlacementId ?? "",
      );
      const serverPlacements = Array.isArray(serverOccurrence.placements)
        ? (serverOccurrence.placements as Record<string, unknown>[])
        : [];
      return [
        {
          mutationId: mutation.id,
          occurrenceId: conflict.entityId,
          occurrenceKey,
          actionItemId,
          actionTitle:
            snapshot.actionItems.find((item) => item.id === actionItemId)
              ?.title ?? "Action item",
          localOccurrence,
          serverOccurrence,
          localPlacement:
            (snapshot.placements.find(
              (placement) => placement.id === localPlacementId,
            ) as unknown as Record<string, unknown> | undefined) ?? null,
          serverPlacement:
            serverPlacements.find(
              (placement) => placement.id === serverPlacementId,
            ) ?? null,
          serverVersion: conflict.serverVersion,
          changedFields: mutation.changedFields,
          overlappingFields: conflict.overlappingFields,
        },
      ];
    });
}

export async function resolveDailyOccurrenceConflict(input: {
  accountId: string;
  occurrenceId: string;
  strategy: "keep-local" | "keep-server";
}): Promise<boolean> {
  const conflicts = await listOfflineConflicts(input.accountId);
  const conflict = conflicts.find(
    (row) =>
      row.entity === "actionOccurrence" && row.entityId === input.occurrenceId,
  );
  if (!conflict) return false;
  await resolveOfflineConflict({
    accountId: input.accountId,
    mutationId: conflict.mutationId,
    strategy: input.strategy,
  });
  return true;
}

export async function resolveDailyActionItemConflict(input: {
  accountId: string;
  actionItemId: string;
  strategy: "keep-local" | "keep-server";
}): Promise<boolean> {
  const [conflicts, mutations, snapshot] = await Promise.all([
    listOfflineConflicts(input.accountId),
    listOfflineMutations(input.accountId),
    getDailyLocalSnapshot(input.accountId),
  ]);
  const conflict = conflicts.find(
    (row) => row.entity === "actionItem" && row.entityId === input.actionItemId,
  );
  if (!conflict) return false;
  const mutation = mutations.find(
    (row) =>
      row.id === conflict.mutationId &&
      row.entity === "actionItem" &&
      row.status === "conflict",
  );
  if (!mutation) return false;

  if (input.strategy === "keep-server") {
    await resolveOfflineConflict({
      accountId: input.accountId,
      mutationId: mutation.id,
      strategy: "keep-server",
    });
    return true;
  }

  const rebase = buildDailyActionConflictRebase({
    payload: mutation.payload,
    rollbackData: mutation.rollbackData,
    serverSnapshot:
      (conflict.serverSnapshot as Record<string, unknown> | null) ?? {},
    currentLocal:
      snapshot.actionItems.find((item) => item.id === input.actionItemId) ??
      null,
    fallbackChangedFields: mutation.changedFields,
  });
  if (!rebase.changedFields.length) {
    await resolveOfflineConflict({
      accountId: input.accountId,
      mutationId: mutation.id,
      strategy: "keep-server",
    });
    return true;
  }
  await resolveOfflineConflict({
    accountId: input.accountId,
    mutationId: mutation.id,
    strategy: "keep-local",
    rebasedPayload: rebase.payload,
    rebasedChangedFields: rebase.changedFields,
    rebasedLocalData: rebase.localData,
  });
  return true;
}

/**
 * A dailyNote's local snapshot isn't stored on the conflict record itself
 * (only `serverSnapshot` is) — it's recovered by joining against the
 * matching `status: "conflict"` mutation's payload, same join
 * `autoResolveEquivalentNoteConflicts` already performs above.
 */
export async function getDailyNoteConflict(
  accountId: string,
  dateKey: string,
): Promise<DailyNoteConflict | null> {
  const snapshot = await getDailyLocalSnapshot(accountId);
  const noteId =
    snapshot.notes.find((note) => note.dateKey === dateKey)?.id ??
    `daily-note:${accountId}:${dateKey}`;
  const conflicts = await listOfflineConflicts(accountId);
  const conflict = conflicts.find(
    (row) => row.entity === "dailyNote" && row.entityId === noteId,
  );
  if (!conflict) return null;
  const mutations = await listOfflineMutations(accountId);
  const mutation = mutations.find(
    (row) =>
      row.entity === "dailyNote" &&
      row.entityId === noteId &&
      row.status === "conflict",
  );
  return {
    mutationId: conflict.mutationId,
    localContent: (mutation?.payload as Record<string, unknown> | undefined)
      ?.content,
    serverContent: (
      conflict.serverSnapshot as Record<string, unknown> | null | undefined
    )?.content,
    serverVersion: conflict.serverVersion,
  };
}

export interface DailyNoteSyncIssue {
  status: "retry" | "blocked" | "waiting" | "rejected";
  message: string;
}

export async function getDailyNoteSyncIssue(
  accountId: string,
  dateKey: string,
): Promise<DailyNoteSyncIssue | null> {
  const mutation = (await listOfflineMutations(accountId))
    .filter(
      (row) =>
        row.entity === "dailyNote" &&
        String((row.payload as Record<string, unknown>).dateKey ?? "") ===
          dateKey &&
        ["retry", "blocked", "waiting", "rejected"].includes(row.status),
    )
    .at(-1);
  if (!mutation) return null;
  const status = mutation.status as DailyNoteSyncIssue["status"];
  const message =
    status === "blocked"
      ? "Saved locally. Sign in again to sync this note."
      : status === "waiting"
        ? "Saved locally. Waiting for an earlier change to finish."
        : status === "rejected"
          ? "Saved locally, but the server rejected this change. Open Offline Sync Center for recovery."
          : "Saved locally. Server sync was delayed and will retry automatically.";
  return { status, message };
}
