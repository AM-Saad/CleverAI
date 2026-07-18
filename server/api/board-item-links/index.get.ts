import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const { itemId } = getQuery(event) as { itemId?: string };

  if (!itemId || typeof itemId !== "string") {
    throw Errors.badRequest("itemId query parameter is required");
  }

  // Verify the item belongs to the user
  const item = await prisma.boardItem.findFirst({
    where: { id: itemId, userId: user.id },
    select: { id: true },
  });

  if (!item) {
    throw Errors.notFound("Board item");
  }

  try {
    const [linksSent, linksReceived] = await Promise.all([
      prisma.boardItemLink.findMany({
        where: { sourceId: itemId },
        include: {
          target: { select: { id: true, content: true, columnId: true, tags: true, dueDate: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.boardItemLink.findMany({
        where: { targetId: itemId },
        include: {
          source: { select: { id: true, content: true, columnId: true, tags: true, dueDate: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const linkIds = [...linksSent, ...linksReceived].map((link) => link.id);
    const states = linkIds.length
      ? await prisma.offlineEntityState.findMany({
          where: {
            userId: user.id,
            entity: "boardLink",
            entityId: { in: linkIds },
          },
          select: { entityId: true, version: true },
        })
      : [];
    const revisions = new Map(
      states.map((state) => [state.entityId, state.version]),
    );
    const withRevision = <T extends { id: string }>(link: T) => ({
      ...link,
      offlineRevision: revisions.get(link.id) ?? 0,
    });

    return success({
      sent: linksSent.map(withRevision),
      received: linksReceived.map(withRevision),
    });
  } catch (error) {
    console.error("Failed to fetch board item links:", error);
    throw Errors.server("Failed to fetch board item links");
  }
});
