import { NotesSyncResponseSchema } from "../../../../shared/utils/note-sync.contract";
import type { NotesSyncRequest } from "../../../../shared/utils/note-sync.contract";

export async function syncWorkspaceNotes(input: {
  prisma: any;
  userId: string;
  request: NotesSyncRequest;
}) {
  const { prisma, request, userId } = input;
  const applied: string[] = [];
  const conflicts: Array<{ id: string }> = [];
  const idMap: Record<string, string> = {};

  for (const change of request.changes) {
    try {
      if (change.operation === "delete") {
        const note = await prisma.note.findFirst({ where: { id: change.id } });
        if (!note) {
          applied.push(change.id);
          continue;
        }

        const workspace = await prisma.workspace.findFirst({
          where: { id: note.workspaceId, userId },
        });
        if (!workspace) {
          applied.push(change.id);
          continue;
        }

        if (note.updatedAt && note.updatedAt.getTime() > change.updatedAt) {
          conflicts.push({ id: change.id });
          continue;
        }

        await prisma.note.delete({ where: { id: change.id } });
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

      const existing = isTempId
        ? null
        : await prisma.note.findFirst({ where: { id: change.id } });

      if (!existing) {
        const data = {
          ...(isTempId ? {} : { id: change.id }),
          workspaceId: change.workspaceId,
          content: change.content || "",
          tags: change.tags || [],
          noteType: change.noteType ?? "TEXT",
          metadata: change.metadata as any,
        };
        const created = await prisma.note.create({ data });
        if (isTempId) idMap[change.id] = created.id;
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
        existing.updatedAt &&
        existing.updatedAt.getTime() > change.updatedAt
      ) {
        conflicts.push({ id: change.id });
        continue;
      }

      await prisma.note.update({
        where: { id: change.id },
        data: {
          content: change.content ?? existing.content,
          tags: change.tags ?? existing.tags,
          ...(change.noteType !== undefined && { noteType: change.noteType }),
          ...(change.metadata !== undefined && {
            metadata: change.metadata as any,
          }),
        },
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
      conflicts.push({ id: change.id });
    }
  }

  return NotesSyncResponseSchema.parse({ applied, conflicts, idMap });
}
