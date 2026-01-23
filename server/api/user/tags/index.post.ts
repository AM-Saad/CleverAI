// server/api/user/tags/index.post.ts
import { requireRole } from "~~/server/utils/auth";
import { CreateUserTagDTO, UserTagSchema } from "~/shared/utils/user-tag.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;
  const prisma = event.context.prisma;

  try {
    const body = await readBody(event);
    const dto = CreateUserTagDTO.parse(body);

    // Check for duplicate tag name (case-insensitive)
    const existing = await prisma.userTag.findFirst({
      where: {
        userId,
        name: {
          equals: dto.name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw createError({
        statusCode: 409,
        message: "Tag with this name already exists",
      });
    }

    // Get the max order to append at the end
    const maxOrderTag = await prisma.userTag.findFirst({
      where: { userId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = (maxOrderTag?.order ?? -1) + 1;

    const tag = await prisma.userTag.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color,
        order: newOrder,
      },
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
    console.error("[POST /api/user/tags] Error creating tag:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create tag",
    });
  }
});
