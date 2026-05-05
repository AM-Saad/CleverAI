import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { MoveItemToColumnDTO } from "@@/shared/utils/boardColumn.contract";
import { BoardItemSchema } from "@@/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data: ReturnType<typeof MoveItemToColumnDTO.parse>;
    try {
      data = MoveItemToColumnDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // Verify item belongs to user
    const existingItem = await prisma.boardItem.findFirst({
      where: { id: data.itemId, userId: user.id },
    });

    if (!existingItem) {
      throw Errors.notFound("Board item not found");
    }

    // If targetColumnId is provided, verify it belongs to user
    if (data.targetColumnId) {
      const targetColumn = await prisma.boardColumn.findFirst({
        where: { id: data.targetColumnId, userId: user.id },
      });

      if (!targetColumn) {
        throw Errors.notFound("Target column not found");
      }
    }

    const currentItem = existingItem;
    const sourceColumnId = currentItem.columnId ?? null;
    const targetColumnId = data.targetColumnId ?? null;

    const sourceItems = await prisma.boardItem.findMany({
      where: {
        userId: user.id,
        columnId: sourceColumnId,
        id: { not: data.itemId },
      },
      orderBy: { order: "asc" },
    });

    const targetItems =
      sourceColumnId === targetColumnId
        ? sourceItems
        : await prisma.boardItem.findMany({
          where: {
            userId: user.id,
            columnId: targetColumnId,
            id: { not: data.itemId },
          },
          orderBy: { order: "asc" },
        });

    const insertIndex = Math.min(
      Math.max(data.newOrder, 0),
      targetItems.length,
    );

    const operations = [];

    if (sourceColumnId === targetColumnId) {
      const reorderedItems = [...sourceItems];
      reorderedItems.splice(insertIndex, 0, currentItem);

      operations.push(
        ...reorderedItems.map((item: { id: string }, index: number) =>
          prisma.boardItem.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );
    } else {
      operations.push(
        ...sourceItems.map((item: { id: string }, index: number) =>
          prisma.boardItem.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );

      const normalizedTargetItems = [...targetItems];
      normalizedTargetItems.splice(insertIndex, 0, currentItem);

      operations.push(
        ...normalizedTargetItems.map((item: { id: string }, index: number) =>
          prisma.boardItem.update({
            where: { id: item.id },
            data: {
              columnId: targetColumnId,
              order: index,
            },
          }),
        ),
      );
    }

    operations.push(
      prisma.boardItem.findUniqueOrThrow({
        where: { id: data.itemId },
      }),
    );

    const transactionResults = await prisma.$transaction(operations);
    const updatedItem = transactionResults[transactionResults.length - 1];

    if (process.env.NODE_ENV === "development") {
      BoardItemSchema.parse(updatedItem);
    }

    return success(updatedItem, { message: "Board item moved successfully" });
  } catch (error: any) {
    console.error("💥 [API /board-items/move] PATCH error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to move board item: ${error.message || "Unknown error"}`
    );
  }
});
