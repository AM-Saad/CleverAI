import type {
  ActionItemDTO,
  UpdateActionItemDTO,
} from "@shared/utils/daily.contract";

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
