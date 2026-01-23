// server/api/user/tags/[id].patch.ts
import { requireRole } from "~~/server/utils/auth";
import { UpdateUserTagDTO, UserTagSchema } from "~/shared/utils/user-tag.contract";

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
    const body = await readBody(event);
    const dto = UpdateUserTagDTO.parse(body);

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

    // Check for duplicate name if updating name
    if (dto.name) {
      const duplicate = await prisma.userTag.findFirst({
        where: {
          userId,
          name: {
            equals: dto.name,
            mode: "insensitive",
          },
          id: { not: tagId },
        },
      });

      if (duplicate) {
        throw createError({
          statusCode: 409,
          message: "Tag with this name already exists",
        });
      }
    }

    const tag = await prisma.userTag.update({
      where: { id: tagId },
      data: dto,
    });

    return {
      success: true,
      data: UserTagSchema.parse({
        ...tag,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      }),
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[PATCH /api/user/tags/:id] Error updating tag:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update tag",
    });
  }
});
