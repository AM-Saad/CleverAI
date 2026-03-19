// server/api/user/tags/[id].delete.ts
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;
  const prisma = event.context.prisma;
  const tagId = getRouterParam(event, "id");

  if (!tagId) {
    throw createError({
      statusCode: 400,
      message: "Tag ID is required",
    });
  }

  try {
    // Verify tag ownership
    const existing = await prisma.userTag.findFirst({
      where: { id: tagId, userId },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Tag not found",
      });
    }

    await prisma.userTag.delete({
      where: { id: tagId },
    });

    return {
      success: true,
      message: "Tag deleted successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[DELETE /api/user/tags/:id] Error deleting tag:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete tag",
    });
  }
});
