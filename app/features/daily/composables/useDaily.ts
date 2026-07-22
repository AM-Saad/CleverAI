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
import { occurrenceKey } from "@shared/utils/daily-recurrence";
import { placementStateAfterMove } from "@shared/utils/daily-placement";
import { positionBetween } from "@shared/utils/position-key";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { putOfflineEntities } from "~/utils/offline-v2/repository";
import { projectLocalDay } from "../domain/projectLocalDay";
import {
  autoResolveEquivalentNoteConflicts,
  dailyEntityRecord,
  getDailyLocalSnapshot,
  getDailyNoteConflict,
  mergeServerDay,
  mergeServerBootstrap,
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

const ACTION_ITEM_FIELDS = [
  "title",
  "description",
  "timingMode",
  "startDate",
  "localTime",
  "timezone",
  "recurrence",
  "position",
];
const OCCURRENCE_FIELDS = ["status", "completedAt", "currentPlacementId"];

let listenersInstalled = false;
const bootstrappedAccounts = new Set<string>();

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;

const iso = (value: string | Date | undefined = new Date()) =>
  value instanceof Date ? value.toISOString() : value;

export function useDaily() {
  const offline = useOfflineRuntime();
  const projections = useState<Record<string, DayProjectionDTO>>(
    "daily-projections",
    () => ({}),
  );
  const loadingDates = useState<Record<string, boolean>>(
    "daily-loading",
    () => ({}),
  );
  const error = useState<string | null>("daily-error", () => null);

  const accountId = computed(() => offline.accountId.value);

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

  async function refreshFromServer(dateKey: string) {
    if (!accountId.value || !offline.isOnline.value) return;
    await autoResolveEquivalentNoteConflicts(accountId.value);
    const response = await $fetch<ApiSuccess<DayProjectionDTO>>(
      `/api/daily/day/${dateKey}`,
    );
    await mergeServerDay(accountId.value, response.data);
    await projectDate(dateKey);
  }

  async function bootstrap() {
    if (
      !accountId.value ||
      !offline.isOnline.value ||
      bootstrappedAccounts.has(accountId.value)
    )
      return;
    const response = await $fetch<ApiSuccess<DailyBootstrapDTO>>(
      "/api/daily/bootstrap",
    );
    await mergeServerBootstrap(accountId.value, response.data);
    bootstrappedAccounts.add(accountId.value);
  }

  async function loadDay(dateKey: string) {
    if (!accountId.value) return;
    loadingDates.value = { ...loadingDates.value, [dateKey]: true };
    error.value = null;
    try {
      await projectDate(dateKey);
      if (offline.isOnline.value) {
        await offline.sync();
        await bootstrap();
        await refreshFromServer(dateKey);
      }
    } catch (loadError) {
      error.value =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this day";
    } finally {
      loadingDates.value = { ...loadingDates.value, [dateKey]: false };
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
    await putOfflineEntities([
      dailyEntityRecord(accountId.value, "actionOccurrence", occurrence, 1),
      dailyEntityRecord(accountId.value, "actionPlacement", placement),
    ]);
    await offline.queue({
      entity: "actionItem",
      operation: "actionItem.create",
      entityId: itemId,
      changedFields: ACTION_ITEM_FIELDS,
      payload,
      localData: actionItem as unknown as Record<string, unknown>,
      deferSync: true,
    });
    await projectDate(input.dateKey);
    void offline
      .sync()
      .then(() => refreshFromServer(input.dateKey))
      .catch(() => undefined);
  }

  async function saveNote(dateKey: string, content: unknown) {
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
        version: row.occurrence.version + 1,
        updatedAt: now,
      };
      const placement: ActionPlacementDTO = {
        ...row.activePlacement,
        state: "ACTIVE",
        updatedAt: now,
      };
      await putOfflineEntities([
        dailyEntityRecord(accountId.value, "actionPlacement", placement),
      ]);
      await offline.queue({
        entity: "actionOccurrence",
        operation: "occurrence.reopen",
        entityId: occurrence.id,
        baseVersion: row.occurrence.version,
        changedFields: OCCURRENCE_FIELDS,
        payload: { occurrenceKey: row.occurrenceKey },
        localData: occurrence as unknown as Record<string, unknown>,
        deferSync: true,
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
        version: (row.occurrence?.version ?? 1) + 1,
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
      await putOfflineEntities([
        dailyEntityRecord(accountId.value, "actionPlacement", placement),
      ]);
      await offline.queue({
        entity: "actionOccurrence",
        operation: "occurrence.complete",
        entityId: base.occurrenceId,
        baseVersion: row.occurrence?.version ?? 0,
        changedFields: OCCURRENCE_FIELDS,
        payload: { ...base, completedAt: now },
        localData: occurrence as unknown as Record<string, unknown>,
        deferSync: true,
      });
    }
    await projectDate(dateKey);
    void offline
      .sync()
      .then(() => refreshFromServer(dateKey))
      .catch(() => undefined);
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
      version: (row.occurrence?.version ?? 1) + 1,
      createdAt: iso(row.occurrence?.createdAt) ?? now,
      updatedAt: now,
    };
    await putOfflineEntities([
      dailyEntityRecord(accountId.value, "actionPlacement", source),
      dailyEntityRecord(accountId.value, "actionPlacement", target),
    ]);
    await offline.queue({
      entity: "actionOccurrence",
      operation: "occurrence.reschedule",
      entityId: base.occurrenceId,
      baseVersion: row.occurrence?.version ?? 0,
      changedFields: OCCURRENCE_FIELDS,
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
      deferSync: true,
    });
    await Promise.all([
      projectDate(visibleDateKey),
      projectDate(targetDateKey),
    ]);
    void offline
      .sync()
      .then(() => refreshFromServer(visibleDateKey))
      .catch(() => undefined);
  }

  if (import.meta.client && !listenersInstalled) {
    listenersInstalled = true;
    window.addEventListener("online", () => {
      void offline.sync().then(() => {
        for (const dateKey of Object.keys(projections.value))
          void refreshFromServer(dateKey);
      });
    });
  }

  return {
    accountId,
    projections,
    loadingDates,
    error,
    isSyncing: offline.isSyncing,
    loadDay,
    createAction,
    saveNote,
    getNoteConflict,
    resolveNoteConflict,
    setCompleted,
    reschedule,
    sync: offline.sync,
  };
}
