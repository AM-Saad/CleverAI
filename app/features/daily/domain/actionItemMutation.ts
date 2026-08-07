import type {
  ActionItemDTO,
  RecurrenceRuleDTO,
  UpdateActionItemDTO,
} from "@shared/utils/daily.contract";
// Relative, not the `@shared` alias: this is a runtime import, and the unit
// runner resolves these files without Nuxt's alias map (the type-only imports
// above are erased, so they can keep the alias). Matches projectLocalDay.ts.
import {
  parseDateKey,
  weekdayForDateKey,
} from "../../../../shared/utils/daily-recurrence";

export type RecurrenceFrequency = RecurrenceRuleDTO["frequency"];
export type RecurrenceChoice = RecurrenceFrequency | "NONE";

/** Turn a picked frequency into a full rule.
 *
 * Shared by every editor that offers the repeat dropdown — the weekday/monthDay/
 * month derivation is subtle enough that a second copy would drift. An unchanged
 * frequency returns the item's existing rule untouched, so re-saving an item
 * never rewrites fields the user didn't touch (and never marks them changed). */
export function buildRecurrenceRule({
  frequency,
  startDate,
  existing = null,
}: {
  frequency: RecurrenceChoice;
  startDate: string;
  existing?: RecurrenceRuleDTO | null;
}): RecurrenceRuleDTO | null {
  if (frequency === "NONE") return null;
  if (existing && existing.frequency === frequency) return existing;

  const date = parseDateKey(startDate)!;
  return {
    frequency,
    interval: 1,
    weekdays:
      frequency === "WEEKLY" ? [weekdayForDateKey(startDate)] : undefined,
    monthDay: ["MONTHLY", "YEARLY"].includes(frequency)
      ? date.getUTCDate()
      : undefined,
    month: frequency === "YEARLY" ? date.getUTCMonth() + 1 : undefined,
    missingDayPolicy: "LAST_DAY",
    ends: "NEVER",
  };
}

export const ACTION_ITEM_CREATE_FIELDS = [
  "title",
  "description",
  "timingMode",
  "startDate",
  "localTime",
  "timezone",
  "recurrence",
] as const;

const ACTION_ITEM_EDITABLE_FIELDS = [
  "title",
  "timingMode",
  "localTime",
  "timezone",
  "recurrence",
] as const;

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function buildActionItemUpdateMutation(
  current: ActionItemDTO,
  next: ActionItemDTO,
  placementId?: string,
): {
  payload: UpdateActionItemDTO;
  changedFields: string[];
  placementChanged: boolean;
} {
  const changedFields = ACTION_ITEM_EDITABLE_FIELDS.filter(
    (field) => !sameValue(current[field], next[field]),
  );
  const payload: UpdateActionItemDTO = {};
  if (changedFields.includes("title")) payload.title = next.title;
  if (changedFields.includes("timingMode"))
    payload.timingMode = next.timingMode;
  if (changedFields.includes("localTime")) payload.localTime = next.localTime;
  if (changedFields.includes("timezone")) payload.timezone = next.timezone;
  if (changedFields.includes("recurrence"))
    payload.recurrence = next.recurrence;

  const placementChanged = changedFields.some((field) =>
    ["timingMode", "localTime", "timezone"].includes(field),
  );
  if (placementChanged && placementId) payload.placementId = placementId;
  return { payload, changedFields: [...changedFields], placementChanged };
}
