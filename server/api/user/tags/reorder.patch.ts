// server/api/user/tags/reorder.patch.ts
import { requireRole } from "~~/server/utils/auth";
import { ReorderUserTagsDTO } from "~/shared/utils/user-tag.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;
  const prisma = event.context.prisma;

  try {
    const body = await readBody(event);
    const dto = ReorderUserTagsDTO.parse(body);

    // Verify all tags belong to the user
    const tagIds = dto.tagOrders.map((t) => t.id);
    const tags = await prisma.userTag.findMany({
      where: { id: { in: tagIds }, userId },
      select: { id: true },
    });

    if (tags.length !== tagIds.length) {
      throw createError({
        statusCode: 404,
        message: "One or more tags not found",
      });
    }

    // Update orders in a transaction
    await prisma.$transaction(
      dto.tagOrders.map((item) =>
        prisma.userTag.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return {
      success: true,
      message: "Tags reordered successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[PATCH /api/user/tags/reorder] Error reordering tags:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to reorder tags",
    });
  }
});
