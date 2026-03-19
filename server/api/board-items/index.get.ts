import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { BoardItemSchema } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const items = await prisma.boardItem.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });

  if (process.env.NODE_ENV === "development") {
    items.forEach((item) => BoardItemSchema.parse(item));
  }

  return success(items, { count: items.length });
});
