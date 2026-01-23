import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

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

    // Move items in this column to uncategorized (null columnId)
    await prisma.boardItem.updateMany({
      where: { columnId: columnId, userId: user.id },
      data: { columnId: null },
    });

    // Delete the column
    await prisma.boardColumn.delete({
      where: { id: columnId },
    });

    return success(null, { message: "Board column deleted successfully" });
  } catch (error: any) {
    console.error("💥 [API /board-columns/:id] DELETE error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to delete board column: ${error.message || "Unknown error"}`
    );
  }
});
