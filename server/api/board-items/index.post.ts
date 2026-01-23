import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CreateBoardItemDTO, BoardItemSchema } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let data;
  try {
    data = CreateBoardItemDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const maxOrderItem = await prisma.boardItem.findFirst({
    where: { userId: user.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const nextOrder = maxOrderItem ? maxOrderItem.order + 1 : 0;

  const item = await prisma.boardItem.create({
    data: {
      userId: user.id,
      content: data.content,
      tags: data.tags || [],
      order: nextOrder,
      columnId: data.columnId || null,
    },
  });

  if (process.env.NODE_ENV === "development") {
    BoardItemSchema.parse(item);
  }

  return success(item, {
    message: "Board item created successfully",
    itemId: item.id,
  });
});
