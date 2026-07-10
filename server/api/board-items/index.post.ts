import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CreateBoardItemDTO, BoardItemSchema } from "~/shared/utils/boardItem.contract";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { positionBetween } from "@@/shared/utils/position-key";

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
  const lastPositioned = await prisma.boardItem.findFirst({ where: { userId: user.id, columnId: data.columnId || null }, orderBy: { position: "desc" }, select: { position: true } });

  const item = await prisma.boardItem.create({
    data: {
      userId: user.id,
      content: data.content,
      tags: data.tags || [],
      order: nextOrder,
      position: positionBetween(lastPositioned?.position, null),
      columnId: data.columnId || null,
      workspaceId: data.workspaceId || null,
      dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
      attachments: data.attachments || [],
    },
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardItem", entityId: item.id, changedFields: ["content", "tags", "columnId", "workspaceId", "dueDate", "attachments", "position"] });

  if (process.env.NODE_ENV === "development") {
    BoardItemSchema.parse(item);
  }

  return success(item, {
    message: "Board item created successfully",
    itemId: item.id,
  });
});
