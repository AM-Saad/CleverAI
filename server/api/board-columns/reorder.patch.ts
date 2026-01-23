import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  ReorderBoardColumnsDTO,
  BoardColumnSchema,
} from "@@/shared/utils/boardColumn.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data;
    try {
      data = ReorderBoardColumnsDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // Verify all columns belong to user
    const columnIds = data.columnOrders.map((c) => c.id);
    const columns = await prisma.boardColumn.findMany({
      where: {
        id: { in: columnIds },
        userId: user.id,
      },
      select: { id: true }, // Only fetch IDs for verification
    });

    if (columns.length !== columnIds.length) {
      throw Errors.badRequest("Some board columns do not belong to this user");
    }

    // Update all column orders in parallel within a transaction
    const updatePromises = data.columnOrders.map((columnOrder) =>
      prisma.boardColumn.update({
        where: { id: columnOrder.id },
        data: { order: columnOrder.order },
        select: { id: true, order: true }, // Minimal data return
      })
    );

    await prisma.$transaction(updatePromises);

    // Return minimal success response - client already has the data
    if (process.env.NODE_ENV === "development") {
      const updatedColumns = await prisma.boardColumn.findMany({
        where: { userId: user.id },
        orderBy: { order: "asc" },
      });
      updatedColumns.forEach((c) => BoardColumnSchema.parse(c));
      return success(updatedColumns, {
        message: "Board columns reordered successfully",
        count: updatedColumns.length,
      });
    }

    // In production, return order data without re-fetching
    return success(
      data.columnOrders.map((co) => ({ id: co.id, order: co.order })),
      {
        message: "Board columns reordered successfully",
        count: data.columnOrders.length,
      }
    );
  } catch (error: any) {
    console.error("💥 [API /board-columns/reorder] PATCH error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to reorder board columns: ${error.message || "Unknown error"}`
    );
  }
});
