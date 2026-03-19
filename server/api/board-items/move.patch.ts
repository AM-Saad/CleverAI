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

    let data;
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

    // Update the item's column and order
    const updatedItem = await prisma.boardItem.update({
      where: { id: data.itemId },
      data: {
        columnId: data.targetColumnId,
        order: data.newOrder,
      },
    });

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
