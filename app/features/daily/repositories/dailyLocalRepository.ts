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

const ACTIVE_MUTATION_STATUSES = new Set(["pending", "syncing", "retry", "conflict"]);
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

export async function getDailyLocalSnapshot(
  accountId: string,
): Promise<DailyLocalSnapshot> {
  const [notes, actionItems, occurrences, placements] = await Promise.all([
    listOfflineEntities<DailyNoteDTO>(accountId, "dailyNote"),
    listOfflineEntities<ActionItemDTO>(accountId, "actionItem"),
    listOfflineEntities<ActionOccurrenceDTO>(accountId, "actionOccurrence"),
    listOfflineEntities<ActionPlacementDTO>(accountId, "actionPlacement"),
  ]);
  return {
    notes: notes.map((record) => record.data),
    actionItems: actionItems.map((record) => record.data),
    occurrences: occurrences.map((record) => record.data),
    placements: placements.map((record) => record.data),
  };
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
  for (const mutation of active) {
    const payload = mutation.payload as Record<string, unknown>;
    if (mutation.operation === "dailyNote.upsert")
      pendingNoteDates.add(String(payload.dateKey));
    else if (mutation.operation === "actionItem.create")
      pendingItemIds.add(String(payload.id));
    else if (
      mutation.operation === "actionItem.update" ||
      mutation.operation === "actionItem.archive"
    )
      pendingItemIds.add(mutation.entityId);
    else if (
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
  for (const row of projection.items) {
    if (!pendingItemIds.has(row.actionItem.id)) {
      records.push(dailyEntityRecord(accountId, "actionItem", row.actionItem));
    }
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
        if (placement)
          records.push(dailyEntityRecord(accountId, "actionPlacement", placement));
      }
    }
  }
  await putOfflineEntities(records);
}

export async function mergeServerBootstrap(
  accountId: string,
  bootstrap: DailyBootstrapDTO,
): Promise<void> {
  const active = await activeDailyMutations(accountId);
  const pendingItems = new Set<string>();
  const pendingOccurrences = new Set<string>();
  for (const mutation of active) {
    const payload = mutation.payload as Record<string, unknown>;
    if (mutation.operation === "actionItem.create")
      pendingItems.add(String(payload.id));
    else if (
      mutation.operation === "actionItem.update" ||
      mutation.operation === "actionItem.archive"
    )
      pendingItems.add(mutation.entityId);
    else if (
      mutation.operation === "occurrence.reschedule" ||
      mutation.operation === "occurrence.complete" ||
      mutation.operation === "occurrence.reopen"
    )
      pendingOccurrences.add(String(payload.occurrenceKey));
  }

  const records: OfflineEntityRecord[] = [];
  for (const item of bootstrap.actionItems) {
    if (!pendingItems.has(item.id))
      records.push(dailyEntityRecord(accountId, "actionItem", item));
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
      records.push(dailyEntityRecord(accountId, "actionPlacement", placement));
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
    const localContent = (mutation?.payload as Record<string, unknown> | undefined)
      ?.content;
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
