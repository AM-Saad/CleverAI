import type { BoardItem } from "@prisma/client";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { BoardItemSchema } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const workspaceId = getQuery(event).workspaceId as string;

  const query: { userId: string; workspaceId?: string } = { userId: user.id };
  if (workspaceId) {
    query.workspaceId = workspaceId;
  }

  try {

    const items: BoardItem[] = await prisma.boardItem.findMany({
      where: query,
      orderBy: { position: "asc" },
    });
    const revisionRows = items.length
      ? await prisma.offlineEntityState.findMany({
          where: { userId: user.id, entity: "boardItem", entityId: { in: items.map((item) => item.id) } },
          select: { entityId: true, version: true },
        })
      : [];
    const revisions = new Map(revisionRows.map((row: { entityId: string; version: number }) => [row.entityId, row.version]));
    const responseItems = items.map((item) => ({
      ...item,
      position: item.position ?? undefined,
      offlineRevision: revisions.get(item.id) ?? 0,
    }));

    if (process.env.NODE_ENV === "development") {
      responseItems.forEach((item) => BoardItemSchema.parse(item));
    }

    return success(responseItems, { count: responseItems.length });
  }

  catch (error) {
    console.error("Failed to fetch board items:", error);
    return Errors.server("Failed to fetch board items");
  }
});
