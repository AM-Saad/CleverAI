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

    const columns = await prisma.boardColumn.findMany({
      where: query,
      orderBy: { order: "asc" },
    });

    if (process.env.NODE_ENV === "development") {
      columns.forEach((column) => BoardColumnSchema.parse(column));
    }

    return success(columns, { count: columns.length });
  } catch (error) {
    console.error("Failed to fetch board columns:", error);
    return Errors.server("Failed to fetch board columns");
  }
});
