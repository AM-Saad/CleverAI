import type { UserTag } from "@prisma/client";
// server/api/user/tags/index.get.ts
import { requireRole } from "~~/server/utils/auth";
import { UserTagSchema } from "~/shared/utils/user-tag.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;
  const prisma = event.context.prisma;

  try {
    const tags: UserTag[] = await prisma.userTag.findMany({
      where: { userId },
      orderBy: { position: "asc" },
    });

    return {
      success: true,
      data: tags.map((tag: UserTag) =>
        UserTagSchema.parse({
          ...tag,
          createdAt: tag.createdAt.toISOString(),
          updatedAt: tag.updatedAt.toISOString(),
        })
      ),
    };
  } catch (error: any) {
    console.error("[GET /api/user/tags] Error fetching tags:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch tags",
    });
  }
});
