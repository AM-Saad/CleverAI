import type {
  ActionItemDTO,
  ActionOccurrenceDTO,
  ActionPlacementDTO,
  CreateActionItemDTO,
  DailyNoteDTO,
  DailyBootstrapDTO,
  DayItemDTO,
  DayProjectionDTO,
  RecurrenceRuleDTO,
} from "@shared/utils/daily.contract";
import { addDateKeyDays, occurrenceKey } from "@shared/utils/daily-recurrence";
import { placementStateAfterMove } from "@shared/utils/daily-placement";
import { positionBetween } from "@shared/utils/position-key";
import type {
  OfflineEntity,
  OfflineMutation,
} from "@shared/utils/offline-sync.contract";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import type { OfflineEntityRecord } from "~/utils/offline-v2/types";
import {
  ACTION_ITEM_CREATE_FIELDS,
  buildActionItemUpdateMutation,
} from "../domain/actionItemMutation";
import { projectLocalDay } from "../domain/projectLocalDay";
import {
  autoResolveEquivalentNoteConflicts,
  getDailyActionConflicts,
  getDailyLocalSnapshot,
  getDailyNoteConflict,
  getDailyNoteSyncIssue,
  getDailyOccurrenceConflicts,
  mergeServerDay,
  mergeServerBootstrap,
  resolveDailyActionItemConflict,
  resolveDailyOccurrenceConflict,
} from "../repositories/dailyLocalRepository";

type ApiSuccess<T> = { success: true; data: T };

export type DailyNewActionInput = {
  title: string;
  dateKey: string;
  timingMode: "ALL_DAY" | "TIMED";
  localTime?: string | null;
  timezone?: string | null;
  recurrence?: RecurrenceRuleDTO | null;
};

export type DailyUpdateActionInput = {
  id: string;
  visibleDateKey: string;
  title: string;
  timingMode: "ALL_DAY" | "TIMED";
  localTime?: string | null;
  timezone?: string | null;
  recurrence?: RecurrenceRuleDTO | null;
  placementId?: string | null;
};

const OCCURRENCE_COMPLETION_FIELDS = ["status", "completedAt"];
const OCCURRENCE_RESCHEDULE_FIELDS = ["currentPlacementId"];

let listenersInstalled = false;
let lastLifecycleRefreshAt = 0;
const bootstrappedAccounts = new Set<string>();

const DAILY_REFRESH_TTL_MS = 20_000;

type DailyRefreshGuard = {
  promise: Promise<void> | null;
  lastSuccessAt: number;
};
const dailyRefreshGuards = new Map<string, DailyRefreshGuard>();
const DAILY_PROJECTIONS_STATE_KEY = "daily-projections-by-account";
const DAILY_LOADING_STATE_KEY = "daily-loading-by-account";
const DAILY_ERRORS_STATE_KEY = "daily-errors-by-account";

export function clearDailyMemoryState(): void {
  useState<Record<string, Record<string, DayProjectionDTO>>>(
    DAILY_PROJECTIONS_STATE_KEY,
  ).value = {};
  useState<Record<string, Record<string, boolean>>>(
    DAILY_LOADING_STATE_KEY,
  ).value = {};
  useState<Record<string, string | null>>(DAILY_ERRORS_STATE_KEY).value = {};
  bootstrappedAccounts.clear();
  dailyRefreshGuards.clear();
}

function getDailyRefreshGuard(key: string): DailyRefreshGuard {
  let state = dailyRefreshGuards.get(key);
  if (!state) {
    state = { promise: null, lastSuccessAt: 0 };
    dailyRefreshGuards.set(key, state);
  }
  return state;
}

/** Only entries with no in-flight promise and past the TTL are dropped; once
 * outside the TTL an entry has no remaining purpose (see refreshFromServer). */
