import {
  BoardItemsSyncResponseSchema,
  type BoardItemsSyncRequest,
} from "../../../../shared/utils/boardItem.contract";
import { advanceOfflineEntityState } from "../../offline/application/advanceOfflineEntityState";

export async function syncBoardItems(input: {
  prisma: any;
  userId: string;
  request: BoardItemsSyncRequest;
}) {
  const { prisma, request, userId } = input;
  const applied: string[] = [];
  const conflicts: Array<{ id: string }> = [];
  const idMap: Record<string, string> = {};
  const results: Array<{
    id: string;
    status: "created" | "updated" | "deleted" | "conflict" | "error";
    data?: unknown;
    error?: string;
  }> = [];

  for (const item of request) {
    try {
      if (item.operation === "delete") {
        if (item.id.startsWith("temp-")) {
          applied.push(item.id);
          results.push({ id: item.id, status: "deleted" });
          continue;
        }

        const existing = await prisma.boardItem.findFirst({
          where: { id: item.id, userId },
        });
        if (!existing) {
          applied.push(item.id);
          results.push({ id: item.id, status: "deleted" });
          continue;
        }

        if (existing.updatedAt.getTime() > new Date(item.updatedAt).getTime()) {
          conflicts.push({ id: item.id });
          results.push({ id: item.id, status: "conflict" });
          continue;
        }

        await prisma.boardItem.delete({ where: { id: item.id } });
        await advanceOfflineEntityState({ prisma, userId, entity: "boardItem", entityId: item.id, changedFields: ["deleted"], deleted: true });
        applied.push(item.id);
        results.push({ id: item.id, status: "deleted" });
        continue;
      }

      if (item.workspaceId) {
        const workspace = await prisma.workspace.findFirst({
          where: { id: item.workspaceId, userId },
          select: { id: true },
        });
        if (!workspace) {
          conflicts.push({ id: item.id });
          results.push({ id: item.id, status: "conflict" });
          continue;
        }
      }

      const isTempId = item.id.startsWith("temp-");
      const existing = await prisma.boardItem.findFirst({
        where: {
          id: isTempId ? "__temp_never_matches__" : item.id,
          userId,
        },
      });

      if (existing) {
        if (existing.updatedAt.getTime() > new Date(item.updatedAt).getTime()) {
          conflicts.push({ id: item.id });
          results.push({ id: item.id, status: "conflict" });
          continue;
        }

        const updated = await prisma.boardItem.update({
          where: { id: item.id },
          data: {
            content: item.content,
            tags: item.tags,
            order: item.order,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            attachments: item.attachments ?? [],
            updatedAt: new Date(item.updatedAt),
          },
        });
        await advanceOfflineEntityState({ prisma, userId, entity: "boardItem", entityId: updated.id, changedFields: ["content", "tags", "columnId", "dueDate", "attachments", "position"] });
        applied.push(item.id);
        results.push({ id: item.id, status: "updated", data: updated });
        continue;
      }

      const created = await prisma.boardItem.create({
        data: {
          ...(isTempId ? {} : { id: item.id }),
          userId,
          columnId: item.columnId ?? null,
          workspaceId: item.workspaceId ?? null,
          content: item.content,
          tags: item.tags || [],
          order: item.order || 0,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          attachments: item.attachments ?? [],
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
      });
      await advanceOfflineEntityState({ prisma, userId, entity: "boardItem", entityId: created.id, changedFields: ["content", "tags", "columnId", "workspaceId", "dueDate", "attachments", "position"] });
      applied.push(item.id);
      if (isTempId) idMap[item.id] = created.id;
      results.push({ id: item.id, status: "created", data: created });
    } catch (error: any) {
      console.error(`Failed to sync board item ${item.id}:`, error);
      conflicts.push({ id: item.id });
      results.push({
        id: item.id,
        status: "error",
        error: error.message || "Unknown error",
      });
    }
  }

  return BoardItemsSyncResponseSchema.parse({
    applied,
    conflicts,
    idMap,
    results,
  });
}
