import type { PrismaClient } from "@prisma/client";

export async function offlineVersions(
  prisma: PrismaClient,
  userId: string,
  entity: "actionItem" | "actionOccurrence",
  entityIds: readonly string[],
): Promise<Map<string, number>> {
  if (!entityIds.length) return new Map();
  const states = await prisma.offlineEntityState.findMany({
    where: {
      userId,
      entity,
      entityId: { in: [...new Set(entityIds)] },
    },
    select: { entityId: true, version: true },
  });
  return new Map(states.map((state) => [state.entityId, state.version]));
}

export async function actionItemOfflineVersions(
  prisma: PrismaClient,
  userId: string,
  actionItemIds: readonly string[],
): Promise<Map<string, number>> {
  return offlineVersions(prisma, userId, "actionItem", actionItemIds);
}
