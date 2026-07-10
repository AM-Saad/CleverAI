import type { BoardItem } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderBoardItemsDTO, BoardItemSchema } from "@@/shared/utils/boardItem.contract";
import { persistBoardItemOrders } from "@server/modules/board/application/persistBoardItemOrders";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { rebalancePositionKeys } from "@server/modules/offline/application/rebalancePositionKeys";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data: ReorderBoardItemsDTO;
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
    const itemIds = data.itemOrders.map((item: { id: string }) => item.id);
    const items = await prisma.boardItem.findMany({
      where: {
        id: { in: itemIds },
        userId: user.id,
      },
    });

    if (items.length !== itemIds.length) {
      throw Errors.badRequest("Some board items do not belong to this user");
    }

    // Reorder is idempotent and frequently retried/coalesced by the client.
    // Avoid interactive Prisma transactions here because rapid Mongo writes can
    // surface as "Transaction already closed" and mask otherwise valid orders.
    await persistBoardItemOrders({
      prisma,
      userId: user.id,
      itemOrders: data.itemOrders,
      missingItemError: () =>
        Errors.badRequest("Some board items do not belong to this user"),
    });
    await rebalancePositionKeys({ prisma, model: "boardItem", ids: data.itemOrders.slice().sort((left, right) => left.order - right.order).map((item) => item.id) });
    await Promise.all(data.itemOrders.map((item: { id: string }) => advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardItem", entityId: item.id, changedFields: ["position"] })));

    // Fetch updated items for verification
    const updatedItems: BoardItem[] = await prisma.boardItem.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });

    if (process.env.NODE_ENV === "development") {
      updatedItems.forEach((item: BoardItem) => BoardItemSchema.parse(item));
    }

    return success(updatedItems, {
      message: "Board items reordered successfully",
      count: updatedItems.length,
    });
  } catch (error: any) {
    console.error("💥 [API /board-items/reorder] Unhandled error:", error);
    console.error("Stack trace:", error.stack);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to reorder board items: ${error.message || "Unknown error"}`
    );
  }
});