function pruneDailyRefreshGuards() {
  const cutoff = Date.now() - DAILY_REFRESH_TTL_MS;
  for (const [key, state] of dailyRefreshGuards) {
    if (!state.promise && state.lastSuccessAt < cutoff)
      dailyRefreshGuards.delete(key);
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;

const iso = (value: string | Date | undefined = new Date()) =>
  value instanceof Date ? value.toISOString() : value;

function queuedDailyRecord(
  entity: OfflineEntity,
  value: { id: string } & Record<string, unknown>,
  version = 0,
): Omit<OfflineEntityRecord, "id" | "accountId" | "updatedAt"> {
  return {
    entity,
    entityId: value.id,
    version,
    localDirty: false,
    deleted: false,
    data: value,
  };
}

function dailyRollbackRecord(
  entity: OfflineEntity,
  entityId: string,
  data: Record<string, unknown> | null,
  version = 0,
): NonNullable<OfflineMutation["rollbackRecords"]>[number] {
  return { entity, entityId, version, data };
}

export function useDaily() {
  const offline = useOfflineRuntime();
  // Daily reads go through raw $fetch, which bypasses the service layer's
  // failure hook — report network-class failures so a silent connectivity drop
  // still flips the monitor instead of only failing this one request.
  const { reportFetchError } = useNetworkStatus();
  const accountId = computed(() => offline.accountId.value);
  const projectionsByAccount = useState<
    Record<string, Record<string, DayProjectionDTO>>
  >(DAILY_PROJECTIONS_STATE_KEY, () => ({}));
  const loadingByAccount = useState<Record<string, Record<string, boolean>>>(
    DAILY_LOADING_STATE_KEY,
    () => ({}),
  );
  const errorsByAccount = useState<Record<string, string | null>>(
    DAILY_ERRORS_STATE_KEY,
    () => ({}),
  );
  const projections = computed({
    get: () => projectionsByAccount.value[accountId.value] ?? {},
    set: (value: Record<string, DayProjectionDTO>) => {
      if (!accountId.value) return;
      projectionsByAccount.value = {
        ...projectionsByAccount.value,
        [accountId.value]: value,
      };
    },
  });
  const loadingDates = computed({
    get: () => loadingByAccount.value[accountId.value] ?? {},
    set: (value: Record<string, boolean>) => {
      if (!accountId.value) return;
      loadingByAccount.value = {
        ...loadingByAccount.value,
        [accountId.value]: value,
      };
    },
  });
  const error = computed({
    get: () => errorsByAccount.value[accountId.value] ?? null,
    set: (value: string | null) => {
      if (!accountId.value) return;
      errorsByAccount.value = {
        ...errorsByAccount.value,
        [accountId.value]: value,
      };
    },
  });

  const setProjection = (projection: DayProjectionDTO) => {
    projections.value = {
      ...projections.value,
      [projection.dateKey]: projection,
    };
  };

  async function projectDate(dateKey: string) {
    if (!accountId.value) return;
    setProjection(
      projectLocalDay(await getDailyLocalSnapshot(accountId.value), dateKey),
    );
  }

  async function settleOnlineActionSave(dateKeys: Iterable<string>) {
    if (!offline.isVerifiedOnline.value) return;
    await offline.sync();
    await Promise.all(
      [...new Set(dateKeys)].map((dateKey) =>
        refreshFromServer(dateKey).catch(() => undefined),
      ),
    );
  }

  async function refreshFromServer(
    dateKey: string,
    options: { allowCached?: boolean } = {},
  ): Promise<void> {
    const currentAccountId = accountId.value;
    if (!currentAccountId || !offline.isVerifiedOnline.value) return;
    await autoResolveEquivalentNoteConflicts(currentAccountId);

    const guard = getDailyRefreshGuard(`${currentAccountId}:${dateKey}`);
    if (guard.promise) return guard.promise; // always join an in-flight request
    if (
      options.allowCached &&
      Date.now() - guard.lastSuccessAt < DAILY_REFRESH_TTL_MS
    ) {
      return; // caller opted into trusting a recently-confirmed date
    }

    const run = (async () => {
      try {
        const response = await $fetch<ApiSuccess<DayProjectionDTO>>(
          `/api/daily/day/${dateKey}`,
        );
        await mergeServerDay(currentAccountId, response.data);
        await projectDate(dateKey);
        guard.lastSuccessAt = Date.now();
      } catch (refreshError) {
        void reportFetchError(refreshError);
        throw refreshError;
      }
    })();

    const tracked: Promise<void> = run.finally(() => {
      if (guard.promise === tracked) guard.promise = null;
      pruneDailyRefreshGuards();
    });
    guard.promise = tracked;
    return tracked;
  }

  /** Best-effort background warm-up for the +/-1 neighbor dates. Fire-and-
   * forget: callers must not await this. Goes through refreshFromServer's
   * own guard/merge path rather than a parallel reimplementation, so a real
   * navigation landing on a date that's already been prefetched joins the
   * same in-flight request instead of firing a duplicate one. */
  function prefetchAdjacentDays(centerDateKey: string): void {
    for (const neighbor of [
      addDateKeyDays(centerDateKey, -1),
      addDateKeyDays(centerDateKey, 1),
    ]) {
      void refreshFromServer(neighbor, { allowCached: true }).catch(
        () => undefined,
      );
    }
  }

  async function bootstrap() {
    if (
      !accountId.value ||
      !offline.isVerifiedOnline.value ||
      bootstrappedAccounts.has(accountId.value)
    )
      return;
    try {
      const response = await $fetch<ApiSuccess<DailyBootstrapDTO>>(
        "/api/daily/bootstrap",
      );
      await mergeServerBootstrap(accountId.value, response.data);
      bootstrappedAccounts.add(accountId.value);
    } catch (bootstrapError) {
      void reportFetchError(bootstrapError);
      throw bootstrapError;
    }
  }

  async function loadDay(dateKey: string) {
    if (!accountId.value) return;
    // Only surface the loading flag on a genuine first look at this date.
    // A date we already have a projection for (an earlier visit, or a
    // background prefetch) has something correct to show immediately —
    // flipping the flag on then off around fast, already-warm local/network
    // no-ops just flickers the skeleton/empty-state UI for no reason.
    const isFirstLook = !projections.value[dateKey];
    if (isFirstLook) {
      loadingDates.value = { ...loadingDates.value, [dateKey]: true };
    }
    error.value = null;
    try {
      await projectDate(dateKey);
      if (offline.isVerifiedOnline.value) {
        await bootstrap();
        await offline.sync();
        // Trust a recently-confirmed date (whether that confirmation came
        // from an earlier visit or a background prefetch) — repeat
        // navigation shouldn't re-hit the network every time. Mutation
        // follow-up refreshes below still always force a fresh check.
        await refreshFromServer(dateKey, { allowCached: true });
      }
    } catch (loadError) {
      error.value =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this day";
    } finally {
      if (isFirstLook) {
        loadingDates.value = { ...loadingDates.value, [dateKey]: false };
      }
    }
  }

  async function createAction(input: DailyNewActionInput) {
    if (!accountId.value) throw new Error("Sign in once before saving offline");
    const snapshot = await getDailyLocalSnapshot(accountId.value);
    const now = new Date().toISOString();
    const itemId = uid();
    const occurrenceId = uid();
    const placementId = uid();
    const key = occurrenceKey(itemId, input.dateKey);
    const lastPosition = snapshot.placements
      .filter((placement) => placement.dateKey === input.dateKey)
      .sort((left, right) => left.position.localeCompare(right.position))
      .at(-1)?.position;
    const position = positionBetween(lastPosition, null);
    const payload: CreateActionItemDTO = {
      id: itemId,
      occurrenceId,
      placementId,
      title: input.title.trim(),
      timingMode: input.timingMode,
      startDate: input.dateKey,
      localTime: input.timingMode === "TIMED" ? input.localTime : null,
      timezone: input.timezone ?? null,
      recurrence: input.recurrence ?? null,
      position,
    };
    const actionItem: ActionItemDTO = {
      id: itemId,
      userId: accountId.value,
      title: payload.title,
      description: null,
      timingMode: payload.timingMode,
      startDate: payload.startDate,
      localTime: payload.localTime ?? null,
      timezone: payload.timezone ?? null,
      recurrence: payload.recurrence ?? null,
      lifecycle: "ACTIVE",
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    const occurrence: ActionOccurrenceDTO = {
      id: occurrenceId,
      occurrenceKey: key,
      userId: accountId.value,
      actionItemId: itemId,
      originalDateKey: input.dateKey,
      currentPlacementId: placementId,
      status: "OPEN",
      completedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const placement: ActionPlacementDTO = {
      id: placementId,
      userId: accountId.value,
      occurrenceId,
      occurrenceKey: key,
      dateKey: input.dateKey,
      timingMode: payload.timingMode,
      localTime: payload.localTime ?? null,
      timezone: payload.timezone ?? null,
      position,
      state: "ACTIVE",
      movedToPlacementId: null,
      createdAt: now,
      updatedAt: now,
    };
    await offline.queue({
      entity: "actionItem",
      operation: "actionItem.create",
      entityId: itemId,
      changedFields: [...ACTION_ITEM_CREATE_FIELDS],
      payload,
      localData: actionItem as unknown as Record<string, unknown>,
      localRecords: [
        queuedDailyRecord(
          "actionOccurrence",
          occurrence as unknown as { id: string } & Record<string, unknown>,
          1,
        ),
        queuedDailyRecord(
          "actionPlacement",
          placement as unknown as { id: string } & Record<string, unknown>,
        ),
      ],
      rollbackRecords: [
        dailyRollbackRecord("actionOccurrence", occurrence.id, null),
        dailyRollbackRecord("actionPlacement", placement.id, null),
      ],
      deferSync: true,
    });
    await projectDate(input.dateKey);
    await settleOnlineActionSave([input.dateKey]);
  }

  async function updateAction(input: DailyUpdateActionInput) {
    if (!accountId.value) throw new Error("Sign in once before saving offline");
    const snapshot = await getDailyLocalSnapshot(accountId.value);
    const current = snapshot.actionItems.find((item) => item.id === input.id);
    if (!current) throw new Error("Action item not found");

    const now = new Date().toISOString();
    const localTime =
      input.timingMode === "TIMED" ? (input.localTime ?? "09:00") : null;
    const actionItem: ActionItemDTO = {
      ...current,
      title: input.title.trim(),
      timingMode: input.timingMode,
      localTime,
      timezone: input.timezone ?? null,
      recurrence: input.recurrence ?? null,
      updatedAt: now,
    };
    const placement = input.placementId
      ? snapshot.placements.find((item) => item.id === input.placementId)
      : null;
    const mutation = buildActionItemUpdateMutation(
      current,
      actionItem,
      placement?.id,
    );
    if (!mutation.changedFields.length) return;
    const updatedPlacement: ActionPlacementDTO | null =
      placement && mutation.placementChanged
        ? {
            ...placement,
            timingMode: input.timingMode,
            localTime,
            timezone: input.timezone ?? null,
            updatedAt: now,
          }
        : null;

    await offline.queue({
      entity: "actionItem",
      operation: "actionItem.update",
      entityId: actionItem.id,
      changedFields: mutation.changedFields,
      payload: mutation.payload,
      localData: actionItem as unknown as Record<string, unknown>,
      localRecords: updatedPlacement
        ? [
            queuedDailyRecord(
              "actionPlacement",
              updatedPlacement as unknown as { id: string } & Record<
                string,
                unknown
              >,
            ),
          ]
        : undefined,
      rollbackRecords:
        updatedPlacement && placement
          ? [
              dailyRollbackRecord(
                "actionPlacement",
                placement.id,
                placement as unknown as Record<string, unknown>,
              ),
            ]
          : undefined,
      deferSync: true,
    });

    const dates = new Set([
      input.visibleDateKey,
      ...Object.keys(projections.value),
    ]);
    await Promise.all([...dates].map((dateKey) => projectDate(dateKey)));
    await settleOnlineActionSave([input.visibleDateKey]);
  }

  async function saveNote(
    dateKey: string,
    content: unknown,
    options: { dependsOn?: string[] } = {},
  ) {
    if (!accountId.value) throw new Error("Sign in once before saving offline");
    const snapshot = await getDailyLocalSnapshot(accountId.value);
    const current = snapshot.notes.find((note) => note.dateKey === dateKey);
    const now = new Date().toISOString();
    const noteId = current?.id ?? `daily-note:${accountId.value}:${dateKey}`;
    const note: DailyNoteDTO = {
      id: noteId,
      userId: accountId.value,
      dateKey,
      content,
      contentFormat: "TIPTAP_JSON",
      version: current?.version ?? 1,
      createdAt: iso(current?.createdAt) ?? now,
      updatedAt: now,
    };
    await offline.queue({
      entity: "dailyNote",
      operation: "dailyNote.upsert",
      entityId: noteId,
      changedFields: ["content"],
      payload: { id: noteId, dateKey, content },
      dependsOn: options.dependsOn,
      localData: note as unknown as Record<string, unknown>,
      deferSync: true,
    });
    await projectDate(dateKey);
    void offline
      .sync()
      .then(() => refreshFromServer(dateKey))
      .catch(() => undefined);
  }

  async function getNoteConflict(dateKey: string) {
    if (!accountId.value) return null;
    return getDailyNoteConflict(accountId.value, dateKey);
  }

  async function getNoteSyncIssue(dateKey: string) {
    if (!accountId.value) return null;
    return getDailyNoteSyncIssue(accountId.value, dateKey);
  }

  async function resolveNoteConflict(
    dateKey: string,
    strategy: "keep-local" | "keep-server",
  ) {
    if (!accountId.value) return;
    const conflict = await getDailyNoteConflict(accountId.value, dateKey);
    if (!conflict) return;
    await offline.resolveConflict(conflict.mutationId, strategy);
    await projectDate(dateKey);
  }

  async function getActionConflicts() {
    if (!accountId.value) return [];
    return getDailyActionConflicts(accountId.value);
  }

  async function getOccurrenceConflicts() {
    if (!accountId.value) return [];
    return getDailyOccurrenceConflicts(accountId.value);
  }

  async function resolveActionConflict(
    dateKey: string,
    actionItemId: string,
    strategy: "keep-local" | "keep-server",
  ) {
    if (!accountId.value) return false;
    const resolved = await resolveDailyActionItemConflict({
      accountId: accountId.value,
      actionItemId,
      strategy,
    });
    if (!resolved) return false;
    await offline.refreshStatus();
    const synced = strategy === "keep-local" ? await offline.sync() : true;
    await refreshFromServer(dateKey);
    return synced;
  }

  async function resolveOccurrenceConflict(
    dateKey: string,
    occurrenceId: string,
    strategy: "keep-local" | "keep-server",
  ) {
    if (!accountId.value) return false;
    const resolved = await resolveDailyOccurrenceConflict({
      accountId: accountId.value,
      occurrenceId,
      strategy,
    });
    if (!resolved) return false;
    await offline.refreshStatus();
    const synced = strategy === "keep-local" ? await offline.sync() : true;
    await projectDate(dateKey);
    if (offline.isVerifiedOnline.value) await refreshFromServer(dateKey);
    return synced;
  }

  function materialization(row: DayItemDTO, position: string) {
    const occurrenceId = row.occurrence?.id ?? uid();
    const sourcePlacementId = row.activePlacement?.id ?? uid();
    return {
      actionItemId: row.actionItem.id,
      occurrenceId,
      occurrenceKey: row.occurrenceKey,
      originalDateKey: row.originalDateKey,
      sourcePlacementId,
      sourceTimingMode: row.actionItem.timingMode,
      sourceLocalTime: row.actionItem.localTime ?? null,
      sourceTimezone: row.actionItem.timezone ?? null,
      sourcePosition: position,
    } as const;
  }

  async function setCompleted(
    dateKey: string,
    row: DayItemDTO,
    completed: boolean,
  ) {
    if (!accountId.value) return;
    const snapshot = await getDailyLocalSnapshot(accountId.value);
    const position =
      row.activePlacement?.position ??
      positionBetween(
        snapshot.placements.filter((item) => item.dateKey === dateKey).at(-1)
          ?.position,
        null,
      );
    const now = new Date().toISOString();
    if (!completed) {
      if (!row.occurrence || !row.activePlacement) return;
      const occurrence: ActionOccurrenceDTO = {
        ...row.occurrence,
        status: "OPEN",
        completedAt: null,
        version: row.occurrence.version,
        updatedAt: now,
      };
      const placement: ActionPlacementDTO = {
        ...row.activePlacement,
        state: "ACTIVE",
        updatedAt: now,
      };
      await offline.queue({
        entity: "actionOccurrence",
        operation: "occurrence.reopen",
        entityId: occurrence.id,
        baseVersion: row.occurrence.version,
        changedFields: OCCURRENCE_COMPLETION_FIELDS,
        payload: { occurrenceKey: row.occurrenceKey },
        localData: occurrence as unknown as Record<string, unknown>,
        localRecords: [
          queuedDailyRecord(
            "actionPlacement",
            placement as unknown as { id: string } & Record<string, unknown>,
          ),
        ],
        rollbackRecords: [
          dailyRollbackRecord(
            "actionPlacement",
            row.activePlacement.id,
            row.activePlacement as unknown as Record<string, unknown>,
          ),
        ],
        deferSync: true,
        sequence: true,
      });
    } else {
      const base = materialization(row, position);
      const occurrence: ActionOccurrenceDTO = {
        id: base.occurrenceId,
        occurrenceKey: row.occurrenceKey,
        userId: accountId.value,
        actionItemId: row.actionItem.id,
        originalDateKey: row.originalDateKey,
        currentPlacementId: base.sourcePlacementId,
        status: "COMPLETED",
        completedAt: now,
        version: row.occurrence?.version ?? 0,
        createdAt: iso(row.occurrence?.createdAt) ?? now,
        updatedAt: now,
      };
      const placement: ActionPlacementDTO = {
        id: base.sourcePlacementId,
        userId: accountId.value,
        occurrenceId: base.occurrenceId,
        occurrenceKey: row.occurrenceKey,
        dateKey: row.activePlacement?.dateKey ?? row.originalDateKey,
        timingMode:
          row.activePlacement?.timingMode ?? row.actionItem.timingMode,
        localTime:
          row.activePlacement?.localTime ?? row.actionItem.localTime ?? null,
        timezone:
          row.activePlacement?.timezone ?? row.actionItem.timezone ?? null,
        position,
        state: "COMPLETED",
        movedToPlacementId: null,
        createdAt: iso(row.activePlacement?.createdAt) ?? now,
        updatedAt: now,
      };
      await offline.queue({
        entity: "actionOccurrence",
        operation: "occurrence.complete",
        entityId: base.occurrenceId,
        baseVersion: row.occurrence?.version ?? 0,
        changedFields: OCCURRENCE_COMPLETION_FIELDS,
        payload: { ...base, completedAt: now },
        localData: occurrence as unknown as Record<string, unknown>,
        rollbackData: row.occurrence
          ? (row.occurrence as unknown as Record<string, unknown>)
          : null,
        localRecords: [
          queuedDailyRecord(
            "actionPlacement",
            placement as unknown as { id: string } & Record<string, unknown>,
          ),
        ],
        rollbackRecords: [
          dailyRollbackRecord(
            "actionPlacement",
            placement.id,
            row.activePlacement
              ? (row.activePlacement as unknown as Record<string, unknown>)
              : null,
          ),
        ],
        deferSync: true,
        sequence: true,
      });
    }
    await projectDate(dateKey);
    await settleOnlineActionSave([dateKey]);
  }

  async function reschedule(
    visibleDateKey: string,
    row: DayItemDTO,
    targetDateKey: string,
    targetTime?: string | null,
  ) {
    if (!accountId.value) return;
    const snapshot = await getDailyLocalSnapshot(accountId.value);
    const now = new Date().toISOString();
    const position = positionBetween(
      snapshot.placements
        .filter((item) => item.dateKey === targetDateKey)
        .sort((left, right) => left.position.localeCompare(right.position))
        .at(-1)?.position,
      null,
    );
    const base = materialization(
      row,
      row.activePlacement?.position ?? position,
    );
    const targetPlacementId = uid();
    const source: ActionPlacementDTO = {
      id: base.sourcePlacementId,
      userId: accountId.value,
      occurrenceId: base.occurrenceId,
      occurrenceKey: row.occurrenceKey,
      dateKey: row.activePlacement?.dateKey ?? row.originalDateKey,
      timingMode: row.activePlacement?.timingMode ?? row.actionItem.timingMode,
      localTime:
        row.activePlacement?.localTime ?? row.actionItem.localTime ?? null,
      timezone:
        row.activePlacement?.timezone ?? row.actionItem.timezone ?? null,
      position: row.activePlacement?.position ?? position,
      state: "MOVED",
      movedToPlacementId: targetPlacementId,
      createdAt: iso(row.activePlacement?.createdAt) ?? now,
      updatedAt: now,
    };
    const targetMode = targetTime ? ("TIMED" as const) : ("ALL_DAY" as const);
    const target: ActionPlacementDTO = {
      id: targetPlacementId,
      userId: accountId.value,
      occurrenceId: base.occurrenceId,
      occurrenceKey: row.occurrenceKey,
      dateKey: targetDateKey,
      timingMode: targetMode,
      localTime: targetTime ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      position,
      state: placementStateAfterMove(row.occurrence?.status ?? "OPEN"),
      movedToPlacementId: null,
      createdAt: now,
      updatedAt: now,
    };
    const occurrence: ActionOccurrenceDTO = {
      id: base.occurrenceId,
      occurrenceKey: row.occurrenceKey,
      userId: accountId.value,
      actionItemId: row.actionItem.id,
      originalDateKey: row.originalDateKey,
      currentPlacementId: targetPlacementId,
      status: row.occurrence?.status ?? "OPEN",
      completedAt: row.occurrence?.completedAt ?? null,
      version: row.occurrence?.version ?? 0,
      createdAt: iso(row.occurrence?.createdAt) ?? now,
      updatedAt: now,
    };
    await offline.queue({
      entity: "actionOccurrence",
      operation: "occurrence.reschedule",
      entityId: base.occurrenceId,
      baseVersion: row.occurrence?.version ?? 0,
      changedFields: OCCURRENCE_RESCHEDULE_FIELDS,
      payload: {
        actionItemId: row.actionItem.id,
        occurrenceId: base.occurrenceId,
        occurrenceKey: row.occurrenceKey,
        originalDateKey: row.originalDateKey,
        sourcePlacementId: base.sourcePlacementId,
        sourceTimingMode: base.sourceTimingMode,
        sourceLocalTime: base.sourceLocalTime,
        sourceTimezone: base.sourceTimezone,
        sourcePosition: base.sourcePosition,
        targetPlacementId,
        targetDateKey,
        targetTimingMode: targetMode,
        targetLocalTime: targetTime ?? null,
        targetTimezone: target.timezone,
        targetPosition: position,
      },
      localData: occurrence as unknown as Record<string, unknown>,
      rollbackData: row.occurrence
        ? (row.occurrence as unknown as Record<string, unknown>)
        : null,
      localRecords: [
        queuedDailyRecord(
          "actionPlacement",
          source as unknown as { id: string } & Record<string, unknown>,
        ),
        queuedDailyRecord(
          "actionPlacement",
          target as unknown as { id: string } & Record<string, unknown>,
        ),
      ],
      rollbackRecords: [
        dailyRollbackRecord(
          "actionPlacement",
          source.id,
          row.activePlacement
            ? (row.activePlacement as unknown as Record<string, unknown>)
            : null,
        ),
        dailyRollbackRecord("actionPlacement", target.id, null),
      ],
      deferSync: true,
      sequence: true,
    });
    await Promise.all([
      projectDate(visibleDateKey),
      projectDate(targetDateKey),
    ]);
    await settleOnlineActionSave([visibleDateKey, targetDateKey]);
  }

  if (import.meta.client && !listenersInstalled) {
    listenersInstalled = true;
    const dailyEntities = new Set([
      "dailyNote",
      "actionItem",
      "actionOccurrence",
      "actionPlacement",
    ]);
    const refreshVisibleDates = async (fetchServer: boolean) => {
      const dates = Object.keys(projections.value);
      await Promise.all(dates.map((dateKey) => projectDate(dateKey)));
      if (fetchServer && offline.isVerifiedOnline.value) {
        await offline.sync();
        await Promise.all(
          dates.map((dateKey) =>
            refreshFromServer(dateKey).catch(() => undefined),
          ),
        );
      }
      window.dispatchEvent(new CustomEvent("daily-local-state-changed"));
    };
    const refreshAfterLifecycleChange = () => {
      if (Date.now() - lastLifecycleRefreshAt < 1_000) return;
      lastLifecycleRefreshAt = Date.now();
      void refreshVisibleDates(true);
    };
    watch(
      () => offline.isVerifiedOnline.value,
      (online, wasOnline) => {
        if (online && !wasOnline) refreshAfterLifecycleChange();
      },
    );
    window.addEventListener("focus", refreshAfterLifecycleChange);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshAfterLifecycleChange();
    });

    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("clever-daily-local-state")
        : null;
    const publishDailyChange = (event: Event) => {
      const detail = (event as CustomEvent<{ entity?: string }>).detail;
      if (!detail?.entity || !dailyEntities.has(detail.entity)) return;
      channel?.postMessage({ accountId: accountId.value });
      void refreshVisibleDates(false);
    };
    window.addEventListener("offline-v2-mutation-queued", publishDailyChange);
    window.addEventListener("offline-v2-sync-result", publishDailyChange);
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ accountId?: string }>) => {
        if (event.data?.accountId !== accountId.value) return;
        void refreshVisibleDates(offline.isVerifiedOnline.value);
      };
    }
  }

  return {
    accountId,
    projections,
    loadingDates,
    error,
    isSyncing: offline.isSyncing,
    loadDay,
    prefetchAdjacentDays,
    createAction,
    updateAction,
    saveNote,
    getNoteConflict,
    getNoteSyncIssue,
    resolveNoteConflict,
    getActionConflicts,
    getOccurrenceConflicts,
    resolveActionConflict,
    resolveOccurrenceConflict,
    setCompleted,
    reschedule,
    sync: offline.sync,
  };
}
