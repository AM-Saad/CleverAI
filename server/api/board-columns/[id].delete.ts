import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  DeleteBoardColumnResponseSchema,
} from "@@/shared/utils/boardColumn.contract";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;
    const columnId = getRouterParam(event, "id");

    if (!columnId) {
      throw Errors.badRequest("Column ID is required");
    }

    // Verify column belongs to user
    const existingColumn = await prisma.boardColumn.findFirst({
      where: { id: columnId, userId: user.id },
    });

    if (!existingColumn) {
      throw Errors.notFound("Board column not found");
    }

    const deletedColumn = await prisma.$transaction(async (tx: any) => {
      const sourceItems = await tx.boardItem.findMany({
        where: { columnId, userId: user.id },
        orderBy: { order: "asc" },
      });

      const uncategorizedItems = await tx.boardItem.findMany({
        where: {
          userId: user.id,
          workspaceId: existingColumn.workspaceId ?? null,
          columnId: null,
        },
        orderBy: { order: "asc" },
      });

      const movedItemIds = new Set(sourceItems.map((item: { id: string }) => item.id));
      const normalizedUncategorizedItems = [...uncategorizedItems, ...sourceItems].map(
        (item, index) => ({
          ...item,
          columnId: null,
          order: index,
        }),
      );

      await Promise.all(
        normalizedUncategorizedItems.map((item) =>
          tx.boardItem.update({
            where: { id: item.id },
            data: {
              columnId: null,
              order: item.order,
            },
          }),
        ),
      );

      await tx.boardColumn.delete({
        where: { id: columnId },
      });

      return {
        deletedColumnId: columnId,
        movedItems: normalizedUncategorizedItems.filter((item) =>
          movedItemIds.has(item.id),
        ),
      };
    });
    await advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardColumn", entityId: columnId, changedFields: ["deleted"], deleted: true });
    await Promise.all(deletedColumn.movedItems.map((item: { id: string }) => advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardItem", entityId: item.id, changedFields: ["columnId", "position"] })));

    if (process.env.NODE_ENV === "development") {
      DeleteBoardColumnResponseSchema.parse(deletedColumn);
    }

    return success(deletedColumn, { message: "Board column deleted successfully" });
  } catch (error: any) {
    console.error("💥 [API /board-columns/:id] DELETE error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to delete board column: ${error.message || "Unknown error"}`
    );
  }
});
