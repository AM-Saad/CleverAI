import { advanceOfflineEntityState } from "./advanceOfflineEntityState";

type ProjectionItem = {
  entity: "languageWord" | "languageReview";
  entityId: string;
  version: number;
  canonical: Record<string, unknown>;
};

const json = (value: unknown): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      entry instanceof Date ? entry.toISOString() : entry,
    ),
  ) as Record<string, unknown>;

/**
 * Advances the online/offline shared revision and returns the exact local
 * projection the client may commit after the online command succeeds.
 */
export async function projectLanguageOfflineState(input: {
  prisma: any;
  userId: string;
  word?: { id: string; changedFields: string[]; deleted?: boolean };
  review?: { id: string; changedFields: string[]; deleted?: boolean };
}): Promise<ProjectionItem[]> {
  const projection: ProjectionItem[] = [];

  if (input.word) {
    const version = await advanceOfflineEntityState({
      prisma: input.prisma,
      userId: input.userId,
      entity: "languageWord",
      entityId: input.word.id,
      changedFields: input.word.changedFields,
      deleted: input.word.deleted,
    });
    const canonical = input.word.deleted
      ? { id: input.word.id, deleted: true }
      : json(
          await input.prisma.languageWord.findFirst({
            where: { id: input.word.id, userId: input.userId },
            include: { stories: true },
          }),
        );
    projection.push({
      entity: "languageWord",
      entityId: input.word.id,
      version,
      canonical,
    });
  }

  if (input.review) {
    const version = await advanceOfflineEntityState({
      prisma: input.prisma,
      userId: input.userId,
      entity: "languageReview",
      entityId: input.review.id,
      changedFields: input.review.changedFields,
      deleted: input.review.deleted,
    });
    const canonical = input.review.deleted
      ? { id: input.review.id, deleted: true }
      : json(
          await input.prisma.languageCardReview.findFirst({
            where: { id: input.review.id, userId: input.userId },
          }),
        );
    projection.push({
      entity: "languageReview",
      entityId: input.review.id,
      version,
      canonical,
    });
  }

  return projection;
}
