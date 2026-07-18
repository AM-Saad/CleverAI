import { z } from "zod";
import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

const querySchema = z.object({ workspaceId: z.string().min(1).optional() });
const asJson = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, entry) => entry instanceof Date ? entry.toISOString() : entry));

/**
 * A pack is an authoritative snapshot for local storage, not an HTTP cache.
 * Keeping the aggregate here ensures all entities were authorized using the
 * same account scope before the client marks a workspace available offline.
 */
export default defineEventHandler(async (event) => {
  if (useRuntimeConfig(event).public.offlineV2 === false) {
    throw Errors.notFound("Offline packs are not enabled");
  }
  const user = await requireRole(event, ["USER"]);
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) throw Errors.badRequest("Invalid offline pack query", parsed.error.issues);
  const prisma = event.context.prisma;
  const workspaceWhere = { userId: user.id, ...(parsed.data.workspaceId ? { id: parsed.data.workspaceId } : {}) };
  const workspaces = await prisma.workspace.findMany({ where: workspaceWhere, orderBy: { position: "asc" } });
  if (parsed.data.workspaceId && !workspaces.length) throw Errors.notFound("Workspace");
  const workspaceIds = workspaces.map((workspace: { id: string }) => workspace.id);

  const [notes, noteGroups, materials, flashcards, questions, boardColumns, boardItems, userTags, cardReviews, languageWords, languageReviews, languagePreferences, notificationPreferences] = await Promise.all([
    prisma.note.findMany({ where: { workspaceId: { in: workspaceIds } }, orderBy: { position: "asc" } }),
    prisma.noteGroup.findMany({ where: { workspaceId: { in: workspaceIds } }, orderBy: { position: "asc" } }),
    prisma.material.findMany({ where: { workspaceId: { in: workspaceIds } } }),
    prisma.flashcard.findMany({ where: { workspaceId: { in: workspaceIds } } }),
    prisma.question.findMany({ where: { workspaceId: { in: workspaceIds } } }),
    prisma.boardColumn.findMany({ where: { userId: user.id, ...(workspaceIds.length ? { OR: [{ workspaceId: { in: workspaceIds } }, { workspaceId: null }] } : {}) }, orderBy: { position: "asc" } }),
    prisma.boardItem.findMany({ where: { userId: user.id, ...(workspaceIds.length ? { OR: [{ workspaceId: { in: workspaceIds } }, { workspaceId: null }] } : {}) }, orderBy: { position: "asc" } }),
    prisma.userTag.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
    prisma.cardReview.findMany({ where: { userId: user.id, ...(workspaceIds.length ? { workspaceId: { in: workspaceIds } } : {}) } }),
    prisma.languageWord.findMany({ where: { userId: user.id }, include: { stories: true } }),
    prisma.languageCardReview.findMany({ where: { userId: user.id } }),
    prisma.userLanguagePreferences.findUnique({ where: { userId: user.id } }),
    prisma.userNotificationPreferences.findUnique({ where: { userId: user.id } }),
  ]);
  const boardItemIds = boardItems.map((item: { id: string }) => item.id);
  const [boardComments, boardLinks] = await Promise.all([
    boardItemIds.length ? prisma.boardItemComment.findMany({ where: { itemId: { in: boardItemIds }, userId: user.id } }) : [],
    boardItemIds.length ? prisma.boardItemLink.findMany({ where: { userId: user.id, OR: [{ sourceId: { in: boardItemIds } }, { targetId: { in: boardItemIds } }] } }) : [],
  ]);
  // Revisions are reconciliation revisions, not the individual model's legacy
  // `version` column. The client returns them unchanged as baseVersion.
  const states = await prisma.offlineEntityState.findMany({ where: { userId: user.id } });
  const revisions = new Map(states.map((state: { entity: string; entityId: string; version: number }) => [`${state.entity}:${state.entityId}`, state.version]));
  const withRevision = <T extends { id: string }>(entity: string, record: T) => ({
    ...record,
    ...((record as T & { position?: string | null }).position === null && { position: undefined }),
    offlineRevision: revisions.get(`${entity}:${record.id}`) ?? 0,
  });
  const materialById = new Map(materials.map((item: { id: string }) => [item.id, item]));
  const flashcardById = new Map(flashcards.map((item: { id: string }) => [item.id, item]));
  const questionById = new Map(questions.map((item: { id: string }) => [item.id, item]));
  const offlineCardReviews = cardReviews.map((review: any) => ({
    ...review,
    offlineResource:
      review.resourceType === "material" ? materialById.get(review.cardId) :
      review.resourceType === "question" ? questionById.get(review.cardId) :
      flashcardById.get(review.cardId) ?? null,
  })).map((review: any) => withRevision("review", review));
  const timestamps = [
    ...workspaces, ...notes, ...noteGroups, ...materials, ...flashcards, ...questions,
    ...boardColumns, ...boardItems, ...userTags, ...cardReviews, ...languageWords,
    ...languageReviews,
  ].map((record: any) => new Date(record.updatedAt ?? record.createdAt ?? 0).getTime());
  const revision = `${Math.max(0, ...timestamps)}:${workspaceIds.sort().join(",") || "account"}`;
  setHeader(event, "Cache-Control", "no-store");
  return success(asJson({
    revision,
    generatedAt: new Date().toISOString(),
    workspaceId: parsed.data.workspaceId ?? null,
    data: {
      workspaces: workspaces.map((record: any) => withRevision("workspace", record)),
      notes: notes.map((record: any) => withRevision("note", record)),
      noteGroups: noteGroups.map((record: any) => withRevision("noteGroup", record)),
      materials: materials.map((record: any) => withRevision("material", record)),
      flashcards, questions,
      boardColumns: boardColumns.map((record: any) => withRevision("boardColumn", record)),
      boardItems: boardItems.map((record: any) => withRevision("boardItem", record)),
      boardComments: boardComments.map((record: any) => withRevision("boardComment", record)),
      boardLinks: boardLinks.map((record: any) => withRevision("boardLink", record)),
      userTags: userTags.map((record: any) => withRevision("userTag", record)),
      cardReviews: offlineCardReviews,
      languageWords: languageWords.map((record: any) => withRevision("languageWord", record)),
      languageReviews: languageReviews.map((record: any) => withRevision("languageReview", record)),
      languagePreferences: languagePreferences ? withRevision("languagePreference", languagePreferences) : null,
      notificationPreferences: notificationPreferences ? withRevision("notificationPreference", notificationPreferences) : null,
    },
  }));
});
