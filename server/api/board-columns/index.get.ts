import type { BoardColumn } from "@prisma/client";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { BoardColumnSchema } from "@@/shared/utils/boardColumn.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const workspaceId = getQuery(event).workspaceId as string;

  const query: { userId: string; workspaceId?: string } = { userId: user.id };
  if (workspaceId) {
    query.workspaceId = workspaceId;
  }
  try {

    const columns: BoardColumn[] = await prisma.boardColumn.findMany({
      where: query,
      orderBy: { position: "asc" },
    });
    const revisionRows = columns.length
      ? await prisma.offlineEntityState.findMany({
          where: { userId: user.id, entity: "boardColumn", entityId: { in: columns.map((column) => column.id) } },
          select: { entityId: true, version: true },
        })
      : [];
    const revisions = new Map(revisionRows.map((row: { entityId: string; version: number }) => [row.entityId, row.version]));
    const responseColumns = columns.map((column) => ({
      ...column,
      position: column.position ?? undefined,
      offlineRevision: revisions.get(column.id) ?? 0,
    }));

    if (process.env.NODE_ENV === "development") {
      responseColumns.forEach((column) => BoardColumnSchema.parse(column));
    }

    return success(responseColumns, { count: responseColumns.length });
  } catch (error) {
    console.error("Failed to fetch board columns:", error);
    return Errors.server("Failed to fetch board columns");
  }
});
