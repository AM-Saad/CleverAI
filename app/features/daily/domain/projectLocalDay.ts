import type { DailyLocalSnapshot } from "../repositories/dailyLocalRepository";
import type {
  DayItemDTO,
  DayProjectionDTO,
} from "../../../../shared/utils/daily.contract";
import {
  occurrenceKey,
  recurrenceMatchesDate,
} from "../../../../shared/utils/daily-recurrence";

export function projectLocalDay(
  snapshot: DailyLocalSnapshot,
  dateKey: string,
): DayProjectionDTO {
  const occurrenceByKey = new Map(
    snapshot.occurrences.map((occurrence) => [
      occurrence.occurrenceKey,
      occurrence,
    ]),
  );
  const placementsByOccurrence = new Map<string, typeof snapshot.placements>();
  for (const placement of snapshot.placements) {
    const list = placementsByOccurrence.get(placement.occurrenceKey) ?? [];
    list.push(placement);
    placementsByOccurrence.set(placement.occurrenceKey, list);
  }
  const rows = new Map<string, DayItemDTO>();

  for (const actionItem of snapshot.actionItems) {
    if (actionItem.lifecycle !== "ACTIVE") continue;
    if (
      !recurrenceMatchesDate(
        actionItem.startDate,
        actionItem.recurrence,
        dateKey,
      )
    )
      continue;
    const key = occurrenceKey(actionItem.id, dateKey);
    const occurrence = occurrenceByKey.get(key) ?? null;
    const placements = placementsByOccurrence.get(key) ?? [];
    const current = occurrence?.currentPlacementId
      ? (placements.find(
          (placement) => placement.id === occurrence.currentPlacementId,
        ) ?? null)
      : null;
    const history =
      [...placements]
        .reverse()
        .find(
          (placement) =>
            placement.dateKey === dateKey && placement.id !== current?.id,
        ) ?? null;
    rows.set(key, {
      occurrenceKey: key,
      originalDateKey: dateKey,
      actionItem,
      occurrence,
      activePlacement: current,
      historyPlacement: history,
      virtual: !occurrence,
    });
  }

  for (const occurrence of snapshot.occurrences) {
    const actionItem = snapshot.actionItems.find(
      (item) => item.id === occurrence.actionItemId,
    );
    if (!actionItem) continue;
    const placements =
      placementsByOccurrence.get(occurrence.occurrenceKey) ?? [];
    const current = occurrence.currentPlacementId
      ? (placements.find(
          (placement) => placement.id === occurrence.currentPlacementId,
        ) ?? null)
      : null;
    const history =
      [...placements]
        .reverse()
        .find(
          (placement) =>
            placement.dateKey === dateKey && placement.id !== current?.id,
        ) ?? null;
    if (current?.dateKey !== dateKey && !history) continue;
    rows.set(occurrence.occurrenceKey, {
      occurrenceKey: occurrence.occurrenceKey,
      originalDateKey: occurrence.originalDateKey,
      actionItem,
      occurrence,
      activePlacement: current,
      historyPlacement: history,
      virtual: false,
    });
  }

  const items = [...rows.values()].sort((left, right) => {
    const leftPlacement =
      left.activePlacement?.dateKey === dateKey
        ? left.activePlacement
        : left.historyPlacement;
    const rightPlacement =
      right.activePlacement?.dateKey === dateKey
        ? right.activePlacement
        : right.historyPlacement;
    const leftMode = leftPlacement?.timingMode ?? left.actionItem.timingMode;
    const rightMode = rightPlacement?.timingMode ?? right.actionItem.timingMode;
    if (leftMode !== rightMode) return leftMode === "ALL_DAY" ? -1 : 1;
    return (
      (
        leftPlacement?.localTime ??
        left.actionItem.localTime ??
        ""
      ).localeCompare(
        rightPlacement?.localTime ?? right.actionItem.localTime ?? "",
      ) ||
      (leftPlacement?.position ?? "").localeCompare(
        rightPlacement?.position ?? "",
      ) ||
      left.actionItem.title.localeCompare(right.actionItem.title)
    );
  });

  return {
    dateKey,
    note: snapshot.notes.find((note) => note.dateKey === dateKey) ?? null,
    items,
  };
}
