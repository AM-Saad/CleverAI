import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderBoardItemsDTO, BoardItemSchema } from "@@/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data;
    try {
      data = ReorderBoardItemsDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // Verify all items belong to user
    const itemIds = data.itemOrders.map((i) => i.id);
    const items = await prisma.boardItem.findMany({
      where: {
        id: { in: itemIds },
        userId: user.id,
      },
    });

    if (items.length !== itemIds.length) {
      throw Errors.badRequest("Some board items do not belong to this user");
    }

    // Update all item orders in a transaction
    const updatePromises = data.itemOrders.map((itemOrder) =>
      prisma.boardItem.update({
        where: { id: itemOrder.id },
        data: { order: itemOrder.order },
      })
    );

    await prisma.$transaction(updatePromises);

    // Fetch updated items for verification
    const updatedItems = await prisma.boardItem.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
    });

    if (process.env.NODE_ENV === "development") {
      updatedItems.forEach((i) => BoardItemSchema.parse(i));
    }

    return success(updatedItems, {
      message: "Board items reordered successfully",
      count: updatedItems.length,
    });
  } catch (error: any) {
    console.error("💥 [API /board-items/reorder] Unhandled error:", error);
    console.error("Stack trace:", error.stack);
    throw Errors.server(
      `Failed to reorder board items: ${error.message || "Unknown error"}`
    );
  }
});
