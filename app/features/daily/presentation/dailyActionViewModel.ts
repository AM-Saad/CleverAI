import type { DayItemDTO } from "@shared/utils/daily.contract";
import { formatDateKey } from "@shared/utils/daily-recurrence";

export interface DailyActionViewModel {
  occurrenceKey: string;
  title: string;
  completed: boolean;
  timingLabel: string;
  recurrenceLabel: string | null;
  overdue: boolean;
  movedDateLabel: string | null;
}

function activePlacement(item: DayItemDTO, dateKey: string) {
  return item.activePlacement?.dateKey === dateKey
    ? item.activePlacement
    : null;
}

function timingLabel(item: DayItemDTO, dateKey: string) {
  const placement = activePlacement(item, dateKey);
  const mode = placement?.timingMode ?? item.actionItem.timingMode;
  if (mode === "ALL_DAY") return "All day";
  return placement?.localTime ?? item.actionItem.localTime ?? "Timed";
}

function overdue(item: DayItemDTO, dateKey: string, today: string, now: Date) {
  if (item.occurrence?.status === "COMPLETED") return false;
  if (dateKey < today) return true;
  if (dateKey > today) return false;
  const placement = activePlacement(item, dateKey);
  const mode = placement?.timingMode ?? item.actionItem.timingMode;
  if (mode === "ALL_DAY") return false;
  const localTime = placement?.localTime ?? item.actionItem.localTime;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return Boolean(localTime && localTime < currentTime);
}

export function toDailyActionViewModel(
  item: DayItemDTO,
  dateKey: string,
  today: string,
  now = new Date(),
): DailyActionViewModel {
  const frequency = item.actionItem.recurrence?.frequency ?? "";
  const movedDate = item.activePlacement?.dateKey;
  return {
    occurrenceKey: item.occurrenceKey,
    title: item.actionItem.title,
    completed: item.occurrence?.status === "COMPLETED",
    timingLabel: timingLabel(item, dateKey),
    recurrenceLabel: frequency
      ? frequency.charAt(0) + frequency.slice(1).toLowerCase()
      : null,
    overdue: overdue(item, dateKey, today, now),
    movedDateLabel: movedDate
      ? formatDateKey(movedDate, undefined, { month: "short", day: "numeric" })
      : null,
  };
}
