import type { Prisma } from "@prisma/client";
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
    type CommentRow = Prisma.BoardItemCommentGetPayload<{
      include: {
        user: { select: { id: true; name: true; email: true } };
      };
    }>;

    const comments: CommentRow[] = await prisma.boardItemComment.findMany({
      where: { itemId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const states = comments.length
      ? await prisma.offlineEntityState.findMany({
          where: {
            userId: user.id,
            entity: "boardComment",
            entityId: { in: comments.map((comment) => comment.id) },
          },
          select: { entityId: true, version: true },
        })
      : [];
    const revisions = new Map(
      states.map((state: { entityId: string; version: number }) => [
        state.entityId,
        state.version,
      ]),
    );
    const shaped = comments.map((comment: CommentRow) => ({
      id: comment.id,
      itemId: comment.itemId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      offlineRevision: revisions.get(comment.id) ?? 0,
      author: { name: comment.user.name, email: comment.user.email ?? undefined },
    }));

    return success(shaped, { count: shaped.length });
  } catch (error) {
    console.error("Failed to fetch board item comments:", error);
    throw Errors.server("Failed to fetch board item comments");
  }
});
