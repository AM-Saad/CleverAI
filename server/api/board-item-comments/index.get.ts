import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const { itemId } = getQuery(event) as { itemId?: string };

  if (!itemId || typeof itemId !== "string") {
    throw Errors.badRequest("itemId query parameter is required");
  }

  // Verify item belongs to user (or is in a user's workspace — basic auth check)
  const item = await prisma.boardItem.findFirst({
    where: { id: itemId, userId: user.id },
    select: { id: true },
  });

  if (!item) throw Errors.notFound("Board item");

  try {
    const comments = await prisma.boardItemComment.findMany({
      where: { itemId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const shaped = comments.map((c) => ({
      id: c.id,
      itemId: c.itemId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: { name: c.user.name, email: c.user.email ?? undefined },
    }));

    return success(shaped, { count: shaped.length });
  } catch (error) {
    console.error("Failed to fetch board item comments:", error);
    throw Errors.server("Failed to fetch board item comments");
  }
});
