import type { PrismaClient } from "@prisma/client";
import type {
  DayItemDTO,
  DayProjectionDTO,
} from "@shared/utils/daily.contract";
import {
  ActionItemSchema,
  DailyNoteSchema,
  RecurrenceRuleSchema,
} from "@shared/utils/daily.contract";
import {
  occurrenceKey,
  recurrenceMatchesDate,
} from "@shared/utils/daily-recurrence";

export async function projectDailyDay(input: {
  prisma: PrismaClient;
  userId: string;
  dateKey: string;
}): Promise<DayProjectionDTO> {
  const { prisma, userId, dateKey } = input;
  const [note, definitions, touchedOccurrences] = await Promise.all([
    prisma.dailyNote.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    }),
    prisma.actionItem.findMany({
      where: { userId, lifecycle: "ACTIVE", startDate: { lte: dateKey } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionOccurrence.findMany({
      where: {
        userId,
        OR: [
          { originalDateKey: dateKey },
          { placements: { some: { dateKey } } },
        ],
      },
      include: {
        actionItem: true,
        placements: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  const touchedByKey = new Map(
    touchedOccurrences.map((occurrence) => [
      occurrence.occurrenceKey,
      occurrence,
    ]),
  );
  const rows = new Map<string, DayItemDTO>();

  for (const actionItem of definitions) {
    const parsedRule = actionItem.recurrence
      ? RecurrenceRuleSchema.safeParse(actionItem.recurrence)
      : null;
    if (parsedRule && !parsedRule.success) continue;
    if (!recurrenceMatchesDate(actionItem.startDate, parsedRule?.data, dateKey))
      continue;

    const key = occurrenceKey(actionItem.id, dateKey);
    const occurrence = touchedByKey.get(key) ?? null;
    const placements = occurrence?.placements ?? [];
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
      actionItem: ActionItemSchema.parse(actionItem),
      occurrence,
      activePlacement: current,
      historyPlacement: history,
      virtual: !occurrence,
    });
  }

  for (const occurrence of touchedOccurrences) {
    const placements = occurrence.placements;
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
    const belongsToDay = current?.dateKey === dateKey || Boolean(history);
    if (!belongsToDay) continue;

    rows.set(occurrence.occurrenceKey, {
      occurrenceKey: occurrence.occurrenceKey,
      originalDateKey: occurrence.originalDateKey,
      actionItem: ActionItemSchema.parse(occurrence.actionItem),
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
    const leftTime =
      leftPlacement?.localTime ?? left.actionItem.localTime ?? "";
    const rightTime =
      rightPlacement?.localTime ?? right.actionItem.localTime ?? "";
    return (
      leftTime.localeCompare(rightTime) ||
      (leftPlacement?.position ?? "").localeCompare(
        rightPlacement?.position ?? "",
      ) ||
      left.actionItem.title.localeCompare(right.actionItem.title)
    );
  });

  return { dateKey, note: note ? DailyNoteSchema.parse(note) : null, items };
}
