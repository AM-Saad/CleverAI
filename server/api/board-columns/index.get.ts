import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { BoardColumnSchema } from "@@/shared/utils/boardColumn.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const columns = await prisma.boardColumn.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });

  if (process.env.NODE_ENV === "development") {
    columns.forEach((column) => BoardColumnSchema.parse(column));
  }

  return success(columns, { count: columns.length });
});
