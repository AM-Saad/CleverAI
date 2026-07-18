import type { BoardItem } from "../../../../shared/utils/boardItem.contract";

export const BOARD_ITEM_MUTABLE_FIELDS = [
  "workspaceId",
  "columnId",
  "content",
  "tags",
  "dueDate",
  "attachments",
  "order",
  "position",
] as const;
export type BoardItemMutableField = (typeof BOARD_ITEM_MUTABLE_FIELDS)[number];

export const comparableBoardItemValue = (
  field: BoardItemMutableField,
  value: unknown,
) => {
  if (field === "dueDate")
    return value ? new Date(value as string | number | Date).toISOString() : null;
  if (field === "tags" || field === "attachments")
    return JSON.stringify(value ?? []);
  if (field === "workspaceId" || field === "columnId") return value ?? null;
  return value;
};

export function changedBoardItemFields(
  previous: BoardItem,
  next: BoardItem,
): BoardItemMutableField[] {
  return BOARD_ITEM_MUTABLE_FIELDS.filter(
    (field) =>
      comparableBoardItemValue(field, previous[field]) !==
      comparableBoardItemValue(field, next[field]),
  );
}

export function boardItemPayloadForFields(
  item: BoardItem,
  fields: readonly BoardItemMutableField[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "dueDate") {
      payload.dueDate = item.dueDate
        ? new Date(item.dueDate as string | Date).toISOString()
        : null;
    } else if (field === "workspaceId") {
      payload.workspaceId = item.workspaceId ?? null;
    } else if (field === "columnId") {
      payload.columnId = item.columnId ?? null;
    } else {
      payload[field] = item[field];
    }
  }
  return payload;
}
