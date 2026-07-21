import { NotesSyncResponseSchema } from "../../../../shared/utils/note-sync.contract";
import type { NotesSyncRequest } from "../../../../shared/utils/note-sync.contract";
import { normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";
import { applyWorkspaceNoteLayout } from "./applyWorkspaceNoteLayout";
import { advanceOfflineEntityState } from "../../offline/application/advanceOfflineEntityState";
import { positionFromLegacyOrder } from "../../../../shared/utils/position-key";
import { areNoteSyncStatesEquivalent } from "../../../../shared/utils/note-sync-equivalence";

type NotesCreateReceipt = {
  kind: "notes-v1-create";
  entity: "note" | "noteGroup";
  tempId: string;
  serverId: string;
  version: number;
  updatedAt?: string;
};

function isDuplicateReceiptError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as { code?: string }).code === "P2002",
  );
}

function parseCreateReceipt(value: unknown): NotesCreateReceipt | null {
  if (!value || typeof value !== "object") return null;
  const receipt = value as Partial<NotesCreateReceipt>;
  if (
    receipt.kind !== "notes-v1-create" ||
    (receipt.entity !== "note" && receipt.entity !== "noteGroup") ||
    typeof receipt.tempId !== "string" ||
    typeof receipt.serverId !== "string" ||
    typeof receipt.version !== "number"
  )
    return null;
  return receipt as NotesCreateReceipt;
}

/**
 * A temp-ID create must remain idempotent even when the database commit
 * succeeds but the HTTP response is lost. The temp ID is the stable command
 * key; the receipt and domain insert commit in the same transaction.
 */
async function createNotesEntityOnce(input: {
  prisma: any;
  userId: string;
  entity: "note" | "noteGroup";
  tempId: string;
  create(tx: any): Promise<any>;
  advance(tx: any, serverId: string): Promise<void>;
}): Promise<NotesCreateReceipt & { replayed: boolean }> {
  const { prisma, userId, entity, tempId, create, advance } = input;
  const mutationId = `notes-v1:${entity}:create:${tempId}`;
  const readReceipt = async (client: any) => {
    if (!client.offlineMutationReceipt?.findUnique) return null;
    const row = await client.offlineMutationReceipt.findUnique({
      where: { userId_mutationId: { userId, mutationId } },
    });
    const receipt = parseCreateReceipt(row?.result);
    return receipt && receipt.entity === entity && receipt.tempId === tempId
      ? receipt
      : null;
  };

  const existing = await readReceipt(prisma);
  if (existing) return { ...existing, replayed: true };

  // Unit-test doubles and pre-migration development databases intentionally
  // keep the old behavior. Production has both capabilities.
  if (
    !prisma.offlineMutationReceipt?.create ||
    typeof prisma.$transaction !== "function"
  ) {
    const created = await create(prisma);
    await advance(prisma, created.id);
    return {
      kind: "notes-v1-create",
      entity,
      tempId,
      serverId: created.id,
      version: created.version ?? 1,
      updatedAt: created.updatedAt
        ? new Date(created.updatedAt).toISOString()
        : undefined,
      replayed: false,
    };
  }

  try {
    return await prisma.$transaction(
      async (tx: any) => {
        const insideReceipt = await readReceipt(tx);
        if (insideReceipt) return { ...insideReceipt, replayed: true };
        const created = await create(tx);
        await advance(tx, created.id);
        const receipt: NotesCreateReceipt = {
          kind: "notes-v1-create",
          entity,
          tempId,
          serverId: created.id,
          version: created.version ?? 1,
          updatedAt: created.updatedAt
            ? new Date(created.updatedAt).toISOString()
            : undefined,
        };
        await tx.offlineMutationReceipt.create({
          data: {
            userId,
            mutationId,
            status: "applied",
            result: receipt,
          },
        });
        return { ...receipt, replayed: false };
      },
      { maxWait: 5_000, timeout: 15_000 },
    );
  } catch (error) {
    if (isDuplicateReceiptError(error)) {
      const winner = await readReceipt(prisma);
      if (winner) return { ...winner, replayed: true };
    }
    throw error;
  }
}

