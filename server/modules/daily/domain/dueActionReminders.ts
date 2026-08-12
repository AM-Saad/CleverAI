import type { DayProjectionDTO } from "@shared/utils/daily.contract";

/**
 * Catch-up window: a reminder stays eligible this long after its due minute so
 * a late or skipped cron tick still delivers. Keep it >= the cron interval.
 */
export const ACTION_REMINDER_WINDOW_MINUTES = 10;

export type DueActionReminder = {
  occurrenceKey: string;
  actionItemId: string;
  title: string;
  localTime: string;
  timezone: string | null;
};

function toMinutes(localTime: string): number | null {
  const [hour, minute] = localTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

/**
 * Which timed actions on this day have reached their reminder minute.
 *
 * The projection also carries rows that were moved off the day (their active
 * placement points elsewhere) and rows already closed — both are excluded here.
 */
export function dueActionReminders(input: {
  day: DayProjectionDTO;
  nowMinutes: number;
  leadMinutes: number;
  windowMinutes?: number;
}): DueActionReminder[] {
  const window = input.windowMinutes ?? ACTION_REMINDER_WINDOW_MINUTES;
  const due: DueActionReminder[] = [];

  for (const row of input.day.items) {
    if (row.occurrence && row.occurrence.status !== "OPEN") continue;
    // A placement on another dateKey means the user moved this occurrence away.
    if (
      row.activePlacement &&
      row.activePlacement.dateKey !== input.day.dateKey
    )
      continue;

    const source = row.activePlacement ?? row.actionItem;
    if (source.timingMode !== "TIMED" || !source.localTime) continue;

    const startsAt = toMinutes(source.localTime);
    if (startsAt === null) continue;
    // ponytail: lead time is clamped at midnight instead of spilling into the
    // previous day. Project the previous dateKey too if that becomes a problem.
    const dueAt = Math.max(0, startsAt - input.leadMinutes);
    if (input.nowMinutes < dueAt || input.nowMinutes >= dueAt + window)
      continue;

    due.push({
      occurrenceKey: row.occurrenceKey,
      actionItemId: row.actionItem.id,
      title: row.actionItem.title,
      localTime: source.localTime,
      timezone: source.timezone ?? row.actionItem.timezone ?? null,
    });
  }

  return due;
}
