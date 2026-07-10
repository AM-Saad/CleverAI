import type { BoardItem } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderItemsInColumnDTO } from "@@/shared/utils/boardColumn.contract";
import { BoardItemSchema } from "@@/shared/utils/boardItem.contract";
import { persistBoardItemOrders } from "@server/modules/board/application/persistBoardItemOrders";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { rebalancePositionKeys } from "@server/modules/offline/application/rebalancePositionKeys";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data: ReorderItemsInColumnDTO;
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
    const itemIds = data.itemOrders.map((item: { id: string }) => item.id);
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

    // Reorder requests arrive in rapid bursts while dragging. Prisma's
    // interactive transactions are fragile with concurrent Mongo writes here
    // ("Transaction already closed"), so persist the idempotent rank updates in
    // a deterministic sequence with retryable transient-write handling.
    await persistBoardItemOrders({
      prisma,
      userId: user.id,
      itemOrders: data.itemOrders,
      missingItemError: () =>
        Errors.badRequest(
          "Some board items do not belong to this user or were not found"
        ),
    });
    await rebalancePositionKeys({ prisma, model: "boardItem", ids: data.itemOrders.slice().sort((left, right) => left.order - right.order).map((item) => item.id) });
    await Promise.all(data.itemOrders.map((item: { id: string }) => advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardItem", entityId: item.id, changedFields: ["position"] })));

    // Return minimal success response - client already has the data
    // Only fetch if truly needed for verification in development
    if (process.env.NODE_ENV === "development") {
      const updatedItems: BoardItem[] = await prisma.boardItem.findMany({
        where: {
          userId: user.id,
          columnId: data.columnId,
        },
        orderBy: { position: "asc" },
      });
      updatedItems.forEach((item: BoardItem) => BoardItemSchema.parse(item));
      return success(updatedItems, {
        message: "Board items reordered successfully",
        count: updatedItems.length,
      });
    }

    // In production, return the order data without re-fetching
    return success(
      data.itemOrders.map((itemOrder) => ({
        id: itemOrder.id,
        order: itemOrder.order,
      })),
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