export async function syncWorkspaceNotes(input: {
  prisma: any;
  userId: string;
  request: NotesSyncRequest;
}) {
  const { prisma, request, userId } = input;
  const applied: string[] = [];
  const appliedNotes: Array<{
    id: string;
    version: number;
    updatedAt?: string;
  }> = [];
  const conflicts: Array<{
    id: string;
    reason?: string;
    resolution?: string;
    serverVersion?: number;
    clientServerVersion?: number;
    serverSnapshot?: {
      id: string;
      workspaceId: string;
      groupId?: string | null;
      title?: string;
      content?: string;
      tags?: string[];
      noteType?: string;
      metadata?: unknown;
      version?: number;
      updatedAt?: string;
    };
  }> = [];
  const idMap: Record<string, string> = {};
  const replayedCreates: string[] = [];
  const groupApplied: string[] = [];
  const groupConflicts: Array<{ id: string }> = [];
  const groupIdMap: Record<string, string> = {};
  const replayedGroupCreates: string[] = [];
  const errors: Array<{ scope: string; id?: string; message: string }> = [];
  let layoutApplied = false;
  let layoutConflict = false;
  const groupChanges = request.groupChanges ?? [];
  const contentChanges = request.changes ?? [];

  const toServerSnapshot = (note: any) => ({
    id: note.id,
    workspaceId: note.workspaceId,
    groupId: note.groupId ?? null,
    title: note.title ?? undefined,
    content: note.content ?? undefined,
    tags: note.tags ?? undefined,
    noteType: note.noteType ?? undefined,
    metadata: note.metadata ?? undefined,
    version: note.version ?? undefined,
    updatedAt: note.updatedAt
      ? new Date(note.updatedAt).toISOString()
      : undefined,
  });

  for (const change of groupChanges) {
    try {
      const workspace = await prisma.workspace.findFirst({
        where: { id: change.workspaceId, userId },
      });
      if (!workspace) {
        groupConflicts.push({ id: change.id });
        continue;
      }

      if (change.operation === "create") {
        if (!change.title) {
          groupConflicts.push({ id: change.id });
          continue;
        }

        const isTempId = change.id.startsWith("temp-");
        const existing = isTempId
          ? null
          : await prisma.noteGroup.findFirst({
              where: { id: change.id, workspaceId: change.workspaceId },
            });

        if (existing) {
          await prisma.noteGroup.update({
            where: { id: existing.id },
            data: {
              title: change.title,
              ...(change.order !== undefined && { order: change.order }),
            },
          });
          await advanceOfflineEntityState({
            prisma,
            userId,
            entity: "noteGroup",
            entityId: existing.id,
            changedFields: ["title", "position"],
          });
          groupApplied.push(change.id);
          continue;
        }

        const maxOrderGroup = await prisma.noteGroup.findFirst({
          where: { workspaceId: change.workspaceId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const order =
          change.order ?? (maxOrderGroup ? maxOrderGroup.order + 1 : 0);
        const createGroup = (client: any) =>
          client.noteGroup.create({
            data: {
              ...(!isTempId && { id: change.id }),
              workspaceId: change.workspaceId,
              title: change.title,
              order,
              position: positionFromLegacyOrder(order),
            },
          });
        const advanceGroup = async (client: any, serverId: string) => {
          await advanceOfflineEntityState({
            prisma: client,
            userId,
            entity: "noteGroup",
            entityId: serverId,
            changedFields: ["title", "position"],
          });
        };
        const created = isTempId
          ? await createNotesEntityOnce({
              prisma,
              userId,
              entity: "noteGroup",
              tempId: change.id,
              create: createGroup,
              advance: advanceGroup,
            })
          : await (async () => {
              const row = await createGroup(prisma);
              await advanceGroup(prisma, row.id);
              return { serverId: row.id, replayed: false };
            })();
        if (isTempId) {
          groupIdMap[change.id] = created.serverId;
          if (created.replayed) replayedGroupCreates.push(change.id);
        }
        groupApplied.push(change.id);
        continue;
      }

      if (change.operation === "rename") {
        if (!change.title) {
          groupConflicts.push({ id: change.id });
          continue;
        }
        const group = await prisma.noteGroup.findFirst({
          where: { id: change.id, workspaceId: change.workspaceId },
        });
        if (!group) {
          groupConflicts.push({ id: change.id });
          continue;
        }
        await prisma.noteGroup.update({
          where: { id: change.id },
          data: { title: change.title },
        });
        await advanceOfflineEntityState({
          prisma,
          userId,
          entity: "noteGroup",
          entityId: group.id,
          changedFields: ["title"],
        });
        groupApplied.push(change.id);
        continue;
      }

      if (change.operation === "delete") {
        const serverGroupId = groupIdMap[change.id] ?? change.id;
        const group = await prisma.noteGroup.findFirst({
          where: { id: serverGroupId, workspaceId: change.workspaceId },
        });
        if (!group) {
          groupApplied.push(change.id);
          continue;
        }
        await prisma.$transaction(async (tx: any) => {
          await tx.note.updateMany({
            where: { workspaceId: change.workspaceId, groupId: serverGroupId },
            data: { groupId: null },
          });
          await tx.noteGroup.delete({ where: { id: serverGroupId } });
        });
        await advanceOfflineEntityState({
          prisma,
          userId,
          entity: "noteGroup",
          entityId: serverGroupId,
          changedFields: ["deleted"],
          deleted: true,
        });
        groupApplied.push(change.id);
        continue;
      }

      if (change.operation === "reorder") {
        const orders = change.groupOrders ?? [];
        const mappedOrders = orders.map((group) => ({
          ...group,
          id: groupIdMap[group.id] ?? group.id,
        }));

        await applyWorkspaceNoteLayout({
          prisma,
          userId,
          layout: {
            id: change.workspaceId,
            workspaceId: change.workspaceId,
            updatedAt: change.updatedAt,
            localVersion: change.localVersion,
            notes: [],
            groups: mappedOrders,
          },
        });
        groupApplied.push(change.id);
      }
    } catch (e) {
      console.error("[Notes Sync] Error processing group change:", {
        changeId: change.id,
        operation: change.operation,
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
      groupConflicts.push({ id: change.id });
      errors.push({
        scope: "group",
        id: change.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  for (const change of contentChanges) {
    try {
      if (change.operation === "delete") {
        const note = await prisma.note.findFirst({
          where: { id: change.id, workspace: { userId } },
        });
        if (!note) {
          const inaccessible =
            typeof prisma.note.findUnique === "function"
              ? await prisma.note.findUnique({
                  where: { id: change.id },
                  select: { id: true },
                })
              : null;
          if (inaccessible) {
            conflicts.push({ id: change.id, reason: "FORBIDDEN" });
          } else {
            // Idempotent retry after an already-applied delete.
            applied.push(change.id);
          }
          continue;
        }

        // Version-based optimistic concurrency: if the client's last known
        // version doesn't match the server's current version, the note was
        // modified by another client/session since the delete was queued.
        if (
          change.serverVersion !== undefined &&
          note.version !== undefined &&
          note.version !== change.serverVersion
        ) {
          conflicts.push({
            id: change.id,
            reason: "VERSION_MISMATCH",
            serverVersion: note.version,
            clientServerVersion: change.serverVersion,
            serverSnapshot: toServerSnapshot(note),
          });
          continue;
        }

        const collabDocument = await prisma.noteCollabDocument.findUnique({
          where: { noteId: change.id },
        });
        if (
          collabDocument?.updatedAt &&
          new Date(collabDocument.updatedAt).getTime() > change.updatedAt
        ) {
          conflicts.push({
            id: change.id,
            reason: "DELETE_REMOTE_BODY_EDIT",
            serverVersion: note.version,
            clientServerVersion: change.serverVersion,
            serverSnapshot: toServerSnapshot(note),
          });
          continue;
        }

        await prisma.note.delete({ where: { id: change.id } });
        await advanceOfflineEntityState({
          prisma,
          userId,
          entity: "note",
          entityId: change.id,
          changedFields: ["deleted"],
          deleted: true,
        });
        applied.push(change.id);
        continue;
      }

      const isTempId = change.id.startsWith("temp-");
      if (!change.workspaceId) {
        conflicts.push({ id: change.id });
        continue;
      }

      const workspace = await prisma.workspace.findFirst({
        where: { id: change.workspaceId, userId },
      });
      if (!workspace) {
        conflicts.push({ id: change.id });
        continue;
      }

      const resolvedGroupId = change.groupId
        ? (groupIdMap[change.groupId] ?? change.groupId)
        : change.groupId;

      if (resolvedGroupId) {
        const group = await prisma.noteGroup.findFirst({
          where: { id: resolvedGroupId, workspaceId: change.workspaceId },
        });
        if (!group) {
          conflicts.push({ id: change.id });
          continue;
        }
      }

      const existing = isTempId
        ? null
        : await prisma.note.findFirst({ where: { id: change.id } });

      if (!existing) {
        const data = {
          ...(isTempId ? {} : { id: change.id }),
          workspaceId: change.workspaceId,
          groupId: resolvedGroupId ?? null,
          title: normalizeWorkspaceNoteTitle(change.title, change.content),
          content: change.content || "",
          tags: change.tags || [],
          noteType: change.noteType ?? "TEXT",
          metadata: change.metadata as any,
          order: change.order ?? 0,
          position: positionFromLegacyOrder(change.order ?? 0),
        };
        const created = isTempId
          ? await createNotesEntityOnce({
              prisma,
              userId,
              entity: "note",
              tempId: change.id,
              create: (tx) => tx.note.create({ data }),
              advance: async (tx, serverId) => {
                await advanceOfflineEntityState({
                  prisma: tx,
                  userId,
                  entity: "note",
                  entityId: serverId,
                  changedFields: [
                    "title",
                    "content",
                    "groupId",
                    "tags",
                    "noteType",
                    "metadata",
                    "position",
                  ],
                });
              },
            })
          : await (async () => {
              const row = await prisma.note.create({ data });
              await advanceOfflineEntityState({
                prisma,
                userId,
                entity: "note",
                entityId: row.id,
                changedFields: [
                  "title",
                  "content",
                  "groupId",
                  "tags",
                  "noteType",
                  "metadata",
                  "position",
                ],
              });
              return {
                serverId: row.id,
                version: row.version ?? 1,
                updatedAt: row.updatedAt
                  ? new Date(row.updatedAt).toISOString()
                  : undefined,
                replayed: false,
              };
            })();
        if (isTempId) {
          idMap[change.id] = created.serverId;
          if (created.replayed) replayedCreates.push(change.id);
        }
        appliedNotes.push({
          id: change.id,
          version: created.version,
          updatedAt: created.updatedAt,
        });
        applied.push(change.id);
        continue;
      }

      const existingWorkspace = await prisma.workspace.findFirst({
        where: { id: existing.workspaceId, userId },
      });
      if (!existingWorkspace) {
        conflicts.push({ id: change.id });
        continue;
      }

      if (
        change.serverVersion !== undefined &&
        existing.version !== undefined &&
        existing.version !== change.serverVersion
      ) {
        // The previous attempt may have committed while its HTTP response was
        // lost (or a no-window service worker may have finished as the app
        // opened). Identical complete state is an acknowledged replay, not a
        // competing edit that requires manual conflict resolution.
        if (areNoteSyncStatesEquivalent(change, existing)) {
          appliedNotes.push({
            id: change.id,
            version: existing.version,
            updatedAt: existing.updatedAt
              ? new Date(existing.updatedAt).toISOString()
              : undefined,
          });
          applied.push(change.id);
          continue;
        }
        conflicts.push({
          id: change.id,
          reason: "VERSION_MISMATCH",
          serverVersion: existing.version,
          clientServerVersion: change.serverVersion,
          serverSnapshot: toServerSnapshot(existing),
        });
        continue;
      }

      const updated = await prisma.note.update({
        where: { id: change.id },
        data: {
          title: normalizeWorkspaceNoteTitle(
            change.title !== undefined ? change.title : existing.title,
            change.content ?? existing.content,
          ),
          ...(change.groupId !== undefined && { groupId: resolvedGroupId }),
          content: change.content ?? existing.content,
          tags: change.tags ?? existing.tags,
          ...(change.noteType !== undefined && { noteType: change.noteType }),
          ...(change.metadata !== undefined && {
            metadata: change.metadata as any,
          }),
          version: { increment: 1 },
        },
      });
      await advanceOfflineEntityState({
        prisma,
        userId,
        entity: "note",
        entityId: updated.id,
        changedFields: [
          "title",
          "content",
          "groupId",
          "tags",
          "noteType",
          "metadata",
        ],
      });
      appliedNotes.push({
        id: change.id,
        version: updated.version ?? existing.version ?? 1,
        updatedAt: updated.updatedAt
          ? new Date(updated.updatedAt).toISOString()
          : undefined,
      });
      applied.push(change.id);
    } catch (e) {
      console.error("[Notes Sync] Error processing change:", {
        changeId: change.id,
        operation: change.operation,
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      errors.push({
        scope: "content",
        id: change.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (request.layoutChange) {
    try {
      const layoutChange = {
        ...request.layoutChange,
        notes: request.layoutChange.notes.map((note) => ({
          ...note,
          id: idMap[note.id] ?? note.id,
          groupId: note.groupId
            ? (groupIdMap[note.groupId] ?? note.groupId)
            : null,
        })),
        groups: request.layoutChange.groups.map((group) => ({
          ...group,
          id: groupIdMap[group.id] ?? group.id,
        })),
      };
      await applyWorkspaceNoteLayout({
        prisma,
        userId,
        layout: layoutChange,
      });
      layoutApplied = true;
    } catch (e) {
      console.error("Error applying notes layout change:", {
        workspaceId: request.layoutChange.workspaceId,
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
      layoutConflict = true;
      errors.push({
        scope: "layout",
        id: request.layoutChange.workspaceId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const response = NotesSyncResponseSchema.parse({
    applied,
    appliedNotes,
    conflicts,
    idMap,
    noteIdMap: idMap,
    replayedCreates,
    groupApplied,
    groupConflicts,
    groupIdMap,
    replayedGroupCreates,
    errors,
    layoutApplied,
    layoutConflict,
  });
  return response;
}
