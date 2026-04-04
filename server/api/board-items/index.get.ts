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

    const items = await prisma.boardItem.findMany({
      where: query,
      orderBy: { order: "asc" },
    });

    if (process.env.NODE_ENV === "development") {
      items.forEach((item) => BoardItemSchema.parse(item));
    }

    return success(items, { count: items.length });
  }

  catch (error) {
    console.error("Failed to fetch board items:", error);
    return Errors.server("Failed to fetch board items");
  }
});
