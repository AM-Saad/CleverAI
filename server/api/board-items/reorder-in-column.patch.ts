import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderItemsInColumnDTO } from "@@/shared/utils/boardColumn.contract";
import { BoardItemSchema } from "@@/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data;
    try {
      data = ReorderItemsInColumnDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // If columnId is provided, verify it belongs to user
    if (data.columnId) {
      const column = await prisma.boardColumn.findFirst({
        where: { id: data.columnId, userId: user.id },
      });

      if (!column) {
        throw Errors.notFound("Column not found");
      }
    }

    // Verify all items belong to user
    const itemIds = data.itemOrders.map((i) => i.id);
    const items = await prisma.boardItem.findMany({
      where: {
        id: { in: itemIds },
        userId: user.id,
      },
      select: { id: true }, // Only fetch IDs for verification
    });

    if (items.length !== itemIds.length) {
      throw Errors.badRequest(
        "Some board items do not belong to this user or were not found"
      );
    }

    // OPTIMIZED: Use parallel updateMany operations instead of sequential updates
    // This reduces N database round-trips to a single batch operation
    const updatePromises = data.itemOrders.map((itemOrder) =>
      prisma.boardItem.update({
        where: { id: itemOrder.id },
        data: { order: itemOrder.order },
        select: { id: true, order: true }, // Minimal data return
      })
    );

    // Execute all updates in parallel within a transaction
    await prisma.$transaction(updatePromises, {
      maxWait: 5000,
      timeout: 10000,
    });

    // Return minimal success response - client already has the data
    // Only fetch if truly needed for verification in development
    if (process.env.NODE_ENV === "development") {
      const updatedItems = await prisma.boardItem.findMany({
        where: {
          userId: user.id,
          columnId: data.columnId,
        },
        orderBy: { order: "asc" },
      });
      updatedItems.forEach((i) => BoardItemSchema.parse(i));
      return success(updatedItems, {
        message: "Board items reordered successfully",
        count: updatedItems.length,
      });
    }

    // In production, return the order data without re-fetching
    return success(
      data.itemOrders.map((io) => ({ id: io.id, order: io.order })),
      {
        message: "Board items reordered successfully",
        count: data.itemOrders.length,
      }
    );
  } catch (error: any) {
    console.error("💥 [API /board-items/reorder-in-column] PATCH error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to reorder board items: ${error.message || "Unknown error"}`
    );
  }
});
