import type { OfflineEntity } from "@@/shared/utils/offline-sync.contract";

function readFieldVersions(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, version]) => [key, Number(version) || 0]));
}

/**
 * Records a normal online API write in the same revision space as offline-v2.
 * Endpoint handlers call this immediately after their authorized domain write;
 * they must pass the transactional Prisma client when their domain write is in
 * a transaction.
 */
export async function advanceOfflineEntityState(input: {
  prisma: any;
  userId: string;
  entity: OfflineEntity;
  entityId: string;
  changedFields: string[];
  deleted?: boolean;
}): Promise<number> {
  // Keeps legacy test doubles and pre-migration developer databases usable.
  // Production deployment validates the Prisma schema before enabling offlineV2.
  if (!input.prisma.offlineEntityState) return 0;
  const previous = await input.prisma.offlineEntityState.findUnique({
    where: { userId_entity_entityId: { userId: input.userId, entity: input.entity, entityId: input.entityId } },
  });
  const version = (previous?.version ?? 0) + 1;
  const fieldVersions = {
    ...readFieldVersions(previous?.fieldVersions),
    ...Object.fromEntries(input.changedFields.map((field) => [field, version])),
  };
  await input.prisma.offlineEntityState.upsert({
    where: { userId_entity_entityId: { userId: input.userId, entity: input.entity, entityId: input.entityId } },
    update: { version, fieldVersions, deletedAt: input.deleted ? new Date() : null },
    create: { userId: input.userId, entity: input.entity, entityId: input.entityId, version, fieldVersions, deletedAt: input.deleted ? new Date() : null },
  });
  return version;
}
