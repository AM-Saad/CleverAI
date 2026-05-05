import type { PendingBoardItemChange } from "~/utils/idb";
import type { BoardItemState } from "./useBoardItemsStore";

const toTimestamp = (value: BoardItemState["updatedAt"] | number | string | undefined): number => {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export function mergePendingBoardItems(
  localItems: BoardItemState[],
  pendingChanges: PendingBoardItemChange[],
): Map<string, BoardItemState> {
  const itemMap = new Map<string, BoardItemState>();
  localItems.forEach((item) => itemMap.set(item.id, item));

  for (const change of pendingChanges) {
    if (change.operation === "delete") {
      itemMap.delete(change.id);
      continue;
    }

    const existing = itemMap.get(change.id);
    if (existing) {
      const existingUpdatedAt = toTimestamp(existing.updatedAt);
      if (existingUpdatedAt > change.updatedAt) {
        continue;
      }

      itemMap.set(change.id, {
        ...existing,
        columnId: change.columnId !== undefined ? change.columnId : existing.columnId,
        content: change.content ?? existing.content,
        tags: change.tags ?? existing.tags,
        order: change.order ?? existing.order,
        dueDate: change.dueDate !== undefined ? change.dueDate : existing.dueDate,
        attachments: change.attachments ?? existing.attachments,
        updatedAt: new Date(change.updatedAt),
        isDirty: true,
      });
      continue;
    }

    if (!change.workspaceId) {
      continue;
    }

    itemMap.set(change.id, {
      id: change.id,
      userId: change.userId ?? "",
      workspaceId: change.workspaceId,
      columnId: change.columnId ?? null,
      content: change.content ?? "",
      tags: change.tags ?? [],
      order: change.order ?? itemMap.size,
      dueDate: change.dueDate ?? null,
      attachments: change.attachments ?? [],
      createdAt: change.createdAt ? new Date(change.createdAt) : new Date(change.updatedAt),
      updatedAt: new Date(change.updatedAt),
      isDirty: true,
      isLoading: false,
      error: null,
    });
  }

  return itemMap;
}
